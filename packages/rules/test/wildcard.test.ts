import { describe, expect, it } from 'vitest';
import { classifyPlay } from '../src/classify.js';
import { getLegalPlays } from '../src/legalPlays.js';
import { card } from './helpers.js';

describe('逢人配（红桃级牌万能百搭）牌型判定', () => {
  const level = '2'; // 当前打 2，红桃 2 为逢人配

  it('逢人配单张自身就是级牌单张', () => {
    const play = classifyPlay([card('heart', '2')], level);
    expect(play).toEqual(
      expect.objectContaining({ type: 'single', rank: '2', size: 1 })
    );
  });

  it('两张逢人配可作自然对级牌', () => {
    const play = classifyPlay([card('heart', '2'), card('heart', '2')], level);
    expect(play).toEqual(
      expect.objectContaining({ type: 'pair', rank: '2', size: 2 })
    );
  });

  it('逢人配配对子：1张8 + 红桃2 = 对8', () => {
    const play = classifyPlay([card('spade', '8'), card('heart', '2')], level);
    expect(play).toEqual(
      expect.objectContaining({ type: 'pair', rank: '8', size: 2 })
    );
  });

  it('逢人配不能配大王或小王', () => {
    expect(classifyPlay([card('joker', 'small_joker'), card('heart', '2')], level)).toBeNull();
    expect(classifyPlay([card('joker', 'big_joker'), card('heart', '2')], level)).toBeNull();
  });

  it('逢人配配三张：2张8 + 红桃2 = 三张8', () => {
    const play = classifyPlay([card('spade', '8'), card('club', '8'), card('heart', '2')], level);
    expect(play).toEqual(
      expect.objectContaining({ type: 'triple', rank: '8', size: 3 })
    );
  });

  it('逢人配配4张炸弹：3张8 + 红桃2 = 4张8炸弹', () => {
    const play = classifyPlay(
      [card('spade', '8'), card('club', '8'), card('diamond', '8'), card('heart', '2')],
      level
    );
    expect(play).toEqual(
      expect.objectContaining({ type: 'bomb', rank: '8', size: 4 })
    );
  });

  it('逢人配配5张炸弹：4张8 + 红桃2 = 5张8炸弹', () => {
    const play = classifyPlay(
      [card('spade', '8'), card('club', '8'), card('diamond', '8'), card('heart', '8'), card('heart', '2')],
      level
    );
    expect(play).toEqual(
      expect.objectContaining({ type: 'bomb', rank: '8', size: 5 })
    );
  });

  it('逢人配配三带二：3张8 + 1张K + 红桃2 = 3个8带对K', () => {
    const play = classifyPlay(
      [card('spade', '8'), card('club', '8'), card('diamond', '8'), card('spade', 'K'), card('heart', '2')],
      level
    );
    expect(play).toEqual(
      expect.objectContaining({ type: 'tripleWithPair', rank: '8', size: 5 })
    );
  });

  it('逢人配配顺子：3-4-红桃2-6-7 = 34567 顺子', () => {
    const play = classifyPlay(
      [card('spade', '3'), card('club', '4'), card('heart', '2'), card('diamond', '6'), card('spade', '7')],
      level
    );
    expect(play).toEqual(
      expect.objectContaining({ type: 'straight', rank: '7', size: 5 })
    );
  });

  it('逢人配配同花顺：同花3-4-红桃2-6-7 = 同花顺(黑桃)', () => {
    const play = classifyPlay(
      [card('spade', '3'), card('spade', '4'), card('heart', '2'), card('spade', '6'), card('spade', '7')],
      level
    );
    expect(play).toEqual(
      expect.objectContaining({ type: 'straightFlush', rank: '7', size: 5 })
    );
  });

  it('逢人配配三连对(木板)：33-4-红桃2-55 = 334455', () => {
    const play = classifyPlay(
      [
        card('spade', '3'),
        card('club', '3'),
        card('spade', '4'),
        card('heart', '2'),
        card('spade', '5'),
        card('diamond', '5')
      ],
      level
    );
    expect(play).toEqual(
      expect.objectContaining({ type: 'triplePairs', rank: '5', size: 6 })
    );
  });

  it('逢人配配钢板(三同连张)：333-44-红桃2 = 333444', () => {
    const play = classifyPlay(
      [
        card('spade', '3'),
        card('club', '3'),
        card('diamond', '3'),
        card('spade', '4'),
        card('club', '4'),
        card('heart', '2')
      ],
      level
    );
    expect(play).toEqual(
      expect.objectContaining({ type: 'tripleStraight', rank: '4', size: 6 })
    );
  });

  it('逢人配在 getLegalPlays 中可生成合法出牌压过上家', () => {
    // 手牌：3个8 + 1个红桃2（配成 4个8 炸弹）+ 散牌
    const hand = [
      card('spade', '8'),
      card('club', '8'),
      card('diamond', '8'),
      card('heart', '2'),
      card('spade', '3')
    ];
    // 上家出了 4张7 炸弹
    const lastPlay = classifyPlay(
      [card('spade', '7'), card('club', '7'), card('diamond', '7'), card('heart', '7')],
      level
    );
    const legalPlays = getLegalPlays(hand, lastPlay, level);
    // 应该能用 3个8 + 红桃2 组成的 4个8炸弹压制上家 4个7
    const bombPlay = legalPlays.find((p) => p.type === 'bomb' && p.rank === '8' && p.size === 4);
    expect(bombPlay).toBeDefined();
  });
});
