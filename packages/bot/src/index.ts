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

import { compareValue, getLegalPlays, isWildcard } from '@guandan/rules';
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

/**
 * 智能提示推荐引擎：
 * 对当前所有合法出牌方案进行启发式综合评分，返回去重且按推荐优先级降序（评分由优到劣）排列的 Play[]。
 * 前端可基于此列表实现点击【提示】多方案平滑循环轮换（Cycle Hints）。
 */
export function getRankedHintPlays(context: BotContext): Play[] {
  const { hand, lastPlay, level } = context;
  const options = getLegalPlays(hand, lastPlay, level);
  if (options.length === 0) return [];

  const rankCounts = getHandRankCounts(hand);

  let scored: { play: Play; score: number }[];
  if (lastPlay === null) {
    scored = options.map((p) => ({
      play: p,
      score: scoreLeadPlay(p, rankCounts, level)
    }));
  } else {
    scored = options.map((p) => ({
      play: p,
      score: scoreFollowPlay(p, rankCounts, level, lastPlay)
    }));
  }

  // 升序排列：得分越低越优秀
  scored.sort((a, b) => a.score - b.score);

  // 去重：同牌型、相同手牌点数组合的等价解保留最优代表（避免循环提示多次出现重复牌面）
  const seen = new Set<string>();
  const results: Play[] = [];

  for (const item of scored) {
    const p = item.play;
    const sortedRanks = p.cards.map((c) => c.rank).sort().join(',');
    const wildCount = p.cards.filter((c) => isWildcard(c, level)).length;
    const key = `${p.type}:${p.rank}:${p.size}:${sortedRanks}:${wildCount}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(p);
    }
  }

  return results;
}

/** 返回要出的牌，或 null 表示过。 */
export function chooseBotPlay(context: BotContext): Card[] | null {
  const { hand, lastPlay, isLastPlayFromPartner, partnerHandSize, level } = context;

  // 1. 队友领先时不抢，把牌权留给队友
  if (lastPlay !== null && isLastPlayFromPartner) {
    return null;
  }

  const ranked = getRankedHintPlays(context);
  if (ranked.length === 0) return null;

  const rankCounts = getHandRankCounts(hand);

  // 2. 主动领出新一墩
  if (lastPlay === null) {
    // 优先选择不拆炸弹的最优动作
    const nonSplitting = ranked.filter((p) => !isSplittingBomb(p, rankCounts));
    return (nonSplitting[0] ?? ranked[0]!).cards;
  }

  // 3. 应手跟牌
  // 3.1 优先使用不拆炸弹的非炸弹正常牌型
  const safeNonBombs = ranked.filter(
    (p) => !BOMB_TYPES.has(p.type) && !isSplittingBomb(p, rankCounts)
  );
  if (safeNonBombs.length > 0) {
    return safeNonBombs[0]!.cards;
  }

  // 3.2 队友快出完（剩 2 张及以内），没必要用炸弹抢这一墩
  if (partnerHandSize <= 2) {
    return null;
  }

  const bombs = ranked.filter((p) => BOMB_TYPES.has(p.type));
  if (bombs.length === 0) return null;

  // 关键时刻（自身手牌 <= 6 进入斩杀线）或对手出的已经是炸弹时，出最小炸弹抢回主动权
  const isCriticalMoment = hand.length <= 6 || BOMB_TYPES.has(lastPlay.type);
  if (!isCriticalMoment) return null;

  return bombs[0]!.cards;
}

function scoreLeadPlay(
  play: Play,
  rankCounts: Map<Rank, number>,
  level: Rank
): number {
  let score = 0;

  // 拆炸弹惩罚（极其严重）
  if (isSplittingBomb(play, rankCounts)) {
    score += 50000;
  }

  // 逢人配（红桃级牌）保护：严禁浪费在散单张或散对子上
  const wildcardCount = play.cards.filter((c) => isWildcard(c, level)).length;
  if (wildcardCount > 0) {
    if (play.type === 'single') score += 40000;
    else if (play.type === 'pair') score += 20000;
    else if (play.type === 'triple') score += 10000;
  }

  // 拆其他成套牌惩罚
  if (play.type === 'single') {
    const count = rankCounts.get(play.rank) ?? 1;
    if (count === 3) score += 3000; // 拆三张
    else if (count === 2) score += 1500; // 拆对子

    // 高价值大牌保留（避免首出直接送掉级牌/王/A）
    const val = compareValue(play.rank, level);
    if (val >= 13) score += 1200;
  } else if (play.type === 'pair') {
    const count = rankCounts.get(play.rank) ?? 2;
    if (count === 3) score += 800; // 把三张拆成对子
    const val = compareValue(play.rank, level);
    if (val >= 13) score += 600;
  }

  // 炸弹在主动出牌时作为压轴大招，排在常规牌型之后（除非只剩炸弹）
  if (BOMB_TYPES.has(play.type)) {
    return 10000 + (play.size * 100) + compareValue(play.rank, level);
  }

  // 牌型基础优先级：多张组合连套牌优先甩出，快速减轻手牌负担！
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

function scoreFollowPlay(
  play: Play,
  rankCounts: Map<Rank, number>,
  level: Rank,
  lastPlay: Play | null
): number {
  let score = 0;
  const isBomb = BOMB_TYPES.has(play.type);
  const lastIsBomb = lastPlay ? BOMB_TYPES.has(lastPlay.type) : false;

  // 拆炸弹惩罚
  if (isSplittingBomb(play, rankCounts)) {
    score += 50000;
  }

  // 逢人配惩罚
  const wildcardCount = play.cards.filter((c) => isWildcard(c, level)).length;
  if (wildcardCount > 0) {
    if (play.type === 'single') score += 40000;
    else if (play.type === 'pair') score += 20000;
    else if (play.type === 'triple') score += 10000;
  }

  if (isBomb) {
    // 若上家出的不是炸弹，开炸属于强行控场，排在常规应手牌之后
    if (!lastIsBomb) {
      score += 15000;
    }
    // 炸弹按尺寸和点数从小到大排序
    score += play.size * 100 + compareValue(play.rank, level);
    return score;
  }

  // 非炸弹应手：避免拆牌
  if (play.type === 'single') {
    const count = rankCounts.get(play.rank) ?? 1;
    if (count >= 3) score += 3000;
    else if (count === 2) score += 1500;
  } else if (play.type === 'pair') {
    const count = rankCounts.get(play.rank) ?? 2;
    if (count === 3) score += 800;
  }

  // 选用尽量小的牌压过（按点数递增，保留大牌）
  score += compareValue(play.rank, level);

  return score;
}
