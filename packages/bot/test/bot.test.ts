import { classifyPlay } from '@guandan/rules';
import type { Card, Play, Rank, Suit } from '@guandan/rules';
import { describe, expect, it } from 'vitest';
import { chooseBotPlay, getRankedHintPlays } from '../src/index.js';

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

  it('领出时如果手牌仅剩炸弹，整体打出炸弹赢得对局', () => {
    const hand = [card('spade', '9'), card('heart', '9'), card('club', '9'), card('diamond', '9')];
    const move = chooseBotPlay({
      hand,
      lastPlay: null,
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toHaveLength(4);
  });

  it('领出时手牌有顺子和散单张，优先打出顺子快速减牌', () => {
    const hand = [
      card('spade', '3'),
      card('heart', '4'),
      card('club', '5'),
      card('diamond', '6'),
      card('spade', '7'),
      card('heart', 'J'),
      card('diamond', 'K')
    ];
    const move = chooseBotPlay({
      hand,
      lastPlay: null,
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toHaveLength(5);
    const ranks = move?.map((c) => c.rank).sort();
    expect(ranks).toEqual(['3', '4', '5', '6', '7']);
  });

  it('领出时手牌有三带二，优先出三带二', () => {
    const hand = [
      card('spade', '5'),
      card('heart', '5'),
      card('club', '5'),
      card('spade', '3'),
      card('heart', '3'),
      card('diamond', 'K')
    ];
    const move = chooseBotPlay({
      hand,
      lastPlay: null,
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toHaveLength(5);
  });

  it('领出时手牌有小对子和散单张，优先打出对子', () => {
    const hand = [card('spade', '3'), card('heart', '3'), card('diamond', '9')];
    const move = chooseBotPlay({
      hand,
      lastPlay: null,
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(move).toHaveLength(2);
    expect(move?.[0]?.rank).toBe('3');
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

describe('getRankedHintPlays：智能提示推荐与循环轮换', () => {
  it('首出时组合套牌优先于单张，炸弹排在最后，且同一构型去重', () => {
    const hand = [
      card('spade', '3'),
      card('heart', '4'),
      card('club', '5'),
      card('diamond', '6'),
      card('spade', '7'),
      card('heart', '8'),
      card('club', '8'),
      card('spade', 'K'),
      card('heart', 'K'),
      card('club', 'K'),
      card('diamond', 'K') // 炸弹 K
    ];
    const hints = getRankedHintPlays({
      hand,
      lastPlay: null,
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });

    expect(hints.length).toBeGreaterThan(1);
    // 第一优先推荐顺子 3-4-5-6-7
    expect(hints[0]?.type).toBe('straight');
    // 第二优先推荐对子 88
    const pair8 = hints.find((h) => h.type === 'pair' && h.rank === '8');
    expect(pair8).toBeDefined();
    // 炸弹 K 排在常规牌型之后，绝对不拆炸弹成对K或三张K作为靠前提示
    const bombIndex = hints.findIndex((h) => h.type === 'bomb' && h.rank === 'K');
    const straightIndex = hints.findIndex((h) => h.type === 'straight');
    expect(straightIndex).toBeLessThan(bombIndex);

    // 检查去重：同一类型的牌型不会重复出现完全相同的 rank 和点数组合
    const keys = hints.map((h) => `${h.type}-${h.rank}-${h.size}`);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('保护逢人配，不优先把红桃级牌当作散牌单张提示', () => {
    const hand = [
      card('heart', '2'), // 逢人配
      card('spade', '3'),
      card('club', '9')
    ];
    const hints = getRankedHintPlays({
      hand,
      lastPlay: null,
      level: '2',
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });

    // 散单 3 和 9 应该排在逢人配单张之前
    const ranks = hints.slice(0, 2).map((h) => h.rank);
    expect(ranks).toContain('3');
    expect(ranks).toContain('9');
    // 逢人配作为单张应当排在最后
    expect(hints[hints.length - 1]?.cards[0]?.suit).toBe('heart');
  });

  it('支持 maxSuggestions 限制至多返回 Top 3~5 种最佳实践推荐', () => {
    const hand = [
      card('spade', '3'),
      card('heart', '4'),
      card('club', '5'),
      card('diamond', '6'),
      card('spade', '7'),
      card('heart', '8'),
      card('club', '8'),
      card('spade', '9'),
      card('heart', 'J'),
      card('club', 'Q'),
      card('diamond', 'K')
    ];
    // 不传参数时有很多候选
    const allHints = getRankedHintPlays({
      hand,
      lastPlay: null,
      level,
      isLastPlayFromPartner: false,
      partnerHandSize: 27
    });
    expect(allHints.length).toBeGreaterThan(5);

    // 传入 maxSuggestions = 4 时至多只返回 4 个最优解
    const topHints = getRankedHintPlays(
      {
        hand,
        lastPlay: null,
        level,
        isLastPlayFromPartner: false,
        partnerHandSize: 27
      },
      4
    );
    expect(topHints.length).toBe(4);
    // 第一推荐必须和全量中的第一推荐一致（最优解）
    expect(topHints[0]?.type).toBe(allHints[0]?.type);
  });
});
