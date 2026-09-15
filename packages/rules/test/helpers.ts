import type { Card, Rank, Suit } from '../src/types.js';

let counter = 0;

export function card(suit: Suit, rank: Rank): Card {
  counter += 1;
  return { suit, rank, id: `${suit}-${rank}-${counter}` };
}

export function cards(suit: Suit, ranks: Rank[]): Card[] {
  return ranks.map((rank) => card(suit, rank));
}
