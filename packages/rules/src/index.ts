// 掼蛋规则引擎 —— 纯函数，零依赖，前后端共用。规格见 RULES_SPEC.md。
//
// 中心 API：
//   getLegalPlays(hand, lastPlay, level) → Play[]
// 四处消费：UI 置灰非法组合、UI 高亮推荐、bot 候选动作、服务端校验。
//
// 逢人配、进贡见 RULES_SPEC.md，本期（P0）未实现。

export { createDeck, compareValue, shapeIndex, SHAPE_RANKS } from './deck.js';
export { classifyPlay } from './classify.js';
export { comparePlays } from './compare.js';
export { getLegalPlays } from './legalPlays.js';
export { isWildcard } from './shape.js';
export {
  resolveTribute,
  findTributeCard,
  findReturnCard,
  getTributeCardValue,
  formatCardName
} from './tribute.js';
export type { TributeExchange, TributeResult } from './tribute.js';
export type { Card, Play, PlayType, Rank, Suit } from './types.js';
