import type { Seat } from '@guandan/engine';
import type { LobbySeatSnapshot } from '@guandan/protocol';
import { useState } from 'react';

export interface LobbyScreenProps {
  you: Seat;
  seats: LobbySeatSnapshot[];
  error: string | null;
  onStart: () => void;
  onShowRules?: () => void;
}

export function LobbyScreen({ you, seats, error, onStart, onShowRules }: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);

  const topSeat = ((you + 2) % 4) as Seat;
  const leftSeat = ((you + 1) % 4) as Seat;
  const rightSeat = ((you + 3) % 4) as Seat;

  const getSeat = (seatNum: Seat) => {
    return seats.find((s) => s.seat === seatNum) ?? {
      seat: seatNum,
      name: `座位 ${seatNum}`,
      isBot: true,
      connected: false
    };
  };

  const copyRoomLink = () => {
    try {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const roomName = new URLSearchParams(window.location.search).get('room') ?? '默认房间';

  const renderLobbySeat = (seatSnapshot: LobbySeatSnapshot, role: 'partner' | 'rival' | 'self') => {
    const isSelf = role === 'self';
    const isPartner = role === 'partner';
    const roleLabel = isSelf ? '我' : isPartner ? '搭档' : '对手';

    return (
      <div className={`lobby-seat-card lobby-seat-${role} ${isSelf ? 'lobby-seat-self' : ''}`}>
        <div className="lobby-seat-avatar">
          {seatSnapshot.isBot ? '🤖' : '👤'}
          {seatSnapshot.connected && !seatSnapshot.isBot && <span className="online-pulse-dot" />}
        </div>
        <div className="lobby-seat-details">
          <div className="lobby-seat-name-row">
            <span className="lobby-seat-name">{seatSnapshot.name}</span>
            <span className={`lobby-role-badge ${isPartner || isSelf ? 'badge-team-red' : 'badge-team-blue'}`}>
              {roleLabel}
            </span>
          </div>
          <span className="lobby-seat-status">
            {seatSnapshot.isBot
              ? '机器人就绪'
              : seatSnapshot.connected
                ? '已就绪'
                : '离线代打'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="app lobby-page">
      {/* 顶部房间信息与快速操作 */}
      <div className="lobby-header">
        <div className="lobby-title-wrap">
          <h1 className="lobby-title">掼蛋房间</h1>
          <span className="room-id-tag">房号: {roomName}</span>
        </div>
        <div className="lobby-header-actions">
          {onShowRules && (
            <button className="icon-btn" onClick={onShowRules} title="掼蛋玩法速查">
              📖 规则
            </button>
          )}
          <button className={`share-btn ${copied ? 'copied' : ''}`} onClick={copyRoomLink}>
            {copied ? '✓ 已复制链接' : '🔗 邀请家人'}
          </button>
        </div>
      </div>

      {/* 牌桌方位俯瞰图 */}
      <div className="lobby-table-preview">
        <div className="lobby-felt-oval">
          <div className="lobby-center-watermark">
            <span>GUANDAN</span>
            <span className="lobby-table-desc">2v2 组队对抗</span>
          </div>

          {/* 北：搭档 */}
          <div className="lobby-pos lobby-pos-top">
            {renderLobbySeat(getSeat(topSeat), 'partner')}
          </div>

          {/* 西：对手（上家） */}
          <div className="lobby-pos lobby-pos-left">
            {renderLobbySeat(getSeat(leftSeat), 'rival')}
          </div>

          {/* 东：对手（下家） */}
          <div className="lobby-pos lobby-pos-right">
            {renderLobbySeat(getSeat(rightSeat), 'rival')}
          </div>

          {/* 南：自己 */}
          <div className="lobby-pos lobby-pos-bottom">
            {renderLobbySeat(getSeat(you), 'self')}
          </div>
        </div>
      </div>

      {/* 底部提示与开打操作 */}
      <div className="lobby-footer">
        {error && <div className="message lobby-error">{error}</div>}
        <button className="primary-action-btn pulse-glow lobby-start-btn" onClick={onStart}>
          🃏 开始发牌
        </button>
        <p className="lobby-tips">
          💡 4 人满席对战，空位随时由启发式 AI 补位，1~4 位真人均可畅快开局！
        </p>
      </div>
    </div>
  );
}
