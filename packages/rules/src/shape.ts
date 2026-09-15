import { SHAPE_RANKS, shapeIndex } from './deck.js';
import type { Card, Rank } from './types.js';

export function groupByRank(cards: Card[]): Partial<Record<Rank, Card[]>> {
  const groups: Partial<Record<Rank, Card[]>> = {};
  for (const card of cards) {
    const existing = groups[card.rank] ?? [];
    groups[card.rank] = [...existing, card];
  }
  return groups;
}

export function isSameSuit(cards: Card[]): boolean {
  const [first] = cards;
  return first !== undefined && cards.every((card) => card.suit === first.suit);
}

function isJokerRank(rank: Rank): boolean {
  return rank === 'small_joker' || rank === 'big_joker';
}

export interface ShapeInfo {
  orderKey: number;
  topRank: Rank;
}

/** 5 张互不相同点数的牌是否构成顺子（含 A2345 特例）。 */
export function straightInfo(cards: Card[]): ShapeInfo | null {
  if (cards.length !== 5) return null;
  const ranks = cards.map((card) => card.rank);
  if (new Set(ranks).size !== 5) return null;
  if (ranks.some(isJokerRank)) return null;

  const indices = ranks.map(shapeIndex).sort((a, b) => a - b);
  const isConsecutive = indices.every((value, i) => i === 0 || value === indices[i - 1]! + 1);
  if (isConsecutive) {
    return { orderKey: indices[0]!, topRank: SHAPE_RANKS[indices[indices.length - 1]!]! };
  }

  const isAceLow = (['A', '2', '3', '4', '5'] as Rank[]).every((r) => ranks.includes(r));
  if (isAceLow) {
    return { orderKey: -1, topRank: '5' };
  }

  return null;
}

/** groupCount 组、每组 groupSize 张、点数连续的组合（三连对 2x3 / 三同连张 3x2）。 */
export function consecutiveGroupInfo(
  cards: Card[],
  groupSize: number,
  groupCount: number
): ShapeInfo | null {
  if (cards.length !== groupSize * groupCount) return null;

  const groups = groupByRank(cards);
  const ranks = Object.keys(groups) as Rank[];
  if (ranks.length !== groupCount) return null;
  if (ranks.some(isJokerRank)) return null;
  if (!ranks.every((rank) => groups[rank]!.length === groupSize)) return null;

  const indices = ranks.map(shapeIndex).sort((a, b) => a - b);
  const isConsecutive = indices.every((value, i) => i === 0 || value === indices[i - 1]! + 1);
  if (!isConsecutive) return null;

  return { orderKey: indices[0]!, topRank: SHAPE_RANKS[indices[indices.length - 1]!]! };
}
