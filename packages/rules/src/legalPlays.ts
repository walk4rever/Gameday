import { classifyPlay } from './classify.js';
import { comparePlays } from './compare.js';
import {
  groupByRank,
  isWildcard,
  straightWindows,
  triplePairWindows,
  tripleStraightWindows
} from './shape.js';
import type { Card, Play, Rank, Suit } from './types.js';

/**
 * 手牌中所有能压过 lastPlay 的合法出牌方式；lastPlay 为 null 表示新一轮，任意合法牌型都可以出。
 * 全面支持「逢人配」红桃级牌百搭逻辑。
 */
export function getLegalPlays(hand: Card[], lastPlay: Play | null, level: Rank): Play[] {
  const candidates = generateCandidatePlays(hand, level);
  if (lastPlay === null) return candidates;
  return candidates.filter((candidate) => {
    const result = comparePlays(candidate, lastPlay, level);
    return result !== null && result > 0;
  });
}

function playKey(play: Play): string {
  const cardKey = play.cards.map((c) => c.id).sort().join(',');
  return `${play.type}:${play.size}:${play.rank}:${cardKey}`;
}

export function generateCandidatePlays(hand: Card[], level: Rank): Play[] {
  const plays: Play[] = [];
  const seen = new Set<string>();

  const addPlay = (play: Play | null) => {
    if (!play) return;
    const key = playKey(play);
    if (!seen.has(key)) {
      seen.add(key);
      plays.push(play);
    }
  };

  const groups = groupByRank(hand);

  // 1. 自然牌型枚举
  for (const cards of Object.values(groups)) {
    for (const slice of singlesAndGroupsForRank(cards ?? [])) {
      addPlay(classifyPlay(slice, level));
    }
  }

  for (const play of tripleWithPairCandidates(groups, level)) {
    addPlay(play);
  }
  for (const play of straightCandidates(groups, level)) {
    addPlay(play);
  }
  for (const play of consecutiveGroupCandidates(groups, 2, 3, level)) {
    addPlay(play);
  }
  for (const play of consecutiveGroupCandidates(groups, 3, 2, level)) {
    addPlay(play);
  }

  const fourJokers = fourJokersCandidate(hand, level);
  if (fourJokers) addPlay(fourJokers);

  // 2. 逢人配百搭枚举
  const wildcards = hand.filter((c) => isWildcard(c, level));
  if (wildcards.length > 0) {
    generateWildcardCandidates(hand, wildcards, level, addPlay);
  }

  return plays;
}

function generateWildcardCandidates(
  hand: Card[],
  wildcards: Card[],
  level: Rank,
  addPlay: (p: Play | null) => void
): void {
  const nonWildcards = hand.filter((c) => !isWildcard(c, level));
  const groups = groupByRank(nonWildcards);
  const ranks = (Object.keys(groups) as Rank[]).filter(
    (r) => r !== 'small_joker' && r !== 'big_joker'
  );

  const w1 = wildcards[0]!;
  const w2 = wildcards.length >= 2 ? wildcards[1]! : null;

  // 逢人配配对子
  for (const r of ranks) {
    const c = groups[r]![0]!;
    addPlay(classifyPlay([c, w1], level));
  }

  // 逢人配配三张
  for (const r of ranks) {
    const list = groups[r]!;
    if (list.length >= 2) {
      addPlay(classifyPlay([list[0]!, list[1]!, w1], level));
    }
    if (list.length >= 1 && w2) {
      addPlay(classifyPlay([list[0]!, w1, w2], level));
    }
  }

  // 逢人配配炸弹 (4~8张)
  for (const r of ranks) {
    const list = groups[r]!;
    // 用 1 张百搭
    for (let count = 3; count <= Math.min(list.length, 7); count++) {
      addPlay(classifyPlay([...list.slice(0, count), w1], level));
    }
    // 用 2 张百搭
    if (w2) {
      for (let count = 2; count <= Math.min(list.length, 6); count++) {
        addPlay(classifyPlay([...list.slice(0, count), w1, w2], level));
      }
    }
  }

  // 逢人配配三带二
  for (const r1 of ranks) {
    const list1 = groups[r1]!;
    for (const r2 of ranks) {
      if (r1 === r2) continue;
      const list2 = groups[r2]!;
      // 模式 A: r1 有 2 张 (配成三张) + r2 有 2 张对子
      if (list1.length >= 2 && list2.length >= 2) {
        addPlay(classifyPlay([list1[0]!, list1[1]!, w1, list2[0]!, list2[1]!], level));
      }
      // 模式 B: r1 有 3 张 + r2 有 1 张 (配成对子)
      if (list1.length >= 3 && list2.length >= 1) {
        addPlay(classifyPlay([list1[0]!, list1[1]!, list1[2]!, list2[0]!, w1], level));
      }
      // 模式 C: 用两张百搭 (r1 有 2 张配三张 + r2 有 1 张配对子)
      if (w2 && list1.length >= 2 && list2.length >= 1) {
        addPlay(classifyPlay([list1[0]!, list1[1]!, w1, list2[0]!, w2], level));
      }
    }
  }

  // 逢人配配顺子与同花顺 (5张)
  for (const win of straightWindows()) {
    const available = win.ranks.map((r) => groups[r] ?? []);
    const presentCount = available.filter((l) => l.length > 0).length;
    const missing = 5 - presentCount;

    if (missing === 1 && wildcards.length >= 1) {
      const presentCards = available.filter((l) => l.length > 0).map((l) => l[0]!);
      addPlay(classifyPlay([...presentCards, w1], level));
    } else if (missing === 2 && w2) {
      const presentCards = available.filter((l) => l.length > 0).map((l) => l[0]!);
      addPlay(classifyPlay([...presentCards, w1, w2], level));
    }

    // 同花顺专属检测
    const suits: Suit[] = ['spade', 'heart', 'club', 'diamond'];
    for (const suit of suits) {
      const suitAvailable = win.ranks.map(
        (r) => (groups[r] ?? []).filter((c) => c.suit === suit)
      );
      const suitPresentCount = suitAvailable.filter((l) => l.length > 0).length;
      const suitMissing = 5 - suitPresentCount;

      if (suitMissing === 1 && wildcards.length >= 1) {
        const presentSuitCards = suitAvailable.filter((l) => l.length > 0).map((l) => l[0]!);
        addPlay(classifyPlay([...presentSuitCards, w1], level));
      } else if (suitMissing === 2 && w2) {
        const presentSuitCards = suitAvailable.filter((l) => l.length > 0).map((l) => l[0]!);
        addPlay(classifyPlay([...presentSuitCards, w1, w2], level));
      }
    }
  }

  // 逢人配配钢板 (2 连 3 张)
  for (const win of tripleStraightWindows()) {
    const [r1, r2] = win.ranks;
    const l1 = groups[r1] ?? [];
    const l2 = groups[r2] ?? [];
    for (let c1 = Math.max(0, 3 - wildcards.length); c1 <= Math.min(3, l1.length); c1++) {
      const need1 = 3 - c1;
      const need2 = 3 - Math.min(3, l2.length);
      if (need1 + need2 <= wildcards.length && l2.length >= 3 - (wildcards.length - need1)) {
        const c2 = 3 - (wildcards.length - need1);
        if (c2 >= 0 && c2 <= l2.length) {
          const usedWildcards = wildcards.slice(0, need1 + (3 - c2));
          if (usedWildcards.length === (3 - c1) + (3 - c2)) {
            addPlay(classifyPlay([...l1.slice(0, c1), ...l2.slice(0, c2), ...usedWildcards], level));
          }
        }
      }
    }
  }

  // 逢人配配三连对 (3 连 2 张)
  for (const win of triplePairWindows()) {
    const [r1, r2, r3] = win.ranks;
    const l1 = groups[r1] ?? [];
    const l2 = groups[r2] ?? [];
    const l3 = groups[r3] ?? [];
    const needed = (2 - Math.min(2, l1.length)) + (2 - Math.min(2, l2.length)) + (2 - Math.min(2, l3.length));
    if (needed <= wildcards.length) {
      const take1 = Math.min(2, l1.length);
      const take2 = Math.min(2, l2.length);
      const take3 = Math.min(2, l3.length);
      const usedWildcards = wildcards.slice(0, (2 - take1) + (2 - take2) + (2 - take3));
      addPlay(classifyPlay([...l1.slice(0, take1), ...l2.slice(0, take2), ...l3.slice(0, take3), ...usedWildcards], level));
    }
  }
}

function singlesAndGroupsForRank(cards: Card[]): Card[][] {
  const slices: Card[][] = [];
  if (cards.length >= 1) slices.push(cards.slice(0, 1));
  if (cards.length >= 2) slices.push(cards.slice(0, 2));
  if (cards.length >= 3) slices.push(cards.slice(0, 3));
  for (let size = 4; size <= cards.length; size++) {
    slices.push(cards.slice(0, size));
  }
  return slices;
}

function tripleWithPairCandidates(groups: Partial<Record<Rank, Card[]>>, level: Rank): Play[] {
  const ranks = Object.keys(groups) as Rank[];
  const plays: Play[] = [];
  for (const tripleRank of ranks) {
    const tripleCards = groups[tripleRank] ?? [];
    if (tripleCards.length < 3) continue;
    for (const pairRank of ranks) {
      if (pairRank === tripleRank) continue;
      const pairCards = groups[pairRank] ?? [];
      if (pairCards.length < 2) continue;
      const play = classifyPlay([...tripleCards.slice(0, 3), ...pairCards.slice(0, 2)], level);
      if (play) plays.push(play);
    }
  }
  return plays;
}

function straightCandidates(groups: Partial<Record<Rank, Card[]>>, level: Rank): Play[] {
  const plays: Play[] = [];
  const seen = new Set<string>();
  for (const window of straightWindows()) {
    const optionsPerRank = window.ranks.map((rank) => groups[rank] ?? []);
    if (optionsPerRank.some((options) => options.length === 0)) continue;
    for (const combo of cartesianProduct(optionsPerRank)) {
      const play = classifyPlay(combo, level);
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
  groupCount: number,
  level: Rank
): Play[] {
  const plays: Play[] = [];
  const windows = groupSize === 2 ? triplePairWindows() : tripleStraightWindows();
  for (const window of windows) {
    if (window.ranks.some((rank) => (groups[rank] ?? []).length < groupSize)) continue;
    const cards = window.ranks.flatMap((rank) => (groups[rank] ?? []).slice(0, groupSize));
    const play = classifyPlay(cards, level);
    if (play) plays.push(play);
  }
  return plays;
}

function fourJokersCandidate(hand: Card[], level: Rank): Play | null {
  const smalls = hand.filter((card) => card.rank === 'small_joker');
  const bigs = hand.filter((card) => card.rank === 'big_joker');
  if (smalls.length < 2 || bigs.length < 2) return null;
  return classifyPlay([...smalls.slice(0, 2), ...bigs.slice(0, 2)], level);
}
