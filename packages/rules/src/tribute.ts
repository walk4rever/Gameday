import type { Card, Rank } from './types.js';
import { isWildcard } from './shape.js';
import { compareValue } from './deck.js';

export type Seat = 0 | 1 | 2 | 3;

export interface TributeExchange {
  fromSeat: Seat;
  toSeat: Seat;
  tributeCard: Card;
  returnCard: Card;
}

export interface TributeResult {
  type: 'none' | 'anti_tribute' | 'single' | 'double';
  description: string;
  exchanges: TributeExchange[];
  nextStartSeat: Seat;
  hands: [Card[], Card[], Card[], Card[]];
}

/** 进贡牌点数价值权重计算：大王(1000) > 小王(900) > 级牌(800) > A(700) > ... */
export function getTributeCardValue(card: Card, level: Rank): number {
  if (card.rank === 'big_joker') return 1000;
  if (card.rank === 'small_joker') return 900;
  if (card.rank === level) {
    // 红桃级牌是逢人配，掼蛋规则保护逢人配不作为进贡牌（除非全手都是逢人配）
    if (isWildcard(card, level)) return 1;
    return 800;
  }
  return compareValue(card.rank, level);
}

/** 格式化牌名（如 "大王", "红桃2", "黑桃A"） */
export function formatCardName(card: Card): string {
  if (card.rank === 'big_joker') return '大王';
  if (card.rank === 'small_joker') return '小王';
  const suits: Record<string, string> = {
    spade: '黑桃',
    heart: '红桃',
    club: '梅花',
    diamond: '方块'
  };
  return `${suits[card.suit] ?? ''}${card.rank}`;
}

/** 从手牌中选出进贡牌（严格最大的非逢人配牌） */
export function findTributeCard(hand: Card[], level: Rank): Card {
  // 排除逢人配（红桃级牌）
  const nonWild = hand.filter((c) => !isWildcard(c, level));
  const pool = nonWild.length > 0 ? nonWild : hand;

  return pool.reduce((max, current) => {
    return getTributeCardValue(current, level) > getTributeCardValue(max, level) ? current : max;
  });
}

/** 从手牌中选出还贡牌（不超过 10 的最小非级牌/非王牌，没有则选最小牌） */
export function findReturnCard(hand: Card[], level: Rank): Card {
  // 不超过 10 且不是级牌、不是王牌
  const ranksUnder10 = new Set<Rank>(['2', '3', '4', '5', '6', '7', '8', '9', '10']);
  const eligible = hand.filter(
    (c) =>
      c.rank !== 'big_joker' &&
      c.rank !== 'small_joker' &&
      c.rank !== level &&
      ranksUnder10.has(c.rank)
  );

  const pool =
    eligible.length > 0
      ? eligible
      : hand.filter((c) => c.rank !== 'big_joker' && c.rank !== 'small_joker');
  const finalPool = pool.length > 0 ? pool : hand;

  // 选最小的一张还贡
  return finalPool.reduce((min, current) => {
    return compareValue(current.rank, level) < compareValue(min.rank, level) ? current : min;
  });
}

/** 获取手中所有符合规则的进贡候选牌（最大的非逢人配牌，若有多张同点数牌均可选择） */
export function getLegalTributeCards(hand: Card[], level: Rank): Card[] {
  if (hand.length === 0) return [];
  const nonWild = hand.filter((c) => !isWildcard(c, level));
  const pool = nonWild.length > 0 ? nonWild : hand;
  const maxVal = Math.max(...pool.map((c) => getTributeCardValue(c, level)));
  return pool.filter((c) => getTributeCardValue(c, level) === maxVal);
}

/** 校验选择的进贡牌是否符合掼蛋规则 */
export function validateTributeCard(
  card: Card,
  hand: Card[],
  level: Rank
): { ok: true } | { ok: false; error: string } {
  const inHand = hand.some((c) => c.id === card.id);
  if (!inHand) {
    return { ok: false, error: '该牌不在手牌中' };
  }
  const hasNonWild = hand.some((c) => !isWildcard(c, level));
  if (hasNonWild && isWildcard(card, level)) {
    return { ok: false, error: '逢人配（红桃级牌）受规则保护，不可作为进贡牌' };
  }
  const legalCards = getLegalTributeCards(hand, level);
  const isLegal = legalCards.some((c) => c.id === card.id);
  if (!isLegal) {
    const highestName = legalCards[0] ? formatCardName(legalCards[0]) : '';
    return {
      ok: false,
      error: `进贡牌必须是手中最大的非逢人配牌${highestName ? `（如【${highestName}】）` : ''}`
    };
  }
  return { ok: true };
}

/** 获取手中所有符合规则的还贡候选牌（<= 10 的非级牌、非王牌；若无则为非王牌或任意最小牌） */
export function getLegalReturnCards(hand: Card[], level: Rank): Card[] {
  if (hand.length === 0) return [];
  const ranksUnder10 = new Set<Rank>(['2', '3', '4', '5', '6', '7', '8', '9', '10']);
  const eligible = hand.filter(
    (c) =>
      c.rank !== 'big_joker' &&
      c.rank !== 'small_joker' &&
      c.rank !== level &&
      ranksUnder10.has(c.rank)
  );
  if (eligible.length > 0) return eligible;

  const nonJokers = hand.filter((c) => c.rank !== 'big_joker' && c.rank !== 'small_joker');
  return nonJokers.length > 0 ? nonJokers : hand;
}

/** 校验选择的还贡牌是否符合掼蛋规则 */
export function validateReturnCard(
  card: Card,
  hand: Card[],
  level: Rank
): { ok: true } | { ok: false; error: string } {
  const inHand = hand.some((c) => c.id === card.id);
  if (!inHand) {
    return { ok: false, error: '该牌不在手牌中' };
  }
  const legalCards = getLegalReturnCards(hand, level);
  const ranksUnder10 = new Set<Rank>(['2', '3', '4', '5', '6', '7', '8', '9', '10']);
  const hasStandardEligible = hand.some(
    (c) =>
      c.rank !== 'big_joker' &&
      c.rank !== 'small_joker' &&
      c.rank !== level &&
      ranksUnder10.has(c.rank)
  );

  if (hasStandardEligible) {
    if (card.rank === 'big_joker' || card.rank === 'small_joker') {
      return { ok: false, error: '大小王不能作为还贡牌' };
    }
    if (card.rank === level) {
      return { ok: false, error: '级牌不能作为还贡牌' };
    }
    if (!ranksUnder10.has(card.rank)) {
      return { ok: false, error: '还贡牌点数不能超过 10' };
    }
  }

  const isLegal = legalCards.some((c) => c.id === card.id);
  if (!isLegal) {
    return { ok: false, error: '该牌不符合还贡规则' };
  }
  return { ok: true };
}

/** 智能推荐进贡牌 */
export function recommendTributeCard(hand: Card[], level: Rank): Card | null {
  if (hand.length === 0) return null;
  return findTributeCard(hand, level);
}

/** 智能推荐还贡牌（优先点数最小的合法还贡牌） */
export function recommendReturnCard(hand: Card[], level: Rank): Card | null {
  if (hand.length === 0) return null;
  return findReturnCard(hand, level);
}

/**
 * 结算并执行进贡与还贡：
 * 1. 检查上一局输赢情况（双下、单下、平局）；
 * 2. 检查抗贡条件（双大王抗贡）；
 * 3. 若未抗贡，自动选牌、执行手牌互换，并判定新一局首出座位。
 */
export function resolveTribute(
  hands: [Card[], Card[], Card[], Card[]],
  finishOrder: Seat[],
  level: Rank
): TributeResult {
  const clonedHands: [Card[], Card[], Card[], Card[]] = [
    [...hands[0]],
    [...hands[1]],
    [...hands[2]],
    [...hands[3]]
  ];

  if (finishOrder.length < 4) {
    return {
      type: 'none',
      description: '新开对局，无需进贡',
      exchanges: [],
      nextStartSeat: 0,
      hands: clonedHands
    };
  }

  const firstSeat = finishOrder[0]!;
  const partnerSeat = ((firstSeat + 2) % 4) as Seat;
  const secondRank = finishOrder.indexOf(partnerSeat);

  // 1. 平局（头游与末游同一战队）
  if (secondRank === 3) {
    return {
      type: 'none',
      description: '上一局平局，无需进贡，由头游首出。',
      exchanges: [],
      nextStartSeat: firstSeat,
      hands: clonedHands
    };
  }

  // 2. 双下（获 1、2 名的战队获胜，3、4 名落败）
  if (secondRank === 1) {
    const headSeat = firstSeat;
    const secondSeat = finishOrder[1]!;
    const thirdSeat = finishOrder[2]!;
    const lastSeat = finishOrder[3]!;

    // 检查双大王抗贡：落败方两人手中大王总数是否达到 2 张
    const losingBigJokers = [...clonedHands[thirdSeat], ...clonedHands[lastSeat]].filter(
      (c) => c.rank === 'big_joker'
    ).length;

    if (losingBigJokers >= 2) {
      return {
        type: 'anti_tribute',
        description: '落败方摸到双大王，抗贡成功！免除进贡，由头游首出。',
        exchanges: [],
        nextStartSeat: headSeat,
        hands: clonedHands
      };
    }

    // 双下正常进贡：末游贡头游，三游贡二游
    const lastTribute = findTributeCard(clonedHands[lastSeat], level);
    const headReturn = findReturnCard(clonedHands[headSeat], level);

    // 末游与头游交换
    clonedHands[lastSeat] = clonedHands[lastSeat].filter((c) => c.id !== lastTribute.id);
    clonedHands[lastSeat].push(headReturn);
    clonedHands[headSeat] = clonedHands[headSeat].filter((c) => c.id !== headReturn.id);
    clonedHands[headSeat].push(lastTribute);

    const thirdTribute = findTributeCard(clonedHands[thirdSeat], level);
    const secondReturn = findReturnCard(clonedHands[secondSeat], level);

    // 三游与二游交换
    clonedHands[thirdSeat] = clonedHands[thirdSeat].filter((c) => c.id !== thirdTribute.id);
    clonedHands[thirdSeat].push(secondReturn);
    clonedHands[secondSeat] = clonedHands[secondSeat].filter((c) => c.id !== secondReturn.id);
    clonedHands[secondSeat].push(thirdTribute);

    // 进贡牌大者首出；一样大则末游首出
    const lastVal = getTributeCardValue(lastTribute, level);
    const thirdVal = getTributeCardValue(thirdTribute, level);
    const nextStartSeat = lastVal >= thirdVal ? lastSeat : thirdSeat;

    const exchanges: TributeExchange[] = [
      {
        fromSeat: lastSeat,
        toSeat: headSeat,
        tributeCard: lastTribute,
        returnCard: headReturn
      },
      {
        fromSeat: thirdSeat,
        toSeat: secondSeat,
        tributeCard: thirdTribute,
        returnCard: secondReturn
      }
    ];

    return {
      type: 'double',
      description: `双下进贡：末游贡【${formatCardName(lastTribute)}】，三游贡【${formatCardName(thirdTribute)}】。由进贡大牌者先出牌。`,
      exchanges,
      nextStartSeat,
      hands: clonedHands
    };
  }

  // 3. 单下（获 1、3 名，第 4 名末游落败进贡给头游）
  const headSeat = firstSeat;
  const lastSeat = finishOrder[3]!;

  // 检查抗贡：末游独揽双大王
  const lastBigJokers = clonedHands[lastSeat].filter((c) => c.rank === 'big_joker').length;
  if (lastBigJokers >= 2) {
    return {
      type: 'anti_tribute',
      description: '末游独揽双大王，抗贡成功！免除进贡，由头游首出。',
      exchanges: [],
      nextStartSeat: headSeat,
      hands: clonedHands
    };
  }

  // 正常单贡
  const tributeCard = findTributeCard(clonedHands[lastSeat], level);
  const returnCard = findReturnCard(clonedHands[headSeat], level);

  clonedHands[lastSeat] = clonedHands[lastSeat].filter((c) => c.id !== tributeCard.id);
  clonedHands[lastSeat].push(returnCard);
  clonedHands[headSeat] = clonedHands[headSeat].filter((c) => c.id !== returnCard.id);
  clonedHands[headSeat].push(tributeCard);

  const exchanges: TributeExchange[] = [
    {
      fromSeat: lastSeat,
      toSeat: headSeat,
      tributeCard,
      returnCard
    }
  ];

  return {
    type: 'single',
    description: `单下进贡：末游向头游进贡【${formatCardName(tributeCard)}】，头游还贡【${formatCardName(returnCard)}】。由进贡方先出牌。`,
    exchanges,
    nextStartSeat: lastSeat,
    hands: clonedHands
  };
}
