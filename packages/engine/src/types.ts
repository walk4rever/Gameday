import type { Card, Play, Rank } from '@guandan/rules';

/** 座位号，0/2 一队，1/3 一队（对家）。P1 单机版不做进贡/升级，级牌固定。 */
export type Seat = 0 | 1 | 2 | 3;

export interface HistoryEntry {
  seat: Seat;
  action: 'play' | 'pass';
  play?: Play;
}

export type TrickAction = { type: 'play'; play: Play } | { type: 'pass' };

export interface GameState {
  level: Rank;
  hands: [Card[], Card[], Card[], Card[]];
  currentTurn: Seat;
  lastPlay: { seat: Seat; play: Play } | null;
  /** 自 lastPlay 起，连续过牌的人数 */
  passSinceLastPlay: number;
  /** 出完牌的座位，按完成顺序排列 */
  finished: Seat[];
  history: HistoryEntry[];
  /**
   * 当前这一墩里每个座位最新的动作（出了什么/过了），用于 UI 把牌摆在
   * 对应玩家面前。一墩结束（lastPlay 归 null）时清空，见 actions.ts。
   */
  currentTrick: Partial<Record<Seat, TrickAction>>;
}

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };
