import { describe, expect, it } from 'vitest';
import { compareValue, createDeck, shapeIndex } from '../src/deck.js';

describe('createDeck', () => {
  it('生成 108 张牌（两副牌 + 4 张王）', () => {
    expect(createDeck()).toHaveLength(108);
  });

  it('每个点数每种花色恰好 2 张', () => {
    const deck = createDeck();
    const spadeThrees = deck.filter((c) => c.suit === 'spade' && c.rank === '3');
    expect(spadeThrees).toHaveLength(2);
  });

  it('大小王各 2 张', () => {
    const deck = createDeck();
    expect(deck.filter((c) => c.rank === 'small_joker')).toHaveLength(2);
    expect(deck.filter((c) => c.rank === 'big_joker')).toHaveLength(2);
  });
});

describe('shapeIndex', () => {
  it('2~A 按顺序递增', () => {
    expect(shapeIndex('2')).toBeLessThan(shapeIndex('3'));
    expect(shapeIndex('K')).toBeLessThan(shapeIndex('A'));
  });

  it('王牌没有形状序', () => {
    expect(() => shapeIndex('small_joker')).toThrow();
  });
});

describe('compareValue', () => {
  const level = '2';

  it('级牌高于 A，低于王', () => {
    expect(compareValue('2', level)).toBeGreaterThan(compareValue('A', level));
    expect(compareValue('small_joker', level)).toBeGreaterThan(compareValue('2', level));
  });

  it('大王高于小王', () => {
    expect(compareValue('big_joker', level)).toBeGreaterThan(compareValue('small_joker', level));
  });

  it('非级牌按自然点数排序', () => {
    expect(compareValue('7', level)).toBeGreaterThan(compareValue('5', level));
  });
});
