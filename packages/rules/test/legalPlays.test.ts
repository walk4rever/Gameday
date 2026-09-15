import { describe, expect, it } from 'vitest';
import { classifyPlay } from '../src/classify.js';
import { getLegalPlays } from '../src/legalPlays.js';
import type { Play } from '../src/types.js';
import { card, cards } from './helpers.js';

const level = '2';

describe('getLegalPlays', () => {
  it('新一轮（lastPlay 为 null）时，任意合法牌型都可以出', () => {
    const hand = [card('spade', '5'), card('heart', '9')];
    const legal = getLegalPlays(hand, null, level);
    expect(legal.map((p) => p.type).sort()).toEqual(['single', 'single']);
  });

  it('过滤掉不能压过 lastPlay 的选项', () => {
    const hand = [card('spade', '5'), card('heart', '9'), card('club', 'K')];
    const lastPlay: Play = classifyPlay([card('diamond', '9')])!;
    const legal = getLegalPlays(hand, lastPlay, level);
    expect(legal.every((p) => p.type === 'single')).toBe(true);
    expect(legal.map((p) => p.rank).sort()).toEqual(['K']);
  });

  it('手牌里没有能压过的牌时返回空数组', () => {
    const hand = [card('spade', '3'), card('heart', '4')];
    const lastPlay: Play = classifyPlay([card('diamond', 'A')])!;
    expect(getLegalPlays(hand, lastPlay, level)).toEqual([]);
  });

  it('炸弹可以压过任意非炸弹的 lastPlay，即使张数不同', () => {
    const hand = cards('spade', ['9', '9', '9', '9']);
    const lastPlay: Play = classifyPlay([
      card('diamond', '5'),
      card('club', '6'),
      card('heart', '7'),
      card('spade', '8'),
      card('diamond', '9')
    ])!;
    const legal = getLegalPlays(hand, lastPlay, level);
    expect(legal).toHaveLength(1);
    expect(legal[0]?.type).toBe('bomb');
  });

  it('能枚举出对子候选', () => {
    const hand = [card('spade', '7'), card('heart', '7'), card('club', '3')];
    const legal = getLegalPlays(hand, null, level);
    expect(legal.some((p) => p.type === 'pair' && p.rank === '7')).toBe(true);
  });

  it('能枚举出三带二候选', () => {
    const hand = [...cards('spade', ['9', '9', '9']), ...cards('heart', ['4', '4'])];
    const legal = getLegalPlays(hand, null, level);
    expect(legal.some((p) => p.type === 'tripleWithPair' && p.rank === '9')).toBe(true);
  });

  it('能枚举出顺子候选（跨花色）', () => {
    const hand = [
      card('spade', '5'),
      card('heart', '6'),
      card('club', '7'),
      card('diamond', '8'),
      card('spade', '9')
    ];
    const legal = getLegalPlays(hand, null, level);
    expect(legal.some((p) => p.type === 'straight' && p.rank === '9')).toBe(true);
  });

  it('同一手牌里既能凑出顺子也能凑出同花顺时，两者都枚举', () => {
    // 5~9 同为黑桃，且红桃另有一张 9 备用 —— 可以选同花的 5 张（同花顺），
    // 也可以把 9 换成红桃那张凑出跨花色顺子（普通顺子）
    const hand = [...cards('spade', ['5', '6', '7', '8', '9']), card('heart', '9')];
    const legal = getLegalPlays(hand, null, level);
    expect(legal.some((p) => p.type === 'straightFlush')).toBe(true);
    expect(legal.some((p) => p.type === 'straight')).toBe(true);
  });

  it('能枚举出三连对与三同连张候选', () => {
    const hand = [
      ...cards('spade', ['3', '3']),
      ...cards('heart', ['4', '4']),
      ...cards('club', ['5', '5', '5']),
      card('diamond', '5')
    ];
    const legal = getLegalPlays(hand, null, level);
    expect(legal.some((p) => p.type === 'triplePairs' && p.rank === '5')).toBe(true);
  });

  it('能枚举出四大天王', () => {
    const hand = [
      card('joker', 'small_joker'),
      card('joker', 'small_joker'),
      card('joker', 'big_joker'),
      card('joker', 'big_joker')
    ];
    const legal = getLegalPlays(hand, null, level);
    expect(legal.some((p) => p.type === 'fourJokers')).toBe(true);
  });

  it('同一点数超过 4 张时，能枚举出多种炸弹尺寸', () => {
    const hand = [
      ...cards('spade', ['6', '6', '6', '6']),
      ...cards('heart', ['6', '6'])
    ];
    const legal = getLegalPlays(hand, null, level);
    const bombSizes = legal.filter((p) => p.type === 'bomb').map((p) => p.size).sort();
    expect(bombSizes).toEqual([4, 5, 6]);
  });
});
