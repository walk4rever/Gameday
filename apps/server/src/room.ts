import { DurableObject } from 'cloudflare:workers';
import { chooseBotPlay } from '@guandan/bot';
import { createGame, dealHands, isRoundOver, passTurn, playCards, shuffleDeck } from '@guandan/engine';
import type { GameState, Seat } from '@guandan/engine';
import type {
  ClientMessage,
  LobbyMessage,
  LobbySeatSnapshot,
  SeatSnapshot,
  SeatTrickAction,
  ServerMessage,
  StateMessage
} from '@guandan/protocol';
import { createDeck } from '@guandan/rules';
import type { Card, Rank } from '@guandan/rules';
import type { Env } from './env.js';

// 一个房间 = 一个 Room 实例。见 PRODUCT.md §2.4 / §2.3（服务端权威）。
// P2 固定级牌、单房间、无进贡/逢人配，见 packages/rules/RULES_SPEC.md。
const LEVEL: Rank = '2';
const SEATS: Seat[] = [0, 1, 2, 3];
const BOT_MOVE_DELAY_MS = 700;

interface SeatState {
  playerId: string | null;
  name: string;
}

interface StoredRoom {
  /** null = 还在等人按"开打"的大厅阶段，见需求：进房间先看到谁在线，按开打才发牌。 */
  game: GameState | null;
  seats: [SeatState, SeatState, SeatState, SeatState];
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
    seats: SEATS.map((seat) => ({ playerId: null, name: `机器人 ${seat + 1}` })) as StoredRoom['seats']
  };
}

function dealNewGame(): GameState {
  const hands = dealHands(shuffleDeck(createDeck()));
  return createGame(hands, LEVEL, 0);
}

export class Room extends DurableObject<Env> {
  // 用占位值同步初始化，真正的值在下面的 blockConcurrencyWhile 里异步覆盖。
  // 这样写（而不是"第一次用到时才 load"）是为了避免两个几乎同时到达的连接
  // 各自读到"还没有房间"、各自 deal 一副新牌，后到的把先到的覆盖掉——
  // blockConcurrencyWhile 会让所有请求排队等这个初始化完成，彻底消除这个竞态。
  private room: StoredRoom = freshRoom();
  private connections: Connection[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<StoredRoom>('room');
      if (stored) this.room = stored;
    });
  }

  private async save(): Promise<void> {
    await this.ctx.storage.put('room', this.room);
  }

  override async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');
    const name = (url.searchParams.get('name') ?? '玩家').slice(0, 12);
    if (!playerId) return new Response('missing playerId', { status: 400 });

    const room = this.room;
    const seat = this.assignSeat(room, playerId, name);
    if (seat === null) {
      return new Response('房间已满', { status: 409 });
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

      // 如果在大厅等待阶段（尚未开牌）：某玩家离开且无活跃连接，还原该座位为机器人，
      // 保持大厅始终干净，不会留下死座或幽灵离线者
      if (this.room.game === null) {
        for (let i = 0; i < this.room.seats.length; i++) {
          const s = this.room.seats[i];
          if (s && s.playerId && !this.connections.some((c) => c.playerId === s.playerId)) {
            this.room.seats[i] = { playerId: null, name: `机器人 ${i + 1}` };
          }
        }
        void this.save();
      } else if (
        !isRoundOver(this.room.game) &&
        this.isBotControlled(this.room, this.room.game.currentTurn)
      ) {
        void this.ctx.storage.setAlarm(Date.now() + BOT_MOVE_DELAY_MS);
      }
      this.broadcast();
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

  /**
   * 自动重名排重：如果房间内已有其他真人叫相同名字，自动编号为 "Name (2)", "Name (3)"...
   */
  private disambiguateName(
    requestedName: string,
    currentSeatIndex: number | null,
    room: StoredRoom
  ): string {
    const trimmed = requestedName.trim().slice(0, 12) || '玩家';

    // 收集其他真人占用的名字（排除自己当前座位）
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
    // 1. 同一个 playerId 认回原座位（严格凭设备凭证认座，杜绝同名顶号）
    const existing = room.seats.findIndex((s) => s.playerId === playerId);
    if (existing !== -1) {
      const seat = existing as Seat;
      const finalName = this.disambiguateName(name, seat, room);
      room.seats[seat] = { playerId, name: finalName };
      return seat;
    }

    // 2. 空闲座位 (playerId === null)
    const emptySeatIndex = room.seats.findIndex((s) => s.playerId === null);
    if (emptySeatIndex !== -1) {
      const seat = emptySeatIndex as Seat;
      const finalName = this.disambiguateName(name, seat, room);
      room.seats[seat] = { playerId, name: finalName };
      return seat;
    }

    // 3. 如果大厅阶段（未开局），有座位处于离线状态（之前进来看过但关了网页的玩家）：
    //    允许新玩家顶替该空闲座位进大厅
    if (room.game === null) {
      const offlineSeatIndex = room.seats.findIndex(
        (s) => !this.connections.some((c) => c.playerId === s.playerId)
      );
      if (offlineSeatIndex !== -1) {
        const seat = offlineSeatIndex as Seat;
        const finalName = this.disambiguateName(name, seat, room);
        room.seats[seat] = { playerId, name: finalName };
        return seat;
      }
    }

    // 4. 对局已在进行中且 4 人满员，不可顶替
    return null;
  }

  private isBotControlled(room: StoredRoom, seat: Seat): boolean {
    const seatState = room.seats[seat];
    if (seatState.playerId === null) return true;
    return !this.connections.some((c) => c.playerId === seatState.playerId);
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

    if (message.type === 'start') {
      if (room.game !== null) {
        this.sendTo(playerId, { type: 'error', message: '牌局已经开始了' });
        return;
      }
      room.game = dealNewGame();
      await this.afterStateChange(room);
      return;
    }

    if (room.game === null) {
      this.sendTo(playerId, { type: 'error', message: '牌局还没开始，等一个人按开打' });
      return;
    }
    const game = room.game;

    if (message.type === 'restart') {
      room.game = dealNewGame();
      await this.afterStateChange(room);
      return;
    }

    if (message.type === 'pass') {
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
    if (room.game === null || isRoundOver(room.game)) return;
    const game = room.game;

    const seat = game.currentTurn;
    if (!this.isBotControlled(room, seat)) return; // 玩家已经回来了，交回给他

    const partner = partnerOf(seat);
    const lastPlay = game.lastPlay && game.lastPlay.seat !== seat ? game.lastPlay.play : null;
    const move = chooseBotPlay({
      hand: game.hands[seat],
      lastPlay,
      level: LEVEL,
      isLastPlayFromPartner: game.lastPlay?.seat === partner,
      partnerHandSize: game.finished.includes(partner) ? 0 : game.hands[partner].length
    });

    const result = move === null ? passTurn(game, seat) : playCards(game, seat, move);
    if (!result.ok) return; // bot 理论上不该出不合法的牌；真出现就跳过这次，避免卡死房间

    room.game = result.state;
    await this.afterStateChange(room);
  }

  private async afterStateChange(room: StoredRoom): Promise<void> {
    await this.save();
    this.broadcast();
    if (room.game !== null && !isRoundOver(room.game) && this.isBotControlled(room, room.game.currentTurn)) {
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
      return {
        seat,
        name: seatState.name,
        isBot: seatState.playerId === null,
        connected: seatState.playerId !== null && this.connections.some((c) => c.playerId === seatState.playerId)
      };
    });
    return { type: 'lobby', you: viewerSeat, seats };
  }

  private buildStateMessage(game: GameState, roomSeats: StoredRoom['seats'], viewerSeat: Seat): StateMessage {
    const seats: SeatSnapshot[] = SEATS.map((seat) => {
      const seatState = roomSeats[seat];
      return {
        seat,
        name: seatState.name,
        isBot: seatState.playerId === null,
        connected: seatState.playerId !== null && this.connections.some((c) => c.playerId === seatState.playerId),
        handCount: game.hands[seat].length
      };
    });

    const currentTrick: SeatTrickAction[] = [];
    for (const seat of SEATS) {
      const action = game.currentTrick[seat];
      if (!action) continue;
      currentTrick.push(
        action.type === 'play' ? { seat, action: 'play', cards: action.play.cards } : { seat, action: 'pass' }
      );
    }

    return {
      type: 'state',
      you: { seat: viewerSeat, hand: game.hands[viewerSeat] },
      seats,
      level: game.level,
      currentTurn: game.currentTurn,
      lastPlay: game.lastPlay ? { seat: game.lastPlay.seat, cards: game.lastPlay.play.cards } : null,
      currentTrick,
      finished: game.finished,
      roundOver: isRoundOver(game)
    };
  }
}
