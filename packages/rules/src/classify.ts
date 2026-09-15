import { consecutiveGroupInfo, groupByRank, isSameSuit, straightInfo } from './shape.js';
import type { Card, Play, PlayType, Rank } from './types.js';

/** 判定一组牌是否构成合法牌型，不考虑逢人配（见 RULES_SPEC.md 第 5 节）。 */
export function classifyPlay(cards: Card[]): Play | null {
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
  return { type, cards, rank: info.topRank, size: 5 };
}

function classifyTriplePairs(cards: Card[]): Play | null {
  const info = consecutiveGroupInfo(cards, 2, 3);
  return info ? { type: 'triplePairs', cards, rank: info.topRank, size: 6 } : null;
}

function classifyTripleStraight(cards: Card[]): Play | null {
  const info = consecutiveGroupInfo(cards, 3, 2);
  return info ? { type: 'tripleStraight', cards, rank: info.topRank, size: 6 } : null;
}

function isFourJokers(cards: Card[]): boolean {
  if (cards.length !== 4) return false;
  const smallCount = cards.filter((c) => c.rank === 'small_joker').length;
  const bigCount = cards.filter((c) => c.rank === 'big_joker').length;
  return smallCount === 2 && bigCount === 2;
}
