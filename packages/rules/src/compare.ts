import { compareValue } from './deck.js';
import { consecutiveGroupInfo, straightInfo } from './shape.js';
import type { Play, PlayType, Rank } from './types.js';

/** 炸弹梯队：非炸弹为 0，四大天王最高。见 RULES_SPEC.md 第 4 节。 */
function bombTier(type: PlayType, size: number): number {
  if (type === 'fourJokers') return 7;
  if (type === 'straightFlush') return 3;
  if (type === 'bomb') {
    if (size === 4) return 1;
    if (size === 5) return 2;
    if (size === 6) return 4;
    if (size === 7) return 5;
    if (size === 8) return 6;
  }
  return 0;
}

function orderKey(play: Play, level: Rank): number {
  switch (play.type) {
    case 'straight':
    case 'straightFlush': {
      const info = straightInfo(play.cards);
      if (!info) throw new Error('无效顺子');
      return info.orderKey;
    }
    case 'triplePairs': {
      const info = consecutiveGroupInfo(play.cards, 2, 3);
      if (!info) throw new Error('无效三连对');
      return info.orderKey;
    }
    case 'tripleStraight': {
      const info = consecutiveGroupInfo(play.cards, 3, 2);
      if (!info) throw new Error('无效三同连张');
      return info.orderKey;
    }
    default:
      return compareValue(play.rank, level);
  }
}

/**
 * 比较两手牌：正数 = a 更大，负数 = b 更大，null = 不可比较（非炸弹且类型/张数不同）。
 * 不考虑逢人配。
 */
export function comparePlays(a: Play, b: Play, level: Rank): number | null {
  const tierA = bombTier(a.type, a.size);
  const tierB = bombTier(b.type, b.size);

  if (tierA === 0 && tierB === 0) {
    if (a.type !== b.type || a.size !== b.size) return null;
    return orderKey(a, level) - orderKey(b, level);
  }

  if (tierA !== tierB) return tierA - tierB;
  if (a.type === 'fourJokers') return 0;
  return orderKey(a, level) - orderKey(b, level);
}
