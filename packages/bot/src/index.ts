// 启发式机器人 —— 空位补齐到 4 座。策略见 RULES_SPEC.md 无关，属于对局策略：
// 能压则压 / 优先出散牌 / 炸弹留到关键时刻 / 队友剩牌少时不抢。
// 候选动作全部来自 @guandan/rules 的 getLegalPlays()，不做 MCTS、不做神经网络。

import { compareValue, getLegalPlays } from '@guandan/rules';
import type { Card, Play, Rank } from '@guandan/rules';

export interface BotContext {
  hand: Card[];
  lastPlay: Play | null;
  level: Rank;
  /** lastPlay 是否是队友出的（队友领先时不抢） */
  isLastPlayFromPartner: boolean;
  /** 队友剩余手牌数，没有队友时传 Infinity */
  partnerHandSize: number;
}

const BOMB_TYPES = new Set<Play['type']>(['bomb', 'straightFlush', 'fourJokers']);

/** 返回要出的牌，或 null 表示过。 */
export function chooseBotPlay(context: BotContext): Card[] | null {
  const { hand, lastPlay, level, isLastPlayFromPartner, partnerHandSize } = context;

  if (lastPlay !== null && isLastPlayFromPartner) {
    return null;
  }

  const options = getLegalPlays(hand, lastPlay, level);
  if (options.length === 0) return null;

  if (lastPlay === null) {
    return chooseLead(options, level);
  }

  return chooseFollow(options, hand, partnerHandSize, level);
}

function chooseLead(options: Play[], level: Rank): Card[] {
  const nonBombs = options.filter((play) => !BOMB_TYPES.has(play.type));
  const pool = nonBombs.length > 0 ? nonBombs : options;
  return smallestPlay(pool, level).cards;
}

function chooseFollow(
  options: Play[],
  hand: Card[],
  partnerHandSize: number,
  level: Rank
): Card[] | null {
  const nonBombs = options.filter((play) => !BOMB_TYPES.has(play.type));
  if (nonBombs.length > 0) {
    return smallestPlay(nonBombs, level).cards;
  }

  if (partnerHandSize <= 2) {
    // 队友快出完了，没必要用炸弹抢这一墩
    return null;
  }

  const bombs = options.filter((play) => BOMB_TYPES.has(play.type));
  if (bombs.length === 0) return null;

  const isCriticalMoment = hand.length <= 6;
  if (!isCriticalMoment) return null;

  return smallestPlay(bombs, level).cards;
}

function smallestPlay(options: Play[], level: Rank): Play {
  return options.reduce((min, play) => (playWeight(play, level) < playWeight(min, level) ? play : min));
}

/** 张数越少越"散"越优先出；同张数按点数（含级牌/王的比较序）从小到大。 */
function playWeight(play: Play, level: Rank): number {
  return play.size * 100 + compareValue(play.rank, level);
}
