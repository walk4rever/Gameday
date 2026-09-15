import type { Card, Rank, Suit } from './types.js';

export const SHAPE_RANKS: Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
];

const SUITS: Suit[] = ['spade', 'heart', 'club', 'diamond'];

/** 形状序：用于组成顺子/三连对/三同连张，级牌不特殊。王牌没有形状序。 */
export function shapeIndex(rank: Rank): number {
  const idx = SHAPE_RANKS.indexOf(rank);
  if (idx === -1) {
    throw new Error(`${rank} 没有形状序，不能用于组成顺子/连对/连三`);
  }
  return idx;
}

/** 比较序：用于单张/对子/三张/三带二/炸弹之间比大小，级牌插入 A 和王之间。 */
export function compareValue(rank: Rank, level: Rank): number {
  if (rank === 'big_joker') return 15;
  if (rank === 'small_joker') return 14;
  if (rank === level) return 13;
  return shapeIndex(rank);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of SHAPE_RANKS) {
        deck.push({ suit, rank, id: `${suit}-${rank}-${copy}` });
      }
    }
    deck.push({ suit: 'joker', rank: 'small_joker', id: `joker-small-${copy}` });
    deck.push({ suit: 'joker', rank: 'big_joker', id: `joker-big-${copy}` });
  }
  return deck;
}
