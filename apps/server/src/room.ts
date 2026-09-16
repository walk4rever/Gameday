import { DurableObject } from 'cloudflare:workers';
import { chooseBotPlay } from '@guandan/bot';
import { createGame, dealHands, isRoundOver, passTurn, playCards, shuffleDeck } from '@guandan/engine';
import type { GameState, Seat } from '@guandan/engine';
import type {
  ClientMessage,
  LobbyMessage,
  LobbySeatSnapshot,
  PausedInfo,
  PlayerStatus,
  SeatSnapshot,
  SeatTrickAction,
  ServerMessage,
  StateMessage,
  TributeExchangeState,
  TributePhaseInfo
} from '@guandan/protocol';
import {
  createDeck,
  formatCardName,
  findReturnCard,
  findTributeCard,
  getTributeCardValue,
  resolveTribute,
  SHAPE_RANKS,
  validateReturnCard,
  validateTributeCard
} from '@guandan/rules';
import type { Card, Rank } from '@guandan/rules';
import type { Env } from './env.js';

// 一个房间 = 一个 Room 实例。见 PRODUCT.md §2.4 / §2.3（服务端权威）。
const SEATS: Seat[] = [0, 1, 2, 3];
const BOT_MOVE_DELAY_MS = 700;

export interface UserRecord {
  id: string;
  username: string;
  gestureHash: string;
  salt: string;
  createdAt: number;
}

interface SeatState {
  playerId: string | null;
  name: string;
  isBot: boolean;
  status: PlayerStatus;
  delegatedToBot: boolean;
}

export interface ActiveTributeExchange {
  fromSeat: Seat;
  toSeat: Seat;
  tributeCard?: Card;
  returnCard?: Card;
}

export interface ActiveTributeState {
  type: 'single' | 'double';
  stage: 'pay' | 'return';
  level: Rank;
  finishOrder: [Seat, Seat, Seat, Seat];
  exchanges: ActiveTributeExchange[];
}

interface StoredRoom {
  /** null = 还在等人按"开打"的大厅阶段，进房间先看到谁在线，按开打才发牌。 */
  game: GameState | null;
  seats: [SeatState, SeatState, SeatState, SeatState];
  /** 战队级数索引：[南/北队, 东/西队]，索引对应 SHAPE_RANKS 0~12 ('2'~'A') */
  teamLevels?: [number, number];
  /** 当前坐庄/防守战队：0 (南/北队) 或 1 (东/西队) */
  dealerTeam?: 0 | 1;
  lastTribute?: {
    type: 'none' | 'anti_tribute' | 'single' | 'double';
    description: string;
  } | null;
  tributeState?: ActiveTributeState | null;
}

interface Connection {
  ws: WebSocket;
  playerId: string;
}

function partnerOf(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}

function freshRoom(): StoredRoom {
  return {
    game: null,
    seats: SEATS.map((seat) => ({
      playerId: null,
      name: `机器人 ${seat + 1}`,
      isBot: true,
      status: 'online' as const,
      delegatedToBot: false
    })) as StoredRoom['seats'],
    teamLevels: [0, 0],
    dealerTeam: 0,
    lastTribute: null,
    tributeState: null
  };
}

function dealNewGame(level: Rank = '2', startSeat: Seat = 0): GameState {
  const hands = dealHands(shuffleDeck(createDeck()));
  return createGame(hands, level, startSeat);
}

async function hashGesture(pattern: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${pattern}:${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class Room extends DurableObject<Env> {
  private room: StoredRoom = freshRoom();
  private connections: Connection[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<StoredRoom>('room');
      if (stored) {
        // 数据迁移与兼容保护：确保旧数据字段结构平滑升级
        for (const seat of stored.seats) {
          if (seat.status === undefined) {
            seat.status = 'online';
          }
          if (seat.isBot === undefined) {
            seat.isBot = seat.playerId === null;
          }
          if (seat.delegatedToBot === undefined) {
            seat.delegatedToBot = false;
          }
        }
        if (!stored.teamLevels) {
          stored.teamLevels = [0, 0];
        }
        if (stored.dealerTeam === undefined) {
          stored.dealerTeam = 0;
        }
        this.room = stored;
      }
    });
  }

  private async save(): Promise<void> {
    await this.ctx.storage.put('room', this.room);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 跨域预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const jsonHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    };

    // =========================================================================
    // 1. 用户认证模块：极简注册（用户名 + 手势密码）与手势登录
    // =========================================================================
    if (url.pathname === '/api/auth/check-username' && request.method === 'GET') {
      const queryUsername = (url.searchParams.get('username') ?? '').trim();
      if (!queryUsername || queryUsername.length < 2 || queryUsername.length > 12) {
        return Response.json(
          { ok: false, available: false, message: '用户名长度需在 2 到 12 位之间' },
          { headers: jsonHeaders, status: 400 }
        );
      }
      const existing = await this.ctx.storage.get<UserRecord>('user:' + queryUsername.toLowerCase());
      return Response.json(
        { ok: true, available: existing === undefined, username: queryUsername },
        { headers: jsonHeaders }
      );
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { username?: string; gesturePattern?: string };
        const username = (body.username ?? '').trim();
        const pattern = (body.gesturePattern ?? '').trim();

        if (!username || username.length < 2 || username.length > 12) {
          return Response.json(
            { ok: false, error: 'INVALID_USERNAME', message: '用户名需在 2 到 12 个字符之间' },
            { headers: jsonHeaders, status: 400 }
          );
        }
        if (!pattern || pattern.length < 4) {
          return Response.json(
            { ok: false, error: 'INVALID_GESTURE', message: '手势密码需至少连接 4 个点' },
            { headers: jsonHeaders, status: 400 }
          );
        }

        const userKey = 'user:' + username.toLowerCase();
        const existing = await this.ctx.storage.get<UserRecord>(userKey);
        if (existing) {
          return Response.json(
            {
              ok: false,
              error: 'USERNAME_EXISTS',
              message: '该用户名已被占用，请修改为不同用户名'
            },
            { headers: jsonHeaders, status: 409 }
          );
        }

        const salt = crypto.randomUUID();
        const gestureHash = await hashGesture(pattern, salt);
        const newUser: UserRecord = {
          id: crypto.randomUUID(),
          username,
          gestureHash,
          salt,
          createdAt: Date.now()
        };

        await this.ctx.storage.put(userKey, newUser);

        return Response.json(
          { ok: true, user: { id: newUser.id, username: newUser.username } },
          { headers: jsonHeaders }
        );
      } catch {
        return Response.json(
          { ok: false, error: 'SERVER_ERROR', message: '注册失败，请稍后重试' },
          { headers: jsonHeaders, status: 500 }
        );
      }
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { username?: string; gesturePattern?: string };
        const username = (body.username ?? '').trim();
        const pattern = (body.gesturePattern ?? '').trim();

        if (!username || !pattern) {
          return Response.json(
            { ok: false, error: 'PARAM_REQUIRED', message: '请输入用户名并绘制手势密码' },
            { headers: jsonHeaders, status: 400 }
          );
        }

        const userKey = 'user:' + username.toLowerCase();
        const user = await this.ctx.storage.get<UserRecord>(userKey);
        if (!user) {
          return Response.json(
            { ok: false, error: 'USER_NOT_FOUND', message: '未找到该用户，请先完成注册' },
            { headers: jsonHeaders, status: 404 }
          );
        }

        const computedHash = await hashGesture(pattern, user.salt);
        if (computedHash !== user.gestureHash) {
          return Response.json(
            { ok: false, error: 'INVALID_CREDENTIALS', message: '手势密码错误，请重新绘制' },
            { headers: jsonHeaders, status: 401 }
          );
        }

        return Response.json(
          { ok: true, user: { id: user.id, username: user.username } },
          { headers: jsonHeaders }
        );
      } catch {
        return Response.json(
          { ok: false, error: 'SERVER_ERROR', message: '登录失败，请稍后重试' },
          { headers: jsonHeaders, status: 500 }
        );
      }
    }

    // =========================================================================
    // 2. 房间与桌子状态查询接口 (HTTP GET) 及 重置接口
    // =========================================================================
    if (url.pathname === '/api/room-reset') {
      this.room = freshRoom();
      await this.save();
      this.broadcast();
      return Response.json(
        { ok: true, message: '房间已成功重置为空闲大厅' },
        { headers: jsonHeaders }
      );
    }

    if (url.pathname === '/api/room-status') {
      const room = this.room;
      // 检查当前是否有真正活跃在线的真人长连接
      const hasOnlineHumans = this.connections.some((c) =>
        room.seats.some((s) => s.playerId === c.playerId)
      );

      // 真人玩家座位（非机器人）
      const humanSeats = room.seats.filter((s) => s.playerId !== null && !s.isBot);
      // 仍在对局中且未主动退出的真人玩家
      const activeHumans = humanSeats.filter((s) => s.status !== 'left');

      // 自动清理孤立残留对局：
      // 1. 全桌所有真人玩家均已主动退出 (activeHumans.length === 0 且曾有真人)
      // 2. 或者全桌已无任何在线真人，且（牌局未开、牌局已结束、或者仅单人与机器人对局且已离线）
      const shouldReset =
        (humanSeats.length > 0 && activeHumans.length === 0) ||
        (!hasOnlineHumans && (room.game === null || isRoundOver(room.game) || humanSeats.length <= 1));

      if (shouldReset && (room.game !== null || humanSeats.length > 0)) {
        room.game = null;
        for (let i = 0; i < room.seats.length; i++) {
          room.seats[i] = {
            playerId: null,
            name: `机器人 ${i + 1}`,
            isBot: true,
            status: 'online',
            delegatedToBot: false
          };
        }
        await this.save();
      }

      const gameActive = room.game !== null && !isRoundOver(room.game);
      const queryPlayerId = url.searchParams.get('playerId');
      const isMember = queryPlayerId ? room.seats.some((s) => s.playerId === queryPlayerId) : false;
      const humanSeatsCount = room.seats.filter((s) => s.playerId !== null && !s.isBot).length;
      const isFull = gameActive || humanSeatsCount >= 4;

      return Response.json(
        {
          room: url.searchParams.get('room') ?? 'default',
          tables: [
            {
              id: 'guandan',
              name: '经典掼蛋',
              type: 'guandan',
              gameActive,
              isFull,
              isMember,
              humanSeatsCount,
              maxSeats: 4,
              status: gameActive
                ? 'playing'
                : humanSeatsCount >= 4
                  ? 'full'
                  : humanSeatsCount > 0
                    ? 'waiting'
                    : 'empty',
              seats: room.seats.map((s, idx) => ({
                seat: idx,
                name: s.name,
                isBot: s.isBot,
                status: s.status,
                connected:
                  s.playerId !== null && this.connections.some((c) => c.playerId === s.playerId)
              }))
            },
            {
              id: 'shuangsheng',
              name: '经典双升 · 拖拉机',
              type: 'shuangsheng',
              gameActive: false,
              isFull: false,
              isMember: false,
              humanSeatsCount: 0,
              maxSeats: 4,
              status: 'developing'
            }
          ]
        },
        { headers: jsonHeaders }
      );
    }

    // =========================================================================
    // 3. WebSocket 连接处理
    // =========================================================================
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const playerId = url.searchParams.get('playerId');
    const name = (url.searchParams.get('name') ?? '玩家').slice(0, 12);
    if (!playerId) return new Response('missing playerId', { status: 400 });

    const room = this.room;
    const seat = this.assignSeat(room, playerId, name);
    if (seat === null) {
      const isGameActive = room.game !== null;
      const msg = isGameActive
        ? '掼蛋桌游戏已开始且已满员（4人），第5人无法进入'
        : '掼蛋桌已满员（4人已就绪）';
      return new Response(msg, { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    this.connections = this.connections.filter((c) => c.playerId !== playerId);
    this.connections.push({ ws: server, playerId });

    server.addEventListener('message', (event) => {
      void this.handleMessage(playerId, event.data).catch((error) => {
        this.sendTo(playerId, {
          type: 'error',
          message: error instanceof Error ? error.message : '未知错误'
        });
      });
    });

    server.addEventListener('close', () => {
      this.connections = this.connections.filter((c) => c.ws !== server);

      if (this.room.game === null) {
        // 大厅阶段离开且无活跃连接：还原该座位为机器人
        for (let i = 0; i < this.room.seats.length; i++) {
          const s = this.room.seats[i];
          if (s && s.playerId && !this.connections.some((c) => c.playerId === s.playerId)) {
            this.room.seats[i] = {
              playerId: null,
              name: `机器人 ${i + 1}`,
              isBot: true,
              status: 'online',
              delegatedToBot: false
            };
          }
        }
      } else {
        // 对局进行中断开连接：
        // 关键：保留席位，将状态标记为 offline (掉线中)；绝对不托管给机器人代打！
        const seatIdx = this.room.seats.findIndex((s) => s.playerId === playerId);
        if (seatIdx !== -1) {
          const seatObj = this.room.seats[seatIdx];
          if (seatObj && seatObj.status !== 'left') {
            seatObj.status = 'offline';
          }
        }
      }

      void this.afterStateChange(this.room);
    });

    await this.save();
    this.broadcast();

    if (
      this.room.game !== null &&
      !isRoundOver(this.room.game) &&
      this.isBotControlled(this.room, this.room.game.currentTurn)
    ) {
      await this.ctx.storage.setAlarm(Date.now() + BOT_MOVE_DELAY_MS);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private disambiguateName(
    requestedName: string,
    currentSeatIndex: number | null,
    room: StoredRoom
  ): string {
    const trimmed = requestedName.trim().slice(0, 12) || '玩家';

    const otherNames = new Set<string>();
    for (let i = 0; i < room.seats.length; i++) {
      if (currentSeatIndex !== null && i === currentSeatIndex) continue;
      const s = room.seats[i];
      if (s && s.playerId !== null) {
        otherNames.add(s.name);
      }
    }

    if (!otherNames.has(trimmed)) {
      return trimmed;
    }

    let counter = 2;
    while (otherNames.has(`${trimmed} (${counter})`)) {
      counter++;
    }
    return `${trimmed} (${counter})`;
  }

  private assignSeat(room: StoredRoom, playerId: string, name: string): Seat | null {
    // 1. 同一个 playerId 认回原座位（重连或恢复）
    const existing = room.seats.findIndex((s) => s.playerId === playerId);
    if (existing !== -1) {
      const seat = existing as Seat;
      const target = room.seats[seat];
      // 如果该玩家此前是主动退出状态 ('left')，且牌桌已经无其他对局中真人，则重置本桌以便重新开局
      if (target && target.status === 'left') {
        const otherActiveHumans = room.seats.filter(
          (s, idx) => idx !== seat && s.playerId !== null && !s.isBot && s.status !== 'left'
        );
        if (otherActiveHumans.length === 0) {
          room.game = null;
          for (let i = 0; i < room.seats.length; i++) {
            room.seats[i] = {
              playerId: null,
              name: `机器人 ${i + 1}`,
              isBot: true,
              status: 'online',
              delegatedToBot: false
            };
          }
        } else {
          // 仍有其他真人处于对局中，重新认领回自己的座位
          const finalName = this.disambiguateName(name, seat, room);
          target.name = finalName;
          target.status = 'online';
          return seat;
        }
      } else {
        const finalName = this.disambiguateName(name, seat, room);
        if (target) {
          target.name = finalName;
          target.status = 'online';
        }
        return seat;
      }
    }

    // 关键自愈：如果桌上目前没有任何活跃在线的真人连接，自动重置为空闲大厅
    const hasOnlineHumans = this.connections.some((c) =>
      room.seats.some((s) => s.playerId === c.playerId)
    );
    if (!hasOnlineHumans) {
      room.game = null;
      for (let i = 0; i < room.seats.length; i++) {
        room.seats[i] = {
          playerId: null,
          name: `机器人 ${i + 1}`,
          isBot: true,
          status: 'online',
          delegatedToBot: false
        };
      }
    }

    // 2. 核心限制：如果对局正在活跃进行中（且非已结束），禁止任何新玩家/第5人加入
    const isGameActive = room.game !== null && !isRoundOver(room.game);
    if (isGameActive) {
      return null;
    }

    // 如果对局已经结束，重置为大厅等待新局
    if (room.game !== null && isRoundOver(room.game)) {
      room.game = null;
    }

    // 3. 空闲座位 (playerId === null 或 isBot === true)
    const emptySeatIndex = room.seats.findIndex((s) => s.playerId === null || s.isBot);
    if (emptySeatIndex !== -1) {
      const seat = emptySeatIndex as Seat;
      const finalName = this.disambiguateName(name, seat, room);
      room.seats[seat] = {
        playerId,
        name: finalName,
        isBot: false,
        status: 'online',
        delegatedToBot: false
      };
      return seat;
    }

    // 4. 如果大厅阶段，有座位处于离线状态（无活跃长连接）：允许新玩家顶替该空闲座位
    const offlineSeatIndex = room.seats.findIndex(
      (s) => !this.connections.some((c) => c.playerId === s.playerId)
    );
    if (offlineSeatIndex !== -1) {
      const seat = offlineSeatIndex as Seat;
      const finalName = this.disambiguateName(name, seat, room);
      room.seats[seat] = {
        playerId,
        name: finalName,
        isBot: false,
        status: 'online',
        delegatedToBot: false
      };
      return seat;
    }

    return null;
  }

  private isBotControlled(room: StoredRoom, seat: Seat): boolean {
    const seatState = room.seats[seat];
    // 只有初始纯机器人，或者同桌真人明确授权委托机器人代打时，才由机器人决策
    if (seatState.isBot) return true;
    if (seatState.delegatedToBot) return true;
    return false;
  }

  private async handleMessage(playerId: string, raw: unknown): Promise<void> {
    if (typeof raw !== 'string') return;
    const message = JSON.parse(raw) as ClientMessage;
    const room = this.room;

    const seatIndex = room.seats.findIndex((s) => s.playerId === playerId);
    if (seatIndex === -1) {
      this.sendTo(playerId, { type: 'error', message: '没有找到座位，请重新加入房间' });
      return;
    }
    const seat = seatIndex as Seat;

    // 心跳检测响应
    if (message.type === 'ping') {
      this.sendTo(playerId, { type: 'pong' });
      return;
    }

    // 主动退出游戏
    if (message.type === 'leave') {
      const conn = this.connections.find((c) => c.playerId === playerId);
      this.connections = this.connections.filter((c) => c.playerId !== playerId);

      // 检查除当前主动退出的玩家外，桌上是否还有其他真人玩家（未退出的真人）
      const otherActiveHumans = room.seats.filter(
        (s, idx) => idx !== seat && s.playerId !== null && !s.isBot && s.status !== 'left'
      );

      if (room.game === null || otherActiveHumans.length === 0) {
        // 如果本局未开始，或者桌上已经没有其他真人玩家（例如 1人+3bot，或全员已退出）：
        // 直接重置牌桌为空闲状态，清空残留对局！
        room.game = null;
        for (let i = 0; i < room.seats.length; i++) {
          room.seats[i] = {
            playerId: null,
            name: `机器人 ${i + 1}`,
            isBot: true,
            status: 'online',
            delegatedToBot: false
          };
        }
      } else {
        // 仍有其他真人玩家在场：标记本座位为 'left'，让同桌其他真人能看到其已退出，并协商 AI 接管或解散
        const targetSeat = room.seats[seat];
        if (targetSeat) {
          targetSeat.status = 'left';
        }
      }

      await this.afterStateChange(room);
      conn?.ws.close(1000, 'player_leave');
      return;
    }

    // 授权委托机器人代打（同桌其他玩家主动决策）
    if (message.type === 'delegate_bot') {
      if (room.game !== null && message.seat >= 0 && message.seat < 4) {
        const targetSeat = room.seats[message.seat];
        if (targetSeat && (targetSeat.status === 'offline' || targetSeat.status === 'left')) {
          targetSeat.delegatedToBot = true;
          await this.afterStateChange(room);
        }
      }
      return;
    }

    // 解散本局返回大厅（同桌其他玩家主动决策）
    if (message.type === 'dissolve') {
      room.game = null;
      for (let i = 0; i < room.seats.length; i++) {
        const s = room.seats[i];
        if (
          s &&
          (s.status === 'left' ||
            (s.status === 'offline' && !this.connections.some((c) => c.playerId === s.playerId)))
        ) {
          room.seats[i] = {
            playerId: null,
            name: `机器人 ${i + 1}`,
            isBot: true,
            status: 'online',
            delegatedToBot: false
          };
        } else if (s) {
          s.delegatedToBot = false;
        }
      }
      await this.afterStateChange(room);
      return;
    }

    if (message.type === 'start') {
      if (room.game !== null) {
        this.sendTo(playerId, { type: 'error', message: '牌局已经开始了' });
        return;
      }
      room.teamLevels = room.teamLevels ?? [0, 0];
      room.dealerTeam = room.dealerTeam ?? 0;
      const startLevel = SHAPE_RANKS[room.teamLevels[room.dealerTeam]] ?? '2';
      room.lastTribute = null;
      room.game = dealNewGame(startLevel, 0);
      await this.afterStateChange(room);
      return;
    }

    if (room.game === null) {
      this.sendTo(playerId, { type: 'error', message: '牌局还没开始，等一个人按开打' });
      return;
    }
    const game = room.game;

    if (message.type === 'restart') {
      let nextLevel: Rank = '2';
      let nextStartSeat: Seat = 0;

      if (game && isRoundOver(game)) {
        let finishOrder = game.finished;
        if (finishOrder.length < 4) {
          const allSeats: Seat[] = [0, 1, 2, 3];
          const remaining = allSeats.filter((s) => !finishOrder.includes(s));
          remaining.sort((a, b) => game.hands[a].length - game.hands[b].length);
          finishOrder = [...finishOrder, ...remaining];
        }

        const firstSeat = finishOrder[0] ?? 0;
        nextStartSeat = firstSeat;
        const winningTeam = (firstSeat % 2) as 0 | 1;
        const partnerSeat = ((firstSeat + 2) % 4) as Seat;
        const secondRank = finishOrder.indexOf(partnerSeat);

        let bonus = 0;
        if (secondRank === 1) bonus = 3; // 双上
        else if (secondRank === 2) bonus = 2; // 单上
        else bonus = 1; // 平局 (头游方升 1 级)

        room.teamLevels = room.teamLevels ?? [0, 0];
        const currentIdx = room.teamLevels[winningTeam] ?? 0;
        const nextIdx = Math.min(SHAPE_RANKS.length - 1, currentIdx + bonus);
        room.teamLevels[winningTeam] = nextIdx;
        room.dealerTeam = winningTeam;
        nextLevel = SHAPE_RANKS[nextIdx] ?? '2';

        const newHands = dealHands(shuffleDeck(createDeck()));

        // 1. 平局判定（头游与搭档同一战队，但搭档为末游）
        if (secondRank === 3) {
          room.tributeState = null;
          room.lastTribute = {
            type: 'none',
            description: '上一局平局，无需进贡，由头游首出。'
          };
          room.game = createGame(newHands, nextLevel, firstSeat);
        } else if (secondRank === 1) {
          // 2. 双下（获 1、2 名）
          const headSeat = firstSeat;
          const secondSeat = finishOrder[1]!;
          const thirdSeat = finishOrder[2]!;
          const lastSeat = finishOrder[3]!;

          // 检查双大王抗贡
          const losingBigJokers = [...newHands[thirdSeat], ...newHands[lastSeat]].filter(
            (c) => c.rank === 'big_joker'
          ).length;

          if (losingBigJokers >= 2) {
            room.tributeState = null;
            room.lastTribute = {
              type: 'anti_tribute',
              description: '落败方摸到双大王，抗贡成功！免除进贡，由头游首出。'
            };
            room.game = createGame(newHands, nextLevel, headSeat);
          } else {
            room.lastTribute = null;
            room.game = createGame(newHands, nextLevel, headSeat);
            room.tributeState = {
              type: 'double',
              stage: 'pay',
              level: nextLevel,
              finishOrder: finishOrder as [Seat, Seat, Seat, Seat],
              exchanges: [
                { fromSeat: lastSeat, toSeat: headSeat },
                { fromSeat: thirdSeat, toSeat: secondSeat }
              ]
            };
            this.processBotTributes(room);
          }
        } else {
          // 3. 单下（获 1、3 名）
          const headSeat = firstSeat;
          const lastSeat = finishOrder[3]!;

          // 检查单下抗贡：末游独揽双大王
          const lastBigJokers = newHands[lastSeat].filter((c) => c.rank === 'big_joker').length;
          if (lastBigJokers >= 2) {
            room.tributeState = null;
            room.lastTribute = {
              type: 'anti_tribute',
              description: '末游独揽双大王，抗贡成功！免除进贡，由头游首出。'
            };
            room.game = createGame(newHands, nextLevel, headSeat);
          } else {
            room.lastTribute = null;
            room.game = createGame(newHands, nextLevel, headSeat);
            room.tributeState = {
              type: 'single',
              stage: 'pay',
              level: nextLevel,
              finishOrder: finishOrder as [Seat, Seat, Seat, Seat],
              exchanges: [{ fromSeat: lastSeat, toSeat: headSeat }]
            };
            this.processBotTributes(room);
          }
        }
      } else if (game) {
        nextLevel = game.level;
        nextStartSeat = game.currentTurn;
        room.lastTribute = null;
        room.tributeState = null;
        room.game = dealNewGame(nextLevel, nextStartSeat);
      } else {
        room.lastTribute = null;
        room.tributeState = null;
        room.game = dealNewGame(nextLevel, nextStartSeat);
      }

      await this.afterStateChange(room);
      return;
    }

    if (message.type === 'pay_tribute') {
      if (!room.tributeState || room.tributeState.stage !== 'pay' || !room.game) {
        this.sendTo(playerId, { type: 'error', message: '当前不是进贡阶段' });
        return;
      }
      const exchange = room.tributeState.exchanges.find(
        (ex) => ex.fromSeat === seat && ex.tributeCard === undefined
      );
      if (!exchange) {
        this.sendTo(playerId, { type: 'error', message: '当前无需你进贡' });
        return;
      }
      const card = room.game.hands[seat].find((c) => c.id === message.cardId);
      if (!card) {
        this.sendTo(playerId, { type: 'error', message: '所选牌不在手牌中' });
        return;
      }
      const validation = validateTributeCard(card, room.game.hands[seat], room.tributeState.level);
      if (!validation.ok) {
        this.sendTo(playerId, { type: 'error', message: validation.error });
        return;
      }

      exchange.tributeCard = card;
      room.game.hands[seat] = room.game.hands[seat].filter((c) => c.id !== card.id);
      room.game.hands[exchange.toSeat].push(card);

      if (room.tributeState.exchanges.every((ex) => ex.tributeCard !== undefined)) {
        room.tributeState.stage = 'return';
      }

      this.processBotTributes(room);
      await this.afterStateChange(room);
      return;
    }

    if (message.type === 'return_tribute') {
      if (!room.tributeState || room.tributeState.stage !== 'return' || !room.game) {
        this.sendTo(playerId, { type: 'error', message: '当前不是还贡阶段' });
        return;
      }
      const exchange = room.tributeState.exchanges.find(
        (ex) => ex.toSeat === seat && ex.returnCard === undefined
      );
      if (!exchange) {
        this.sendTo(playerId, { type: 'error', message: '当前无需你还贡' });
        return;
      }
      const card = room.game.hands[seat].find((c) => c.id === message.cardId);
      if (!card) {
        this.sendTo(playerId, { type: 'error', message: '所选牌不在手牌中' });
        return;
      }
      const validation = validateReturnCard(card, room.game.hands[seat], room.tributeState.level);
      if (!validation.ok) {
        this.sendTo(playerId, { type: 'error', message: validation.error });
        return;
      }

      exchange.returnCard = card;
      room.game.hands[seat] = room.game.hands[seat].filter((c) => c.id !== card.id);
      room.game.hands[exchange.fromSeat].push(card);

      this.processBotTributes(room);
      await this.afterStateChange(room);
      return;
    }

    if (message.type === 'pass') {
      if (room.tributeState) {
        this.sendTo(playerId, { type: 'error', message: '进贡还贡阶段尚未结束，请先完成操作' });
        return;
      }
      const result = passTurn(game, seat);
      if (!result.ok) {
        this.sendTo(playerId, { type: 'error', message: result.error });
        return;
      }
      room.game = result.state;
      await this.afterStateChange(room);
      return;
    }

    if (message.type === 'play') {
      if (room.tributeState) {
        this.sendTo(playerId, { type: 'error', message: '进贡还贡阶段尚未结束，请先完成操作' });
        return;
      }
      const hand = game.hands[seat];
      const cards = message.cardIds
        .map((id) => hand.find((c) => c.id === id))
        .filter((c): c is Card => c !== undefined);
      if (cards.length !== message.cardIds.length) {
        this.sendTo(playerId, { type: 'error', message: '出的牌不在手上' });
        return;
      }
      const result = playCards(game, seat, cards);
      if (!result.ok) {
        this.sendTo(playerId, { type: 'error', message: result.error });
        return;
      }
      room.game = result.state;
      await this.afterStateChange(room);
    }
  }

  override async alarm(): Promise<void> {
    const room = this.room;
    if (room.game === null || isRoundOver(room.game) || room.tributeState) return;
    const game = room.game;

    const seat = game.currentTurn;
    // 只有受控于机器人时才自动出牌；若为掉线或退出的真人玩家且未授权托管，绝不替其出牌！
    if (!this.isBotControlled(room, seat)) return;

    const partner = partnerOf(seat);
    const lastPlay = game.lastPlay && game.lastPlay.seat !== seat ? game.lastPlay.play : null;
    const move = chooseBotPlay({
      hand: game.hands[seat],
      lastPlay,
      level: game.level,
      isLastPlayFromPartner: game.lastPlay?.seat === partner,
      partnerHandSize: game.finished.includes(partner) ? 0 : game.hands[partner].length
    });

    const result = move === null ? passTurn(game, seat) : playCards(game, seat, move);
    if (!result.ok) return;

    room.game = result.state;
    await this.afterStateChange(room);
  }

  private getTributeWaitingSeats(state: ActiveTributeState): Seat[] {
    if (state.stage === 'pay') {
      return state.exchanges
        .filter((ex) => ex.tributeCard === undefined)
        .map((ex) => ex.fromSeat);
    }
    return state.exchanges
      .filter((ex) => ex.returnCard === undefined)
      .map((ex) => ex.toSeat);
  }

  private processBotTributes(room: StoredRoom): void {
    if (!room.tributeState || !room.game) return;
    let progressed = true;
    while (progressed && room.tributeState) {
      progressed = false;
      const state = room.tributeState;
      if (state.stage === 'pay') {
        for (const exchange of state.exchanges) {
          if (exchange.tributeCard === undefined && this.isBotControlled(room, exchange.fromSeat)) {
            const card = findTributeCard(room.game.hands[exchange.fromSeat], state.level);
            exchange.tributeCard = card;
            room.game.hands[exchange.fromSeat] = room.game.hands[exchange.fromSeat].filter(
              (c) => c.id !== card.id
            );
            room.game.hands[exchange.toSeat].push(card);
            progressed = true;
          }
        }
        if (state.exchanges.every((ex) => ex.tributeCard !== undefined)) {
          state.stage = 'return';
          progressed = true;
        }
      } else if (state.stage === 'return') {
        for (const exchange of state.exchanges) {
          if (exchange.returnCard === undefined && this.isBotControlled(room, exchange.toSeat)) {
            const card = findReturnCard(room.game.hands[exchange.toSeat], state.level);
            exchange.returnCard = card;
            room.game.hands[exchange.toSeat] = room.game.hands[exchange.toSeat].filter(
              (c) => c.id !== card.id
            );
            room.game.hands[exchange.fromSeat].push(card);
            progressed = true;
          }
        }
        if (state.exchanges.every((ex) => ex.returnCard !== undefined)) {
          let nextStartSeat: Seat;
          let description: string;
          if (state.type === 'single') {
            nextStartSeat = state.exchanges[0]!.fromSeat;
            description = `单下进贡：末游向头游进贡【${formatCardName(
              state.exchanges[0]!.tributeCard!
            )}】，头游还贡【${formatCardName(
              state.exchanges[0]!.returnCard!
            )}】。由进贡方先出牌。`;
          } else {
            const lastEx = state.exchanges[0]!;
            const thirdEx = state.exchanges[1]!;
            const lastVal = getTributeCardValue(lastEx.tributeCard!, state.level);
            const thirdVal = getTributeCardValue(thirdEx.tributeCard!, state.level);
            nextStartSeat = lastVal >= thirdVal ? lastEx.fromSeat : thirdEx.fromSeat;
            description = `双下进贡：末游贡【${formatCardName(
              lastEx.tributeCard!
            )}】，三游贡【${formatCardName(
              thirdEx.tributeCard!
            )}】。由进贡大牌者先出牌。`;
          }
          room.game.currentTurn = nextStartSeat;
          room.lastTribute = {
            type: state.type,
            description
          };
          room.tributeState = null;
          progressed = true;
        }
      }
    }
  }

  private async afterStateChange(room: StoredRoom): Promise<void> {
    await this.save();
    this.broadcast();
    if (
      room.game !== null &&
      !isRoundOver(room.game) &&
      !room.tributeState &&
      this.isBotControlled(room, room.game.currentTurn)
    ) {
      await this.ctx.storage.setAlarm(Date.now() + BOT_MOVE_DELAY_MS);
    }
  }

  private sendTo(playerId: string, message: ServerMessage): void {
    const connection = this.connections.find((c) => c.playerId === playerId);
    connection?.ws.send(JSON.stringify(message));
  }

  private broadcast(): void {
    const room = this.room;
    for (const connection of this.connections) {
      const seat = room.seats.findIndex((s) => s.playerId === connection.playerId);
      if (seat === -1) continue;
      const message: ServerMessage =
        room.game === null
          ? this.buildLobbyMessage(room, seat as Seat)
          : this.buildStateMessage(room.game, room.seats, seat as Seat);
      connection.ws.send(JSON.stringify(message));
    }
  }

  private buildLobbyMessage(room: StoredRoom, viewerSeat: Seat): LobbyMessage {
    const seats: LobbySeatSnapshot[] = SEATS.map((seat) => {
      const seatState = room.seats[seat];
      const isConnected =
        seatState.playerId !== null && this.connections.some((c) => c.playerId === seatState.playerId);
      return {
        seat,
        name: seatState.name,
        isBot: seatState.isBot,
        connected: isConnected,
        status: seatState.status
      };
    });
    return { type: 'lobby', you: viewerSeat, seats };
  }

  private getPausedInfo(game: GameState, roomSeats: StoredRoom['seats']): PausedInfo | null {
    if (isRoundOver(game)) return null;
    const currentTurnSeat = game.currentTurn;
    const seatState = roomSeats[currentTurnSeat];
    if (seatState.isBot || seatState.delegatedToBot) return null;
    if (seatState.status === 'offline') {
      return { seat: currentTurnSeat, name: seatState.name, reason: 'offline' };
    }
    if (seatState.status === 'left') {
      return { seat: currentTurnSeat, name: seatState.name, reason: 'left' };
    }
    return null;
  }

  private buildStateMessage(
    game: GameState,
    roomSeats: StoredRoom['seats'],
    viewerSeat: Seat
  ): StateMessage {
    const seats: SeatSnapshot[] = SEATS.map((seat) => {
      const seatState = roomSeats[seat];
      const isConnected =
        seatState.playerId !== null && this.connections.some((c) => c.playerId === seatState.playerId);
      return {
        seat,
        name: seatState.name,
        isBot: seatState.isBot,
        connected: isConnected,
        status: seatState.status,
        handCount: game.hands[seat].length
      };
    });

    const currentTrick: SeatTrickAction[] = [];
    for (const seat of SEATS) {
      const action = game.currentTrick[seat];
      if (!action) continue;
      currentTrick.push(
        action.type === 'play'
          ? { seat, action: 'play', cards: action.play.cards }
          : { seat, action: 'pass' }
      );
    }

    let finished = game.finished;
    const roundOver = isRoundOver(game);
    if (roundOver && finished.length < 4) {
      const allSeats: Seat[] = [0, 1, 2, 3];
      const remaining = allSeats.filter((s) => !finished.includes(s));
      remaining.sort((a, b) => game.hands[a].length - game.hands[b].length);
      finished = [...finished, ...remaining];
    }

    const tributePhase: TributePhaseInfo | null = this.room.tributeState
      ? {
          type: this.room.tributeState.type,
          stage: this.room.tributeState.stage,
          waitingSeats: this.getTributeWaitingSeats(this.room.tributeState),
          exchanges: this.room.tributeState.exchanges.map((ex) => ({
            fromSeat: ex.fromSeat,
            toSeat: ex.toSeat,
            tributeCard: ex.tributeCard,
            returnCard: ex.returnCard
          }))
        }
      : null;

    return {
      type: 'state',
      you: { seat: viewerSeat, hand: game.hands[viewerSeat] },
      seats,
      level: game.level,
      currentTurn: game.currentTurn,
      lastPlay: game.lastPlay ? { seat: game.lastPlay.seat, cards: game.lastPlay.play.cards } : null,
      currentTrick,
      finished,
      roundOver,
      paused: this.getPausedInfo(game, roomSeats),
      tribute: this.room.lastTribute ?? null,
      tributePhase
    };
  }
}
