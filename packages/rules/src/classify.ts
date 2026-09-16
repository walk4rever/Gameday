import { compareValue } from './deck.js';
import {
  consecutiveGroupInfo,
  groupByRank,
  isSameSuit,
  isWildcard,
  straightInfo,
  straightWindows,
  triplePairWindows,
  tripleStraightWindows
} from './shape.js';
import type { Card, Play, PlayType, Rank } from './types.js';
import { comparePlays } from './compare.js';

/**
 * 判定一组牌是否构成合法牌型。
 * 当提供 level 时，支持红桃级牌作为「逢人配」万能百搭牌（可代替除大王小王外的任意牌）。
 */
export function classifyPlay(cards: Card[], level?: Rank): Play | null {
  if (cards.length === 0) return null;

  const naturalPlay = classifyNatural(cards);
  if (!level) return naturalPlay;

  const wildcards = cards.filter((c) => isWildcard(c, level));
  if (wildcards.length === 0) return naturalPlay;

  const wildcardPlay = classifyWildcard(cards, wildcards, level);

  if (!naturalPlay) return wildcardPlay;
  if (!wildcardPlay) return naturalPlay;

  // 两种方式均可成型时，优先选取牌力更大者（例如同花顺优于普通顺子，或炸弹优于散牌）
  const cmp = comparePlays(wildcardPlay, naturalPlay, level);
  return cmp !== null && cmp >= 0 ? wildcardPlay : naturalPlay;
}

/** 传统原生牌型判定（不使用万能百搭牌功能） */
function classifyNatural(cards: Card[]): Play | null {
  if (cards.length === 0) return null;
  if (isFourJokers(cards)) {
    return { type: 'fourJokers', cards, rank: 'big_joker', size: 4 };
  }

  const groups = groupByRank(cards);
  const ranks = Object.keys(groups) as Rank[];

  if (cards.length === 1) {
    return { type: 'single', cards, rank: cards[0]!.rank, size: 1 };
  }

  if (cards.length === 2) {
    return isSingleRankOfSize(groups, ranks, 2)
      ? { type: 'pair', cards, rank: ranks[0]!, size: 2 }
      : null;
  }

  if (cards.length === 3) {
    return isSingleRankOfSize(groups, ranks, 3)
      ? { type: 'triple', cards, rank: ranks[0]!, size: 3 }
      : null;
  }

  if (cards.length === 4) {
    return isSingleRankOfSize(groups, ranks, 4)
      ? { type: 'bomb', cards, rank: ranks[0]!, size: 4 }
      : null;
  }

  if (cards.length === 5) {
    return (
      classifyTripleWithPair(groups, ranks, cards) ??
      classifyStraight(cards) ??
      (isSingleRankOfSize(groups, ranks, 5)
        ? { type: 'bomb', cards, rank: ranks[0]!, size: 5 }
        : null)
    );
  }

  if (cards.length === 6) {
    return (
      (isSingleRankOfSize(groups, ranks, 6)
        ? { type: 'bomb', cards, rank: ranks[0]!, size: 6 }
        : null) ?? classifyTriplePairs(cards) ?? classifyTripleStraight(cards)
    );
  }

  if (cards.length === 7 || cards.length === 8) {
    return isSingleRankOfSize(groups, ranks, cards.length)
      ? { type: 'bomb', cards, rank: ranks[0]!, size: cards.length }
      : null;
  }

  return null;
}

/** 逢人配百搭牌牌型合成判定 */
function classifyWildcard(cards: Card[], wildcards: Card[], level: Rank): Play | null {
  const nats = cards.filter((c) => !isWildcard(c, level));
  const W = wildcards.length;

  // 逢人配规则：绝对不能配大王或小王
  if (nats.some((c) => c.rank === 'small_joker' || c.rank === 'big_joker')) {
    return null;
  }

  // 纯逢人配（无其它散牌）
  if (nats.length === 0) {
    if (W === 1) return { type: 'single', cards, rank: level, size: 1 };
    if (W === 2) return { type: 'pair', cards, rank: level, size: 2 };
    return null;
  }

  const len = cards.length;

  // 2 张牌：对子
  if (len === 2) {
    return { type: 'pair', cards, rank: nats[0]!.rank, size: 2 };
  }

  // 3 张牌：三张
  if (len === 3) {
    const r = nats[0]!.rank;
    if (nats.every((c) => c.rank === r)) {
      return { type: 'triple', cards, rank: r, size: 3 };
    }
    return null;
  }

  // 4 张牌：4张炸弹
  if (len === 4) {
    const r = nats[0]!.rank;
    if (nats.every((c) => c.rank === r)) {
      return { type: 'bomb', cards, rank: r, size: 4 };
    }
    return null;
  }

  // 5 张牌：同花顺 > 5张炸弹 > 三带二 > 顺子
  if (len === 5) {
    // 1. 同花顺
    const firstSuit = nats[0]!.suit;
    if (nats.every((c) => c.suit === firstSuit)) {
      const natRanks = nats.map((c) => c.rank);
      if (new Set(natRanks).size === natRanks.length) {
        const matchingWins = straightWindows().filter((win) =>
          natRanks.every((r) => win.ranks.includes(r))
        );
        if (matchingWins.length > 0) {
          const best = matchingWins[matchingWins.length - 1]!;
          return {
            type: 'straightFlush',
            cards,
            rank: best.topRank,
            size: 5,
            orderKey: best.orderKey
          };
        }
      }
    }

    // 2. 5张炸弹
    const r = nats[0]!.rank;
    if (nats.every((c) => c.rank === r)) {
      return { type: 'bomb', cards, rank: r, size: 5 };
    }

    // 3. 三带二
    const groups = groupByRank(nats);
    const distinctRanks = Object.keys(groups) as Rank[];
    if (distinctRanks.length === 2) {
      const [r1, r2] = distinctRanks as [Rank, Rank];
      const c1 = groups[r1]!.length;
      const c2 = groups[r2]!.length;

      const opt1Valid = c1 <= 3 && c2 <= 2 && (3 - c1) + (2 - c2) === W;
      const opt2Valid = c2 <= 3 && c1 <= 2 && (3 - c2) + (2 - c1) === W;

      if (opt1Valid && opt2Valid) {
        const tripleRank = compareValue(r1, level) > compareValue(r2, level) ? r1 : r2;
        return { type: 'tripleWithPair', cards, rank: tripleRank, size: 5 };
      }
      if (opt1Valid) return { type: 'tripleWithPair', cards, rank: r1, size: 5 };
      if (opt2Valid) return { type: 'tripleWithPair', cards, rank: r2, size: 5 };
    }

    // 4. 顺子
    const natRanks = nats.map((c) => c.rank);
    if (new Set(natRanks).size === natRanks.length) {
      const matchingWins = straightWindows().filter((win) =>
        natRanks.every((r) => win.ranks.includes(r))
      );
      if (matchingWins.length > 0) {
        const best = matchingWins[matchingWins.length - 1]!;
        return {
          type: 'straight',
          cards,
          rank: best.topRank,
          size: 5,
          orderKey: best.orderKey
        };
      }
    }

    return null;
  }

  // 6 张牌：6张炸弹 > 钢板 > 木板
  if (len === 6) {
    // 1. 6张炸弹
    const r = nats[0]!.rank;
    if (nats.every((c) => c.rank === r)) {
      return { type: 'bomb', cards, rank: r, size: 6 };
    }

    // 2. 钢板 (三同连张: 2 连 3 张)
    const groups = groupByRank(nats);
    const steelMatches = tripleStraightWindows().filter((win) => {
      const [r1, r2] = win.ranks;
      if (!nats.every((c) => c.rank === r1 || c.rank === r2)) return false;
      const c1 = groups[r1]?.length ?? 0;
      const c2 = groups[r2]?.length ?? 0;
      return c1 <= 3 && c2 <= 3 && (3 - c1) + (3 - c2) === W;
    });
    if (steelMatches.length > 0) {
      const best = steelMatches[steelMatches.length - 1]!;
      return {
        type: 'tripleStraight',
        cards,
        rank: best.topRank,
        size: 6,
        orderKey: best.orderKey
      };
    }

    // 3. 木板 (三连对: 3 连 2 张)
    const woodMatches = triplePairWindows().filter((win) => {
      const [r1, r2, r3] = win.ranks;
      if (!nats.every((c) => c.rank === r1 || c.rank === r2 || c.rank === r3)) return false;
      const c1 = groups[r1]?.length ?? 0;
      const c2 = groups[r2]?.length ?? 0;
      const c3 = groups[r3]?.length ?? 0;
      return c1 <= 2 && c2 <= 2 && c3 <= 2 && (2 - c1) + (2 - c2) + (2 - c3) === W;
    });
    if (woodMatches.length > 0) {
      const best = woodMatches[woodMatches.length - 1]!;
      return {
        type: 'triplePairs',
        cards,
        rank: best.topRank,
        size: 6,
        orderKey: best.orderKey
      };
    }

    return null;
  }

  // 7 张牌：7张炸弹
  if (len === 7) {
    const r = nats[0]!.rank;
    if (nats.every((c) => c.rank === r)) {
      return { type: 'bomb', cards, rank: r, size: 7 };
    }
    return null;
  }

  // 8 张牌：8张炸弹
  if (len === 8) {
    const r = nats[0]!.rank;
    if (nats.every((c) => c.rank === r)) {
      return { type: 'bomb', cards, rank: r, size: 8 };
    }
    return null;
  }

  return null;
}

function isSingleRankOfSize(
  groups: Partial<Record<Rank, Card[]>>,
  ranks: Rank[],
  size: number
): boolean {
  return ranks.length === 1 && groups[ranks[0]!]!.length === size;
}

function classifyTripleWithPair(
  groups: Partial<Record<Rank, Card[]>>,
  ranks: Rank[],
  cards: Card[]
): Play | null {
  if (ranks.length !== 2) return null;
  const [r1, r2] = ranks as [Rank, Rank];
  const c1 = groups[r1]!.length;
  const c2 = groups[r2]!.length;
  if (c1 === 3 && c2 === 2) return { type: 'tripleWithPair', cards, rank: r1, size: 5 };
  if (c2 === 3 && c1 === 2) return { type: 'tripleWithPair', cards, rank: r2, size: 5 };
  return null;
}

function classifyStraight(cards: Card[]): Play | null {
  const info = straightInfo(cards);
  if (!info) return null;
  const type: PlayType = isSameSuit(cards) ? 'straightFlush' : 'straight';
  return { type, cards, rank: info.topRank, size: 5, orderKey: info.orderKey };
}

function classifyTriplePairs(cards: Card[]): Play | null {
  const info = consecutiveGroupInfo(cards, 2, 3);
  return info
    ? { type: 'triplePairs', cards, rank: info.topRank, size: 6, orderKey: info.orderKey }
    : null;
}

function classifyTripleStraight(cards: Card[]): Play | null {
  const info = consecutiveGroupInfo(cards, 3, 2);
  return info
    ? { type: 'tripleStraight', cards, rank: info.topRank, size: 6, orderKey: info.orderKey }
    : null;
}

function isFourJokers(cards: Card[]): boolean {
  if (cards.length !== 4) return false;
  const smallCount = cards.filter((c) => c.rank === 'small_joker').length;
  const bigCount = cards.filter((c) => c.rank === 'big_joker').length;
  return smallCount === 2 && bigCount === 2;
}
