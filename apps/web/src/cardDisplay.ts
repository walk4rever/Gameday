import { compareValue, classifyPlay, comparePlays } from '@guandan/rules';
import type { Card, Play, PlayType, Rank } from '@guandan/rules';
import type { Seat } from '@guandan/engine';

const SUIT_SYMBOL: Record<string, string> = {
  spade: '♠',
  heart: '♥',
  club: '♣',
  diamond: '♦'
};

export function isRed(card: Card): boolean {
  return card.suit === 'heart' || card.suit === 'diamond' || card.rank === 'big_joker';
}

export function isJoker(card: Card): boolean {
  return card.rank === 'small_joker' || card.rank === 'big_joker';
}

export function isLevelCard(card: Card, level: Rank): boolean {
  return card.rank === level;
}

export function isWildCard(card: Card, level: Rank): boolean {
  return card.rank === level && card.suit === 'heart';
}

export function rankLabel(card: Card): string {
  if (card.rank === 'small_joker') return '小王';
  if (card.rank === 'big_joker') return '大王';
  return card.rank;
}

export function suitSymbol(card: Card): string {
  return SUIT_SYMBOL[card.suit] ?? '';
}

export function cardLabel(card: Card): string {
  if (isJoker(card)) return rankLabel(card);
  return `${suitSymbol(card)}${card.rank}`;
}

export function sortHand(hand: Card[], level: Rank): Card[] {
  return [...hand].sort((a, b) => compareValue(a.rank, level) - compareValue(b.rank, level));
}

export function playTypeName(type: PlayType, size?: number): string {
  switch (type) {
    case 'single':
      return '单张';
    case 'pair':
      return '对子';
    case 'triple':
      return '三张';
    case 'tripleWithPair':
      return '三带二';
    case 'straight':
      return '顺子';
    case 'triplePairs':
      return '三连对 (木板)';
    case 'tripleStraight':
      return '三同连 (钢板)';
    case 'bomb':
      return size ? `${size}张炸弹` : '炸弹';
    case 'straightFlush':
      return '同花顺';
    case 'fourJokers':
      return '四大天王';
    default:
      return '未知牌型';
  }
}

export function describePlay(play: Play): string {
  const name = playTypeName(play.type, play.size);
  switch (play.type) {
    case 'single':
      return `${name} ${rankLabel(play.cards[0]!)}`;
    case 'pair':
      return `${name} ${rankLabel(play.cards[0]!)}`;
    case 'triple':
      return `${name} ${rankLabel(play.cards[0]!)}`;
    case 'tripleWithPair': {
      const counts = new Map<string, number>();
      play.cards.forEach((c) => counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1));
      let tripRank = '';
      let pairRank = '';
      for (const [r, count] of counts.entries()) {
        if (count === 3) tripRank = r;
        else if (count === 2) pairRank = r;
      }
      return `${name} ${tripRank}${tripRank}${tripRank}+${pairRank}${pairRank}`;
    }
    case 'straight': {
      const sorted = [...play.cards].sort((a, b) => Number(a.rank) - Number(b.rank));
      const low = sorted[0]?.rank ?? '';
      const high = sorted[sorted.length - 1]?.rank ?? '';
      return `${name} ${low}~${high}`;
    }
    case 'bomb':
      return `${play.size}张炸弹 ${rankLabel(play.cards[0]!)}`;
    case 'straightFlush': {
      const suit = suitSymbol(play.cards[0]!);
      return `${suit} ${name}`;
    }
    case 'fourJokers':
      return '四大天王 (天王炸)';
    default:
      return `${name} ${play.rank}`;
  }
}

export interface SelectionAnalysis {
  valid: boolean;
  type: 'empty' | 'valid' | 'invalid_shape' | 'invalid_type' | 'too_small';
  name: string;
  detail: string;
  play: Play | null;
}

export function analyzeSelection(
  selectedCards: Card[],
  opponentLastPlay: Play | null,
  level: Rank
): SelectionAnalysis {
  if (selectedCards.length === 0) {
    return {
      valid: false,
      type: 'empty',
      name: '',
      detail: '',
      play: null
    };
  }

  const play = classifyPlay(selectedCards, level);
  if (!play) {
    return {
      valid: false,
      type: 'invalid_shape',
      name: '不成牌型',
      detail: `当前选中的 ${selectedCards.length} 张牌无法组成规则允许的牌型`,
      play: null
    };
  }

  const name = playTypeName(play.type, play.size);

  if (opponentLastPlay) {
    const cmp = comparePlays(play, opponentLastPlay, level);
    if (cmp === null) {
      const oppName = playTypeName(opponentLastPlay.type, opponentLastPlay.size);
      return {
        valid: false,
        type: 'invalid_type',
        name,
        detail: `${name} 无法压制上家的 ${oppName}`,
        play
      };
    }
    if (cmp <= 0) {
      return {
        valid: false,
        type: 'too_small',
        name,
        detail: `牌面点数小于或等于上家，无法压牌`,
        play
      };
    }
    return {
      valid: true,
      type: 'valid',
      name,
      detail: `可压制上家的 ${playTypeName(opponentLastPlay.type, opponentLastPlay.size)}`,
      play
    };
  }

  return {
    valid: true,
    type: 'valid',
    name,
    detail: `合法牌型，可领出`,
    play
  };
}

export function rankOrderTitle(order: number): { title: string; badge: string; color: string } {
  switch (order) {
    case 0:
      return { title: '头游', badge: '🥇 头游', color: '#f59e0b' };
    case 1:
      return { title: '二游', badge: '🥈 二游', color: '#94a3b8' };
    case 2:
      return { title: '三游', badge: '🥉 三游', color: '#d97706' };
    case 3:
      return { title: '末游', badge: '🎖️ 末游', color: '#64748b' };
    default:
      return { title: `第${order + 1}名`, badge: `第${order + 1}`, color: '#64748b' };
  }
}

export function calculateMatchResult(
  finishOrder: Seat[],
  humanSeat: Seat
): { title: string; subtitle: string; tributeInfo: string; isVictory: boolean; levelBonus: number } {
  if (finishOrder.length < 4) {
    return { title: '对局结束', subtitle: '等待结算', tributeInfo: '', isVictory: false, levelBonus: 0 };
  }

  const partnerSeat = ((humanSeat + 2) % 4) as Seat;
  const humanRank = finishOrder.indexOf(humanSeat);
  const partnerRank = finishOrder.indexOf(partnerSeat);

  const teamRanks = [humanRank, partnerRank].sort((a, b) => a - b);
  const first = teamRanks[0]!;
  const second = teamRanks[1]!;

  // 1. 双上: 我方包揽 1、2 名
  if (first === 0 && second === 1) {
    return {
      title: '🎉 双上大捷！',
      subtitle: '我方搭档包揽头游与二游，升 3 级！',
      tributeInfo: '下局对方双贡（末游贡头游、三游贡二游，双大王可抗贡）',
      isVictory: true,
      levelBonus: 3
    };
  }

  // 2. 单上: 我方获得 1、3 名
  if (first === 0 && second === 2) {
    return {
      title: '✨ 单上胜利！',
      subtitle: '我方拿下头游与三游，升 2 级！',
      tributeInfo: '下局对方末游向我方头游进贡最大牌（末游双大王可抗贡）',
      isVictory: true,
      levelBonus: 2
    };
  }

  // 3. 平局情况 1: 我方 1、4 名 (对手 2、3 名)
  if (first === 0 && second === 3) {
    return {
      title: '🤝 战至平局',
      subtitle: '我方拿下头游但搭档末游，我方升 1 级。',
      tributeInfo: '双方平局无需进贡，下局由我方头游首出。',
      isVictory: true,
      levelBonus: 1
    };
  }

  // 4. 平局情况 2: 我方 2、3 名 (对手 1、4 名)
  if (first === 1 && second === 2) {
    return {
      title: '🤝 战至平局',
      subtitle: '对方拿下头游但其搭档末游，对方升 1 级。',
      tributeInfo: '双方平局无需进贡，下局由对方头游首出。',
      isVictory: false,
      levelBonus: -1
    };
  }

  // 5. 对方双上 (我方 3、4 名，对手包揽 1、2 名)
  if (first === 2 && second === 3) {
    return {
      title: '💥 惨遭双下',
      subtitle: '对方包揽头游与二游，对方升 3 级。',
      tributeInfo: '下局我方双贡（末游贡头游、三游贡二游，双大王可抗贡）',
      isVictory: false,
      levelBonus: -3
    };
  }

  // 6. 对方单上 (我方 2、4 名，即对手 1、3 名)
  return {
    title: '💔 局势惜败',
    subtitle: '对方获得头游与三游，对方升 2 级。',
    tributeInfo: '下局我方末游向对方头游进贡最大牌（末游双大王可抗贡）',
    isVictory: false,
    levelBonus: -2
  };
}
