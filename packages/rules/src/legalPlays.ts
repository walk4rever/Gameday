import { classifyPlay } from './classify.js';
import { comparePlays } from './compare.js';
import { SHAPE_RANKS } from './deck.js';
import { groupByRank } from './shape.js';
import type { Card, Play, Rank } from './types.js';

/**
 * 手牌中所有能压过 lastPlay 的合法出牌方式；lastPlay 为 null 表示新一轮，任意合法牌型都可以出。
 * 不考虑逢人配（RULES_SPEC.md 第 5 节，延后实现）。
 */
export function getLegalPlays(hand: Card[], lastPlay: Play | null, level: Rank): Play[] {
  const candidates = generateCandidatePlays(hand);
  if (lastPlay === null) return candidates;
  return candidates.filter((candidate) => {
    const result = comparePlays(candidate, lastPlay, level);
    return result !== null && result > 0;
  });
}

function generateCandidatePlays(hand: Card[]): Play[] {
  const groups = groupByRank(hand);
  const plays: Play[] = [];

  for (const cards of Object.values(groups)) {
    plays.push(...singlesAndGroupsForRank(cards ?? []));
  }

  plays.push(...tripleWithPairCandidates(groups));
  plays.push(...straightCandidates(groups));
  plays.push(...consecutiveGroupCandidates(groups, 2, 3));
  plays.push(...consecutiveGroupCandidates(groups, 3, 2));

  const fourJokers = fourJokersCandidate(hand);
  if (fourJokers) plays.push(fourJokers);

  return plays;
}

function singlesAndGroupsForRank(cards: Card[]): Play[] {
  const slices: Card[][] = [];
  if (cards.length >= 1) slices.push(cards.slice(0, 1));
  if (cards.length >= 2) slices.push(cards.slice(0, 2));
  if (cards.length >= 3) slices.push(cards.slice(0, 3));
  for (let size = 4; size <= cards.length; size++) {
    slices.push(cards.slice(0, size));
  }
  return slices.map((slice) => classifyPlay(slice)).filter((play): play is Play => play !== null);
}

function tripleWithPairCandidates(groups: Partial<Record<Rank, Card[]>>): Play[] {
  const ranks = Object.keys(groups) as Rank[];
  const plays: Play[] = [];
  for (const tripleRank of ranks) {
    const tripleCards = groups[tripleRank] ?? [];
    if (tripleCards.length < 3) continue;
    for (const pairRank of ranks) {
      if (pairRank === tripleRank) continue;
      const pairCards = groups[pairRank] ?? [];
      if (pairCards.length < 2) continue;
      const play = classifyPlay([...tripleCards.slice(0, 3), ...pairCards.slice(0, 2)]);
      if (play) plays.push(play);
    }
  }
  return plays;
}

function straightWindows(): Rank[][] {
  const windows: Rank[][] = [];
  for (let i = 0; i + 5 <= SHAPE_RANKS.length; i++) {
    windows.push(SHAPE_RANKS.slice(i, i + 5));
  }
  windows.push(['A', '2', '3', '4', '5']);
  return windows;
}

function straightCandidates(groups: Partial<Record<Rank, Card[]>>): Play[] {
  const plays: Play[] = [];
  const seen = new Set<string>();
  for (const window of straightWindows()) {
    const optionsPerRank = window.map((rank) => groups[rank] ?? []);
    if (optionsPerRank.some((options) => options.length === 0)) continue;
    for (const combo of cartesianProduct(optionsPerRank)) {
      const play = classifyPlay(combo);
      if (!play) continue;
      const key = `${play.type}:${play.rank}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plays.push(play);
    }
  }
  return plays;
}

function cartesianProduct(lists: Card[][]): Card[][] {
  return lists.reduce<Card[][]>(
    (acc, list) => acc.flatMap((combo) => list.map((card) => [...combo, card])),
    [[]]
  );
}

function consecutiveGroupCandidates(
  groups: Partial<Record<Rank, Card[]>>,
  groupSize: number,
  groupCount: number
): Play[] {
  const plays: Play[] = [];
  for (let i = 0; i + groupCount <= SHAPE_RANKS.length; i++) {
    const window = SHAPE_RANKS.slice(i, i + groupCount);
    if (window.some((rank) => (groups[rank] ?? []).length < groupSize)) continue;
    const cards = window.flatMap((rank) => (groups[rank] ?? []).slice(0, groupSize));
    const play = classifyPlay(cards);
    if (play) plays.push(play);
  }
  return plays;
}

function fourJokersCandidate(hand: Card[]): Play | null {
  const smalls = hand.filter((card) => card.rank === 'small_joker');
  const bigs = hand.filter((card) => card.rank === 'big_joker');
  if (smalls.length < 2 || bigs.length < 2) return null;
  return classifyPlay([...smalls.slice(0, 2), ...bigs.slice(0, 2)]);
}
