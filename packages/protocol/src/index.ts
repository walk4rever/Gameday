// 客户端 <-> Room Durable Object 的 WebSocket 消息协议。
// 连接时机的 playerId / name 走 URL 查询参数（见 apps/server 的 fetch 路由），
// 不在消息里，握手之后只有下面这些消息类型。

import type { Seat } from '@guandan/engine';
import type { Card, Rank } from '@guandan/rules';

export type PlayerStatus = 'online' | 'offline' | 'left';

export type ClientMessage =
  | { type: 'start' }
  | { type: 'play'; cardIds: string[] }
  | { type: 'pass' }
  | { type: 'restart' }
  | { type: 'pay_tribute'; cardId: string }
  | { type: 'return_tribute'; cardId: string }
  | { type: 'leave' }
  | { type: 'ping' }
  | { type: 'delegate_bot'; seat: Seat }
  | { type: 'dissolve' };

export interface LobbySeatSnapshot {
  seat: Seat;
  name: string;
  isBot: boolean;
  connected: boolean;
  status: PlayerStatus;
}

/** 进房间还没开打时的状态：谁在线、谁是机器人，等一个人按"开打"。 */
export interface LobbyMessage {
  type: 'lobby';
  you: Seat;
  seats: LobbySeatSnapshot[];
}

export interface SeatSnapshot {
  seat: Seat;
  name: string;
  isBot: boolean;
  connected: boolean;
  status: PlayerStatus;
  handCount: number;
}

/** 某个座位在当前这一墩里的动作，摆在桌上供 UI 展示"谁出了什么"。 */
export type SeatTrickAction =
  | { seat: Seat; action: 'play'; cards: Card[] }
  | { seat: Seat; action: 'pass' };

export interface PausedInfo {
  seat: Seat;
  name: string;
  reason: 'offline' | 'left';
}

export interface TributeExchangeState {
  fromSeat: Seat;
  toSeat: Seat;
  tributeCard?: Card | undefined;
  returnCard?: Card | undefined;
}

export interface TributePhaseInfo {
  type: 'single' | 'double';
  stage: 'pay' | 'return';
  waitingSeats: Seat[];
  exchanges: TributeExchangeState[];
}

export interface StateMessage {
  type: 'state';
  /** 只有自己能看到自己的手牌，其他座位只有 handCount，见 RULES_SPEC.md 服务端权威原则 */
  you: { seat: Seat; hand: Card[] };
  seats: SeatSnapshot[];
  level: Rank;
  currentTurn: Seat;
  lastPlay: { seat: Seat; cards: Card[] } | null;
  /** 当前这一墩每个座位已经出过/过了什么，一墩结束（lastPlay 归 null）时清空 */
  currentTrick: SeatTrickAction[];
  finished: Seat[];
  roundOver: boolean;
  paused: PausedInfo | null;
  tribute?: {
    type: 'none' | 'anti_tribute' | 'single' | 'double';
    description: string;
  } | null;
  tributePhase?: TributePhaseInfo | null;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type PongMessage = { type: 'pong' };

export type ServerMessage = LobbyMessage | StateMessage | ErrorMessage | PongMessage;

