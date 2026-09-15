import type { Card } from '@guandan/rules';

/** 不改动传入的 deck，返回新数组。 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/** 108 张牌轮流发给 4 个座位，每人 27 张。传入的 deck 需已经洗好。 */
export function dealHands(deck: Card[]): [Card[], Card[], Card[], Card[]] {
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  deck.forEach((card, i) => {
    hands[(i % 4) as 0 | 1 | 2 | 3]!.push(card);
  });
  return hands;
}
