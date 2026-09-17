import { useMemo } from 'react';
import type { Seat } from '@guandan/engine';
import type { MatchSessionInfo } from '@guandan/protocol';
import type { Card, Rank } from '@guandan/rules';

export interface GameSettingsModalProps {
  level: Rank;
  myHand: Card[];
  playedCards: Card[];
  matchSession?: MatchSessionInfo | null | undefined;
  humanSeat?: Seat | undefined;
  room?: string | undefined;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onShareRoom?: (() => void) | undefined;
  copiedInvite?: boolean | undefined;
  onShowRules: () => void;
  onShowHonor: () => void;
  onResetMatch: () => void;
  onExit?: (() => void) | undefined;
  onClose: () => void;
}

interface CounterCardStat {
  id: string;
  label: string;
  badge?: string;
  colorClass: string;
  total: number;
  myCount: number;
  playedCount: number;
  unseen: number;
}

export function GameSettingsModal({
  level,
  myHand,
  playedCards,
  room,
  soundEnabled,
  onToggleSound,
  onShareRoom,
  copiedInvite,
  onShowRules,
  onShowHonor,
  onResetMatch,
  onExit,
  onClose
}: GameSettingsModalProps) {
  // 记牌器 / 未出大牌分布数据计算
  const counterStats = useMemo<CounterCardStat[]>(() => {
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

    const list: CounterCardStat[] = [
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
        id: 'wild-card',
        label: `红桃${level}`,
        badge: '配',
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="game-settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 顶部标题栏 */}
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            <span className="settings-icon">⚙️</span>
            <span>游戏设置</span>
          </div>
          <button type="button" className="settings-close-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="settings-modal-body">
          {/* 一、场上记牌器 / 未出大牌统计 */}
          <section className="settings-section">
            <div className="settings-section-title">
              <span>🧮 记牌器 · 未出大牌统计</span>
              <span className="settings-section-hint">全场已打出 {totalPlayed} 张牌</span>
            </div>
            <div className="settings-counter-grid">
              {counterStats.map((item) => (
                <div
                  key={item.id}
                  className={`settings-counter-item ${item.colorClass} ${item.unseen === 0 ? 'is-exhausted' : ''}`}
                >
                  <div className="counter-item-head">
                    <span className="counter-item-label">{item.label}</span>
                    {item.badge && <span className="counter-item-badge">{item.badge}</span>}
                  </div>
                  <div className="counter-item-value">
                    {item.unseen === 0 ? (
                      <span className="val-exhausted">绝</span>
                    ) : (
                      <>
                        <span className="val-number">{item.unseen}</span>
                        <span className="val-unit">张</span>
                      </>
                    )}
                  </div>
                  <div className="counter-item-sub">
                    己手{item.myCount} / 己出{item.playedCount}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 二、快捷选项与游戏设置 */}
          <section className="settings-section">
            <div className="settings-section-title">
              <span>🎮 快捷选项与游戏设置</span>
            </div>
            <div className="settings-actions-grid">
              {/* 音效切换 */}
              <button
                type="button"
                className="settings-action-card"
                onClick={onToggleSound}
              >
                <span className="action-icon">{soundEnabled ? '🔊' : '🔇'}</span>
                <div className="action-meta">
                  <span className="action-title">游戏音效</span>
                  <span className="action-desc">{soundEnabled ? '已开启（出牌/获胜）' : '已静音'}</span>
                </div>
                <span className={`action-toggle-status ${soundEnabled ? 'status-on' : 'status-off'}`}>
                  {soundEnabled ? '开' : '关'}
                </span>
              </button>

              {/* 邀请好友同桌 */}
              {onShareRoom && (
                <button
                  type="button"
                  className="settings-action-card"
                  onClick={onShareRoom}
                >
                  <span className="action-icon">🔗</span>
                  <div className="action-meta">
                    <span className="action-title">{copiedInvite ? '✓ 邀请链接已复制' : '邀请好友同桌'}</span>
                    <span className="action-desc">{room ? `房间：${room}（点击复制链接）` : '复制本桌专属链接分享好友'}</span>
                  </div>
                  <span className={`action-toggle-status ${copiedInvite ? 'status-on' : 'status-normal'}`}>
                    {copiedInvite ? '已复制' : '分享'}
                  </span>
                </button>
              )}

              {/* 荣誉战绩榜 */}
              <button
                type="button"
                className="settings-action-card"
                onClick={() => {
                  onClose();
                  onShowHonor();
                }}
              >
                <span className="action-icon">🏆</span>
                <div className="action-meta">
                  <span className="action-title">家庭荣誉榜</span>
                  <span className="action-desc">查看历届总积分、胜场与胜率</span>
                </div>
                <span className="action-arrow">›</span>
              </button>

              {/* 规则指南 */}
              <button
                type="button"
                className="settings-action-card"
                onClick={() => {
                  onClose();
                  onShowRules();
                }}
              >
                <span className="action-icon">📖</span>
                <div className="action-meta">
                  <span className="action-title">掼蛋玩法规则</span>
                  <span className="action-desc">牌型大小、炸弹与进贡规则</span>
                </div>
                <span className="action-arrow">›</span>
              </button>
            </div>
          </section>

          {/* 四、危险操作区：从2重新开打 / 退出 */}
          <div className="settings-footer-actions">
            <button
              type="button"
              className="settings-btn-reset"
              onClick={() => {
                onClose();
                onResetMatch();
              }}
            >
              🔄 从打 2 重新开局
            </button>
            {onExit && (
              <button
                type="button"
                className="settings-btn-exit"
                onClick={() => {
                  onClose();
                  onExit();
                }}
              >
                🚪 退出当前牌桌
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
