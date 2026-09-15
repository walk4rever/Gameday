import { createDeck } from '@guandan/rules';
import { describe, expect, it } from 'vitest';
import { dealHands, shuffleDeck } from '../src/deal.js';

describe('shuffleDeck', () => {
  it('不修改传入的数组，返回同样张数的新数组', () => {
    const deck = createDeck();
    const original = [...deck];
    const shuffled = shuffleDeck(deck);
    expect(deck).toEqual(original);
    expect(shuffled).toHaveLength(deck.length);
  });

  it('打乱后仍然是同一组牌（按 id 比较）', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect([...shuffled].map((c) => c.id).sort()).toEqual([...deck].map((c) => c.id).sort());
  });
});

describe('dealHands', () => {
  it('108 张牌均分给 4 个座位，每人 27 张', () => {
    const hands = dealHands(createDeck());
    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(27);
    }
  });

  it('每张牌恰好分给一个座位', () => {
    const deck = createDeck();
    const hands = dealHands(deck);
    const dealtIds = hands.flat().map((c) => c.id).sort();
    expect(dealtIds).toEqual(deck.map((c) => c.id).sort());
  });
});
