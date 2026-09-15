export type Suit = 'spade' | 'heart' | 'club' | 'diamond' | 'joker';

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A'
  | 'small_joker' | 'big_joker';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export type PlayType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'tripleWithPair'
  | 'straight'
  | 'triplePairs'
  | 'tripleStraight'
  | 'bomb'
  | 'straightFlush'
  | 'fourJokers';

export interface Play {
  type: PlayType;
  cards: Card[];
  /** 用于 UI 展示的主点数（顺子/连对/连三取最高牌，其余取主点数）。跨类型比较不要依赖它，见 compare.ts */
  rank: Rank;
  size: number;
}
