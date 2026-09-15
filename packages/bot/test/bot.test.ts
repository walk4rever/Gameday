import { classifyPlay } from '@guandan/rules';
import type { Card, Play, Rank, Suit } from '@guandan/rules';
import { describe, expect, it } from 'vitest';
import { chooseBotPlay } from '../src/index.js';

let counter = 0;
function card(suit: Suit, rank: Rank): Card {
  counter += 1;
  return { suit, rank, id: `${suit}-${rank}-${counter}` };
}

function play(cards: Card[]): Play {
  const result = classifyPlay(cards);
  if (!result) throw new Error('测试给的牌型应当合法');
  return result;
}

const level: Rank = '2';

describe('chooseBotPlay：领出新一轮', () => {
  it('优先出散的小单张，而不是炸弹', () => {
    const hand = [
      card('spade', 'A'),
      card('heart', '3'),
      card('spade', '9'),
      card('heart', '9'),
      card('club', '9'),
      card('diamond', '9')
    ];
    const move = chooseBotPlay({
      hand,
      lastPlay: null,
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toHaveLength(1);
    expect(move?.[0]?.rank).toBe('3');
  });

  it('领出时即使手里有可组成炸弹的点数，也拆开先出一张，不整体打出炸弹', () => {
    const hand = [card('spade', '9'), card('heart', '9'), card('club', '9'), card('diamond', '9')];
    const move = chooseBotPlay({
      hand,
      lastPlay: null,
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toHaveLength(1);
    expect(move?.[0]?.rank).toBe('9');
  });
});

describe('chooseBotPlay：跟牌', () => {
  it('队友领先时不抢，直接过', () => {
    const hand = [card('spade', 'A')];
    const move = chooseBotPlay({
      hand,
      lastPlay: play([card('heart', '5')]),
      level,
      isLastPlayFromPartner: true,
      partnerHandSize: 27
    });
    expect(move).toBeNull();
  });

  it('能压过时选最小的能压过的牌，而不是最大的', () => {
    const hand = [card('spade', '8'), card('heart', 'A')];
    const move = chooseBotPlay({
      hand,
      lastPlay: play([card('club', '7')]),
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toHaveLength(1);
    expect(move?.[0]?.rank).toBe('8');
  });

  it('压不过时过牌', () => {
    const hand = [card('spade', '3')];
    const move = chooseBotPlay({
      hand,
      lastPlay: play([card('club', '9')]),
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toBeNull();
  });

  it('非关键时刻不用炸弹强拆，宁可过牌', () => {
    const hand = [
      card('spade', '3'),
      card('heart', '3'),
      card('club', '3'),
      card('diamond', '3'),
      ...Array.from({ length: 20 }, (_, i) => card('spade', '4' as Rank))
    ];
    const move = chooseBotPlay({
      hand,
      lastPlay: play([card('club', 'A')]),
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toBeNull();
  });

  it('关键时刻（手牌很少）愿意拆炸弹压过对手', () => {
    const hand = [card('spade', '3'), card('heart', '3'), card('club', '3'), card('diamond', '3')];
    const move = chooseBotPlay({
      hand,
      lastPlay: play([card('club', 'A')]),
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toHaveLength(4);
  });

  it('队友快出完时，就算是关键时刻也不用炸弹抢', () => {
    const hand = [card('spade', '3'), card('heart', '3'), card('club', '3'), card('diamond', '3')];
    const move = chooseBotPlay({
      hand,
      lastPlay: play([card('club', 'A')]),
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 1
    });
    expect(move).toBeNull();
  });
});
