import { useMemo, useState } from 'react';
import type { Card, Rank } from '@guandan/rules';

interface CardCounterProps {
  level: Rank;
  myHand: Card[];
  playedCards: Card[];
}

interface CounterItem {
  id: string;
  label: string;
  subLabel?: string;
  colorClass: string;
  total: number;
  myCount: number;
  playedCount: number;
  unseen: number;
}

export function CardCounter({ level, myHand, playedCards }: CardCounterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const items = useMemo<CounterItem[]>(() => {
    const isLevelA = level === 'A';
    const isLevelK = level === 'K';
    const isLevel2 = level === '2';

    // 1. 大王
    const redJokerMy = myHand.filter((c) => c.rank === 'big_joker').length;
    const redJokerPlayed = playedCards.filter((c) => c.rank === 'big_joker').length;
    const redJokerUnseen = Math.max(0, 2 - redJokerMy - redJokerPlayed);

    // 2. 小王
    const blackJokerMy = myHand.filter((c) => c.rank === 'small_joker').length;
    const blackJokerPlayed = playedCards.filter((c) => c.rank === 'small_joker').length;
    const blackJokerUnseen = Math.max(0, 2 - blackJokerMy - blackJokerPlayed);

    // 3. 红桃逢人配
    const wildMy = myHand.filter((c) => c.suit === 'heart' && c.rank === level).length;
    const wildPlayed = playedCards.filter((c) => c.suit === 'heart' && c.rank === level).length;
    const wildUnseen = Math.max(0, 2 - wildMy - wildPlayed);

    // 4. 其他级牌 (黑桃/梅花/方块)
    const otherLevelMy = myHand.filter(
      (c) => c.suit !== 'heart' && c.rank === level
    ).length;
    const otherLevelPlayed = playedCards.filter(
      (c) => c.suit !== 'heart' && c.rank === level
    ).length;
    const otherLevelUnseen = Math.max(0, 6 - otherLevelMy - otherLevelPlayed);

    const list: CounterItem[] = [
      {
        id: 'red-joker',
        label: '大王',
        colorClass: 'counter-red',
        total: 2,
        myCount: redJokerMy,
        playedCount: redJokerPlayed,
        unseen: redJokerUnseen
      },
      {
        id: 'black-joker',
        label: '小王',
        colorClass: 'counter-black',
        total: 2,
        myCount: blackJokerMy,
        playedCount: blackJokerPlayed,
        unseen: blackJokerUnseen
      },
      {
        id: 'wild-level',
        label: `红桃${level}配`,
        colorClass: 'counter-wild',
        total: 2,
        myCount: wildMy,
        playedCount: wildPlayed,
        unseen: wildUnseen
      },
      {
        id: 'other-level',
        label: `级牌${level}`,
        colorClass: 'counter-level',
        total: 6,
        myCount: otherLevelMy,
        playedCount: otherLevelPlayed,
        unseen: otherLevelUnseen
      }
    ];

    // 非级牌时的 A
    if (!isLevelA) {
      const aMy = myHand.filter((c) => c.rank === 'A').length;
      const aPlayed = playedCards.filter((c) => c.rank === 'A').length;
      const aUnseen = Math.max(0, 8 - aMy - aPlayed);
      list.push({
        id: 'rank-a',
        label: 'A',
        colorClass: 'counter-rank',
        total: 8,
        myCount: aMy,
        playedCount: aPlayed,
        unseen: aUnseen
      });
    }

    // 非级牌时的 K
    if (!isLevelK) {
      const kMy = myHand.filter((c) => c.rank === 'K').length;
      const kPlayed = playedCards.filter((c) => c.rank === 'K').length;
      const kUnseen = Math.max(0, 8 - kMy - kPlayed);
      list.push({
        id: 'rank-k',
        label: 'K',
        colorClass: 'counter-rank',
        total: 8,
        myCount: kMy,
        playedCount: kPlayed,
        unseen: kUnseen
      });
    }

    // 非级牌时的 2
    if (!isLevel2) {
      const twoMy = myHand.filter((c) => c.rank === '2').length;
      const twoPlayed = playedCards.filter((c) => c.rank === '2').length;
      const twoUnseen = Math.max(0, 8 - twoMy - twoPlayed);
      list.push({
        id: 'rank-2',
        label: '2',
        colorClass: 'counter-rank',
        total: 8,
        myCount: twoMy,
        playedCount: twoPlayed,
        unseen: twoUnseen
      });
    }

    return list;
  }, [level, myHand, playedCards]);

  const totalPlayed = playedCards.length;

  return (
    <div className={`card-counter-wrapper ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      <button
        type="button"
        className="card-counter-toggle-btn"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? '收起记牌器' : '展开记牌器（查看大牌剩余分布）'}
      >
        <span className="counter-icon">🧮</span>
        <span className="counter-btn-text">{isExpanded ? '收起记牌' : '记牌器'}</span>
        {totalPlayed > 0 && <span className="counter-played-dot">{totalPlayed}</span>}
      </button>

      {isExpanded && (
        <div className="card-counter-panel">
          <div className="card-counter-header">
            <span className="counter-panel-title">场上未出大牌统计</span>
            <span className="counter-panel-meta">已出 {totalPlayed} 张</span>
          </div>
          <div className="card-counter-grid">
            {items.map((item) => (
              <div
                key={item.id}
                className={`counter-pill ${item.colorClass} ${item.unseen === 0 ? 'is-exhausted' : ''}`}
                title={`总计 ${item.total} 张 | 己手 ${item.myCount} 张 | 已打出 ${item.playedCount} 张 | 别人未出 ${item.unseen} 张`}
              >
                <span className="counter-pill-label">{item.label}</span>
                <span className="counter-pill-val">
                  {item.unseen === 0 ? '绝' : item.unseen}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
