import { describe, expect, it } from 'vitest';
import {
  findReturnCard,
  findTributeCard,
  getTributeCardValue,
  resolveTribute,
  getLegalTributeCards,
  validateTributeCard,
  getLegalReturnCards,
  validateReturnCard
} from '../src/tribute.js';
import type { Card, Rank } from '../src/types.js';
import { card } from './helpers.js';

describe('掼蛋进贡、还贡与抗贡规则（Tribute & Anti-Tribute）', () => {
  const level: Rank = '2';

  it('进贡选牌：优先大王 > 小王 > 级牌(非红桃) > A，保护逢人配红桃级牌', () => {
    const handWithBigJoker: Card[] = [
      card('joker', 'big_joker'),
      card('spade', 'A'),
      card('heart', '2') // 逢人配
    ];
    expect(findTributeCard(handWithBigJoker, level).rank).toBe('big_joker');

    const handWithLevelAndWild: Card[] = [
      card('heart', '2'), // 逢人配
      card('spade', '2'), // 正常级牌
      card('club', 'K')
    ];
    // 逢人配受保护不进贡，应进贡黑桃2
    const chosen = findTributeCard(handWithLevelAndWild, level);
    expect(chosen.suit).toBe('spade');
    expect(chosen.rank).toBe('2');
  });

  it('还贡选牌：优先选择 <= 10 的非级牌、非王牌散牌', () => {
    const hand: Card[] = [
      card('joker', 'big_joker'),
      card('heart', '2'), // 级牌
      card('spade', 'A'),
      card('club', '8'),
      card('diamond', '4')
    ];
    const ret = findReturnCard(hand, level);
    // 应当在 club 8 与 diamond 4 中选择最小的 diamond 4
    expect(ret.rank).toBe('4');
  });

  it('单下：第 4 名末游向第 1 名头游单贡，头游还贡，末游先出牌', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '3'), card('club', '4')], // 0号 (头游)
      [card('spade', '5'), card('club', '5')], // 1号 (二游，对手)
      [card('spade', '6'), card('club', '6')], // 2号 (三游，搭档)
      [card('joker', 'big_joker'), card('spade', '7')] // 3号 (末游，对手)
    ];
    // 0和2是一队(1, 3名 单上)，1和3是一队(2, 4名)
    const finishOrder: [0, 1, 2, 3] = [0, 1, 2, 3];
    const result = resolveTribute(hands, finishOrder, level);

    expect(result.type).toBe('single');
    expect(result.exchanges).toHaveLength(1);
    expect(result.exchanges[0]?.fromSeat).toBe(3);
    expect(result.exchanges[0]?.toSeat).toBe(0);
    expect(result.exchanges[0]?.tributeCard.rank).toBe('big_joker');
    expect(result.exchanges[0]?.returnCard.rank).toBe('3');

    // 0号得到大王，失去3；3号得到3，失去大王
    expect(result.hands[0].some((c) => c.rank === 'big_joker')).toBe(true);
    expect(result.hands[3].some((c) => c.rank === 'big_joker')).toBe(false);
    expect(result.nextStartSeat).toBe(3);
  });

  it('单下抗贡：末游独揽双大王，抗贡成功免除进贡，由头游首出', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '3'), card('club', '4')],
      [card('spade', '5'), card('club', '5')],
      [card('spade', '6'), card('club', '6')],
      [card('joker', 'big_joker'), card('joker', 'big_joker')] // 末游双大王
    ];
    const finishOrder: [0, 1, 2, 3] = [0, 1, 2, 3];
    const result = resolveTribute(hands, finishOrder, level);

    expect(result.type).toBe('anti_tribute');
    expect(result.exchanges).toHaveLength(0);
    expect(result.nextStartSeat).toBe(0); // 免除进贡，头游首出
  });

  it('双下：第 4 名贡头游，第 3 名贡二游，进大牌者先出牌', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '3')], // 0号 (头游)
      [card('spade', '4')], // 2号实际在finishOrder中为二游
      [card('spade', 'A')], // 三游
      [card('joker', 'big_joker')] // 末游
    ];
    // 0号和1号分别获第1、2名（双上）
    const finishOrder: [0, 1, 2, 3] = [0, 1, 2, 3]; // partner of 0 is 2, wait!
    // partner of 0 is 2! So if finishOrder is [0, 2, 1, 3], then 0 and 2 are 1st and 2nd!
    const doubleFinishOrder: [0, 2, 1, 3] = [0, 2, 1, 3];
    const result = resolveTribute(hands, doubleFinishOrder, level);

    expect(result.type).toBe('double');
    expect(result.exchanges).toHaveLength(2);
    // 末游 3 进贡大王给头游 0；三游 1 进贡 A 给二游 2
    expect(result.exchanges[0]?.fromSeat).toBe(3);
    expect(result.exchanges[0]?.toSeat).toBe(0);
    expect(result.exchanges[1]?.fromSeat).toBe(1);
    expect(result.exchanges[1]?.toSeat).toBe(2);
    // 大王比 A 大，由进贡大牌的末游 3 首出
    expect(result.nextStartSeat).toBe(3);
  });

  it('双下抗贡：落败方两人合计拥有双大王，抗贡成功免除进贡', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '3')],
      [card('joker', 'big_joker')], // 三游持有一张大王
      [card('spade', '4')],
      [card('joker', 'big_joker')] // 末游持有一张大王
    ];
    const doubleFinishOrder: [0, 2, 1, 3] = [0, 2, 1, 3];
    const result = resolveTribute(hands, doubleFinishOrder, level);

    expect(result.type).toBe('anti_tribute');
    expect(result.exchanges).toHaveLength(0);
    expect(result.nextStartSeat).toBe(0);
  });

  it('平局：头游获胜但搭档末游，双方平局不进贡，由头游首出', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '3')],
      [card('spade', '4')],
      [card('spade', '5')],
      [card('spade', '6')]
    ];
    // 0的搭档是2。finishOrder中0为头游，2为末游(第4名)
    const drawFinishOrder: [0, 1, 3, 2] = [0, 1, 3, 2];
    const result = resolveTribute(hands, drawFinishOrder, level);

    expect(result.type).toBe('none');
    expect(result.exchanges).toHaveLength(0);
    expect(result.nextStartSeat).toBe(0);
  });

  it('进贡合法牌筛选与验证：多张最大牌均可选，红桃级牌(逢人配)不可进贡，非最大牌不可进贡', () => {
    const hand: Card[] = [
      card('joker', 'small_joker'),
      card('spade', 'small_joker'), // 第二张小王
      card('heart', '2'),           // 逢人配
      card('spade', '2'),           // 级牌
      card('spade', 'A'),
      card('club', '4')
    ];

    const legal = getLegalTributeCards(hand, level);
    expect(legal).toHaveLength(2);
    expect(legal.every((c) => c.rank === 'small_joker')).toBe(true);

    // 选小王合法
    expect(validateTributeCard(hand[0]!, hand, level).ok).toBe(true);
    expect(validateTributeCard(hand[1]!, hand, level).ok).toBe(true);

    // 选逢人配被拒
    const wildRes = validateTributeCard(hand[2]!, hand, level);
    expect(wildRes.ok).toBe(false);
    if (!wildRes.ok) expect(wildRes.error).toContain('逢人配');

    // 选普通级牌被拒（因为有更大牌小王）
    const levelRes = validateTributeCard(hand[3]!, hand, level);
    expect(levelRes.ok).toBe(false);
    if (!levelRes.ok) expect(levelRes.error).toContain('最大的非逢人配牌');
  });

  it('还贡合法牌筛选与验证：必须 <= 10 且非级牌、非王牌', () => {
    const hand: Card[] = [
      card('joker', 'big_joker'),
      card('diamond', '2'), // 级牌
      card('spade', 'K'),
      card('spade', '10'),
      card('club', '7'),
      card('heart', '3')
    ];

    const legal = getLegalReturnCards(hand, level);
    expect(legal.map((c) => c.rank).sort()).toEqual(['10', '3', '7']);

    // 选 3、7、10 合法
    expect(validateReturnCard(hand[3]!, hand, level).ok).toBe(true);
    expect(validateReturnCard(hand[4]!, hand, level).ok).toBe(true);
    expect(validateReturnCard(hand[5]!, hand, level).ok).toBe(true);

    // 选大王被拒
    const jokerRes = validateReturnCard(hand[0]!, hand, level);
    expect(jokerRes.ok).toBe(false);
    if (!jokerRes.ok) expect(jokerRes.error).toContain('大小王');

    // 选级牌被拒
    const levelRes = validateReturnCard(hand[1]!, hand, level);
    expect(levelRes.ok).toBe(false);
    if (!levelRes.ok) expect(levelRes.error).toContain('级牌');

    // 选 K 被拒（超过 10）
    const kRes = validateReturnCard(hand[2]!, hand, level);
    expect(kRes.ok).toBe(false);
    if (!kRes.ok) expect(kRes.error).toContain('10');
  });
});
