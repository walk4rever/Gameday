import { describe, expect, it } from 'vitest';
import { classifyPlay } from '../src/classify.js';
import { card, cards } from './helpers.js';

describe('classifyPlay', () => {
  it('识别单张', () => {
    const play = classifyPlay([card('spade', '7')]);
    expect(play).toEqual({ type: 'single', cards: expect.any(Array), rank: '7', size: 1 });
  });

  it('识别对子', () => {
    const play = classifyPlay([card('spade', '7'), card('heart', '7')]);
    expect(play?.type).toBe('pair');
    expect(play?.rank).toBe('7');
  });

  it('两张不同点数不是对子', () => {
    expect(classifyPlay([card('spade', '7'), card('heart', '8')])).toBeNull();
  });

  it('识别对王（同为小王）', () => {
    const play = classifyPlay([card('joker', 'small_joker'), card('joker', 'small_joker')]);
    expect(play?.type).toBe('pair');
    expect(play?.rank).toBe('small_joker');
  });

  it('识别三张', () => {
    const play = classifyPlay(cards('spade', ['9', '9', '9']));
    expect(play?.type).toBe('triple');
    expect(play?.rank).toBe('9');
  });

  it('识别三带二，rank 取三张的点数', () => {
    const play = classifyPlay([...cards('spade', ['9', '9', '9']), ...cards('heart', ['4', '4'])]);
    expect(play?.type).toBe('tripleWithPair');
    expect(play?.rank).toBe('9');
  });

  it('三张加两张但两张点数相同于第三张时不是三带二', () => {
    // 9,9,9,9,4 -> 4 张 9 + 1 张 4，不构成任何合法 5 张型
    const play = classifyPlay([...cards('spade', ['9', '9', '9', '9']), card('heart', '4')]);
    expect(play).toBeNull();
  });

  it('识别顺子，rank 取最高牌', () => {
    const play = classifyPlay([
      card('spade', '5'),
      card('heart', '6'),
      card('club', '7'),
      card('diamond', '8'),
      card('spade', '9')
    ]);
    expect(play?.type).toBe('straight');
    expect(play?.rank).toBe('9');
  });

  it('识别 A2345 特殊顺子', () => {
    const play = classifyPlay([
      card('spade', 'A'),
      card('heart', '2'),
      card('club', '3'),
      card('diamond', '4'),
      card('spade', '5')
    ]);
    expect(play?.type).toBe('straight');
  });

  it('顺子不允许环绕（QKA23 不合法）', () => {
    const play = classifyPlay([
      card('spade', 'Q'),
      card('heart', 'K'),
      card('club', 'A'),
      card('diamond', '2'),
      card('spade', '3')
    ]);
    expect(play).toBeNull();
  });

  it('同花的连续 5 张识别为同花顺', () => {
    const play = classifyPlay(cards('spade', ['5', '6', '7', '8', '9']));
    expect(play?.type).toBe('straightFlush');
  });

  it('识别三连对（木板）', () => {
    const play = classifyPlay([
      ...cards('spade', ['3', '3']),
      ...cards('heart', ['4', '4']),
      ...cards('club', ['5', '5'])
    ]);
    expect(play?.type).toBe('triplePairs');
    expect(play?.rank).toBe('5');
  });

  it('三连对点数不连续时不合法', () => {
    const play = classifyPlay([
      ...cards('spade', ['3', '3']),
      ...cards('heart', ['4', '4']),
      ...cards('club', ['6', '6'])
    ]);
    expect(play).toBeNull();
  });

  it('识别三同连张（钢板）', () => {
    const play = classifyPlay([...cards('spade', ['3', '3', '3']), ...cards('heart', ['4', '4', '4'])]);
    expect(play?.type).toBe('tripleStraight');
    expect(play?.rank).toBe('4');
  });

  it('识别 4/5/6/7/8 张炸弹', () => {
    expect(classifyPlay(cards('spade', ['6', '6', '6', '6']))?.type).toBe('bomb');
    expect(
      classifyPlay([...cards('spade', ['6', '6', '6', '6']), card('heart', '6')])?.type
    ).toBe('bomb');
  });

  it('识别四大天王', () => {
    const play = classifyPlay([
      card('joker', 'small_joker'),
      card('joker', 'small_joker'),
      card('joker', 'big_joker'),
      card('joker', 'big_joker')
    ]);
    expect(play?.type).toBe('fourJokers');
  });

  it('两小王两大王以外的 4 张不是四大天王', () => {
    const play = classifyPlay([
      card('joker', 'small_joker'),
      card('joker', 'big_joker'),
      card('spade', '5'),
      card('heart', '5')
    ]);
    expect(play).toBeNull();
  });

  it('空数组和乱牌返回 null', () => {
    expect(classifyPlay([])).toBeNull();
    expect(
      classifyPlay([card('spade', '3'), card('heart', '5'), card('club', '9')])
    ).toBeNull();
  });
});
