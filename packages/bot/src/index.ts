// 启发式机器人 —— 空位补齐到 4 座。
// 策略原则：
// 1. 领出（主动出牌）时：
//    - 优先打出多张连套牌（钢板、木板、顺子、三带二），快速脱手大量手牌；
//    - 其次打出三同张、对子；
//    - 最后打出真正的单张（孤牌），从小到大出；
//    - 严禁非必要拆炸弹、拆对子出单张；炸弹留到关键时刻；
// 2. 跟牌时：
//    - 队友领先时不抢（保护搭档）；
//    - 优先用天然同牌型从小到大压制，尽量避免拆大牌（如炸弹、三张）；
//    - 关键时刻（残局或控场）使用最小炸弹抢回牌权。

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

function getHandRankCounts(hand: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const c of hand) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }
  return counts;
}

/** 检查一手牌是否把手里的炸弹拆散了（例如手里有 4 张 9，却只打出 1 张或 2 张 9） */
function isSplittingBomb(play: Play, rankCounts: Map<Rank, number>): boolean {
  if (BOMB_TYPES.has(play.type)) return false;
  const usedCounts = new Map<Rank, number>();
  for (const c of play.cards) {
    usedCounts.set(c.rank, (usedCounts.get(c.rank) ?? 0) + 1);
  }
  for (const [rank, used] of usedCounts) {
    const total = rankCounts.get(rank) ?? 0;
    if (total >= 4 && used < 4) return true;
  }
  return false;
}

/** 返回要出的牌，或 null 表示过。 */
export function chooseBotPlay(context: BotContext): Card[] | null {
  const { hand, lastPlay, level, isLastPlayFromPartner, partnerHandSize } = context;

  // 1. 队友领先时不抢，把牌权留给队友
  if (lastPlay !== null && isLastPlayFromPartner) {
    return null;
  }

  const options = getLegalPlays(hand, lastPlay, level);
  if (options.length === 0) return null;

  const rankCounts = getHandRankCounts(hand);

  // 2. 主动领出新一墩
  if (lastPlay === null) {
    return chooseLead(options, hand, rankCounts, level);
  }

  // 3. 应手跟牌
  return chooseFollow(options, hand, rankCounts, partnerHandSize, level);
}

function chooseLead(
  options: Play[],
  hand: Card[],
  rankCounts: Map<Rank, number>,
  level: Rank
): Card[] {
  // 领出时，优先过滤掉拆炸弹的不良动作
  const nonBombSplitting = options.filter((p) => !isSplittingBomb(p, rankCounts));
  const pool = nonBombSplitting.length > 0 ? nonBombSplitting : options;

  // 如果只剩炸弹，或者手牌极少，可以直接出最小炸弹
  const nonBombs = pool.filter((p) => !BOMB_TYPES.has(p.type));
  if (nonBombs.length === 0) {
    return smallestBomb(pool, level).cards;
  }

  // 从普通牌型中选出最合理的出牌（评分越低越优先）
  return bestLeadPlay(nonBombs, rankCounts, level).cards;
}

function bestLeadPlay(
  options: Play[],
  rankCounts: Map<Rank, number>,
  level: Rank
): Play {
  return options.reduce((best, current) => {
    return scoreLeadPlay(current, rankCounts, level) < scoreLeadPlay(best, rankCounts, level)
      ? current
      : best;
  });
}

function scoreLeadPlay(
  play: Play,
  rankCounts: Map<Rank, number>,
  level: Rank
): number {
  let score = 0;

  // 拆牌惩罚
  if (play.type === 'single') {
    const count = rankCounts.get(play.rank) ?? 1;
    if (count >= 4) {
      score += 50000; // 拆炸弹
    } else if (count === 3) {
      score += 3000;  // 拆三张
    } else if (count === 2) {
      score += 1500;  // 拆对子
    }
    // 高价值大牌保留（避免首出直接送掉级牌/王/A）
    const val = compareValue(play.rank, level);
    if (val >= 13) {
      score += 1200;
    }
  } else if (play.type === 'pair') {
    const count = rankCounts.get(play.rank) ?? 2;
    if (count >= 4) {
      score += 50000;
    } else if (count === 3) {
      score += 800; // 把三张拆成对子
    }
  }

  // 牌型基础优先级：多张组合牌型优先甩出，快速减轻手牌负担！
  // 钢板/木板 (6张) > 顺子/三带二 (5张) > 三张 (3张) > 对子 (2张) > 孤立单张 (1张)
  let typeBase = 500;
  switch (play.type) {
    case 'tripleStraight':
    case 'triplePairs':
      typeBase = 100;
      break;
    case 'straight':
    case 'tripleWithPair':
      typeBase = 200;
      break;
    case 'triple':
      typeBase = 300;
      break;
    case 'pair':
      typeBase = 400;
      break;
    case 'single':
      typeBase = 500;
      break;
    default:
      typeBase = 1000;
  }
  score += typeBase;

  // 同牌型内部：点数越小越先出（顺子、对子、单张都从小到大起步）
  score += compareValue(play.rank, level) * 10;

  return score;
}

function chooseFollow(
  options: Play[],
  hand: Card[],
  rankCounts: Map<Rank, number>,
  partnerHandSize: number,
  level: Rank
): Card[] | null {
  const nonBombs = options.filter((play) => !BOMB_TYPES.has(play.type));

  if (nonBombs.length > 0) {
    // 优先使用不拆炸弹的正常牌型跟牌
    const safeNonBombs = nonBombs.filter((p) => !isSplittingBomb(p, rankCounts));
    const pool = safeNonBombs.length > 0 ? safeNonBombs : nonBombs;

    // 在能跟的非炸弹中，选点数最小的跟（避免浪费大牌）
    // 如果是跟单张，优先选不拆对子/三张的纯散牌
    return bestFollowPlay(pool, rankCounts, level).cards;
  }

  // 队友快出完（剩 2 张及以内），没必要用炸弹抢这一墩
  if (partnerHandSize <= 2) {
    return null;
  }

  const bombs = options.filter((play) => BOMB_TYPES.has(play.type));
  if (bombs.length === 0) return null;

  // 关键时刻（自身手牌少于等于 6 张进入斩杀线）可以用炸弹抢回主动权
  const isCriticalMoment = hand.length <= 6;
  if (!isCriticalMoment) return null;

  return smallestBomb(bombs, level).cards;
}

function bestFollowPlay(
  options: Play[],
  rankCounts: Map<Rank, number>,
  level: Rank
): Play {
  return options.reduce((best, current) => {
    return scoreFollowPlay(current, rankCounts, level) < scoreFollowPlay(best, rankCounts, level)
      ? current
      : best;
  });
}

function scoreFollowPlay(
  play: Play,
  rankCounts: Map<Rank, number>,
  level: Rank
): number {
  let score = 0;

  // 拆牌惩罚
  if (isSplittingBomb(play, rankCounts)) {
    score += 50000;
  }
  if (play.type === 'single') {
    const count = rankCounts.get(play.rank) ?? 1;
    if (count >= 3) score += 2000;
    else if (count === 2) score += 1000;
  }

  // 选用尽量小的牌压过（按点数递增）
  score += compareValue(play.rank, level);

  return score;
}

function smallestBomb(bombs: Play[], level: Rank): Play {
  return bombs.reduce((min, play) => {
    const weight = (p: Play) => p.size * 100 + compareValue(p.rank, level);
    return weight(play) < weight(min) ? play : min;
  });
}
