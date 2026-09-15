import { describe, expect, it } from 'vitest';
import { classifyPlay } from '../src/classify.js';
import { comparePlays } from '../src/compare.js';
import type { Play } from '../src/types.js';
import { card, cards } from './helpers.js';

function play(cardsInPlay: Parameters<typeof classifyPlay>[0]): Play {
  const result = classifyPlay(cardsInPlay);
  if (!result) throw new Error('测试给的牌型应当合法');
  return result;
}

describe('comparePlays（级牌固定为 2）', () => {
  const level = '2';

  it('同类型同张数按点数比较', () => {
    const higher = play([card('spade', '9')]);
    const lower = play([card('heart', '7')]);
    expect(comparePlays(higher, lower, level)).toBeGreaterThan(0);
    expect(comparePlays(lower, higher, level)).toBeLessThan(0);
  });

  it('级牌单张压过 A 单张', () => {
    const levelCard = play([card('spade', '2')]);
    const ace = play([card('heart', 'A')]);
    expect(comparePlays(levelCard, ace, level)).toBeGreaterThan(0);
  });

  it('大王压小王，小王压级牌', () => {
    const bigJoker = play([card('joker', 'big_joker')]);
    const smallJoker = play([card('joker', 'small_joker')]);
    const levelCard = play([card('spade', '2')]);
    expect(comparePlays(bigJoker, smallJoker, level)).toBeGreaterThan(0);
    expect(comparePlays(smallJoker, levelCard, level)).toBeGreaterThan(0);
  });

  it('不同牌型不可比较', () => {
    const single = play([card('spade', '9')]);
    const pair = play([card('spade', '3'), card('heart', '3')]);
    expect(comparePlays(single, pair, level)).toBeNull();
  });

  it('同张数不同类型不可比较', () => {
    const straight = play([
      card('spade', '5'),
      card('heart', '6'),
      card('club', '7'),
      card('diamond', '8'),
      card('spade', '9')
    ]);
    const tripleWithPair = play([
      ...cards('spade', ['3', '3', '3']),
      ...cards('heart', ['4', '4'])
    ]);
    expect(comparePlays(straight, tripleWithPair, level)).toBeNull();
  });

  it('炸弹压任何非炸弹牌型', () => {
    const bomb = play(cards('spade', ['9', '9', '9', '9']));
    const straight = play([
      card('spade', '5'),
      card('heart', '6'),
      card('club', '7'),
      card('diamond', '8'),
      card('spade', '9')
    ]);
    expect(comparePlays(bomb, straight, level)).toBeGreaterThan(0);
  });

  it('炸弹梯队：4 张 < 5 张 < 同花顺 < 6 张 < 7 张 < 8 张 < 四大天王', () => {
    const bomb4 = play(cards('spade', ['3', '3', '3', '3']));
    const bomb5 = play([...cards('spade', ['4', '4', '4', '4']), card('heart', '4')]);
    const straightFlush = play(cards('spade', ['5', '6', '7', '8', '9']));
    const bomb6 = play([...cards('spade', ['6', '6', '6', '6']), ...cards('heart', ['6', '6'])]);
    const bomb7 = play([...cards('spade', ['7', '7', '7', '7']), ...cards('heart', ['7', '7', '7'])]);
    const bomb8 = play([
      ...cards('spade', ['8', '8', '8', '8']),
      ...cards('heart', ['8', '8', '8', '8'])
    ]);
    const fourJokers = play([
      card('joker', 'small_joker'),
      card('joker', 'small_joker'),
      card('joker', 'big_joker'),
      card('joker', 'big_joker')
    ]);

    const ladder = [bomb4, bomb5, straightFlush, bomb6, bomb7, bomb8, fourJokers];
    for (let i = 1; i < ladder.length; i++) {
      expect(comparePlays(ladder[i]!, ladder[i - 1]!, level)).toBeGreaterThan(0);
    }
  });

  it('同张数炸弹之间按点数比较，点数不影响梯队', () => {
    const highBomb = play(cards('spade', ['3', '3', '3', '3']));
    const lowRankBigBomb = play([
      ...cards('spade', ['4', '4', '4', '4']),
      card('heart', '4')
    ]);
    // 5 张炸弹（点数 4）应当仍然大于 4 张炸弹（点数 3），因为张数优先于点数
    expect(comparePlays(lowRankBigBomb, highBomb, level)).toBeGreaterThan(0);
  });

  it('顺子按最高牌比较，A2345 是最小的顺子', () => {
    const aceLow = play([
      card('spade', 'A'),
      card('heart', '2'),
      card('club', '3'),
      card('diamond', '4'),
      card('spade', '5')
    ]);
    const twoToSix = play([
      card('spade', '2'),
      card('heart', '3'),
      card('club', '4'),
      card('diamond', '5'),
      card('spade', '6')
    ]);
    expect(comparePlays(twoToSix, aceLow, level)).toBeGreaterThan(0);
  });

  it('三连对/三同连张按最高点数比较', () => {
    const triplePairsLow = play([
      ...cards('spade', ['3', '3']),
      ...cards('heart', ['4', '4']),
      ...cards('club', ['5', '5'])
    ]);
    const triplePairsHigh = play([
      ...cards('spade', ['4', '4']),
      ...cards('heart', ['5', '5']),
      ...cards('club', ['6', '6'])
    ]);
    expect(comparePlays(triplePairsHigh, triplePairsLow, level)).toBeGreaterThan(0);
  });
});
