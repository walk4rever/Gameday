// 单局（一副牌打完）状态机 —— 纯函数，跑在 apps/server 的 Durable Object 里。
// 不含进贡/升级/逢人配，见 packages/rules/RULES_SPEC.md。

export { shuffleDeck, dealHands } from './deal.js';
export { createGame, isRoundOver, legalMovesFor, playCards, passTurn, nextActiveSeat } from './actions.js';
export type { Seat, GameState, HistoryEntry, TrickAction, ActionResult } from './types.js';
