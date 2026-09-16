import { useState } from 'react';
import {
  clearHonorRecords,
  getHonorRecords,
  getHonorTitle,
  type PlayerHonorRecord
} from './honorLedger.js';

interface HonorModalProps {
  onClose: () => void;
}

export function HonorModal({ onClose }: HonorModalProps) {
  const [records, setRecords] = useState<PlayerHonorRecord[]>(() => getHonorRecords());
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = () => {
    clearHonorRecords();
    setRecords([]);
    setConfirmClear(false);
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="honor-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="honor-modal-header">
          <div className="honor-modal-title-row">
            <span className="honor-trophy-icon">🏆</span>
            <h2 className="honor-modal-title">家庭战绩荣誉榜</h2>
          </div>
          <button className="honor-close-btn" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        <p className="honor-modal-desc">
          基于双上（+3）、单上（+2）、平局（+1）与过 A 夺冠（+10）自动计分统计。
        </p>

        <div className="honor-list-container">
          {records.length === 0 ? (
            <div className="honor-empty-state">
              <span className="honor-empty-icon">📭</span>
              <p>暂无战绩记录，玩完一副牌后将自动入榜！</p>
            </div>
          ) : (
            <div className="honor-records-list">
              {records.map((item, index) => {
                const title = getHonorTitle(item);
                const winRate =
                  item.totalRounds > 0
                    ? Math.round((item.firstRankCount / item.totalRounds) * 100)
                    : 0;

                return (
                  <div
                    key={item.playerName}
                    className={`honor-record-item ${index === 0 ? 'is-first-rank' : ''}`}
                  >
                    <div className="honor-rank-col">{getRankBadge(index)}</div>
                    <div className="honor-player-col">
                      <div className="honor-player-name-row">
                        <span className="honor-player-name">{item.playerName}</span>
                        <span className="honor-title-badge">{title}</span>
                        {item.grandChampionships > 0 && (
                          <span className="honor-champ-tag" title="打过 A 斩获大满贯总冠军次数">
                            🏆 ×{item.grandChampionships}
                          </span>
                        )}
                      </div>
                      <div className="honor-stats-row">
                        <span>共 {item.totalRounds} 副</span>
                        <span>头游 {item.firstRankCount} 次</span>
                        <span>胜率 {winRate}%</span>
                        {item.doubleUpWins > 0 && <span>双上 {item.doubleUpWins} 次</span>}
                      </div>
                    </div>
                    <div className="honor-points-col">
                      <span
                        className={`honor-points-val ${
                          item.totalPoints >= 0 ? 'points-pos' : 'points-neg'
                        }`}
                      >
                        {item.totalPoints >= 0 ? `+${item.totalPoints}` : item.totalPoints}
                      </span>
                      <span className="honor-points-label">积分</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="honor-modal-footer">
          {confirmClear ? (
            <div className="honor-clear-confirm-bar">
              <span className="honor-confirm-text">确定清空所有战绩记录？</span>
              <button
                type="button"
                className="secondary-action-btn honor-mini-btn"
                onClick={() => setConfirmClear(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-action-btn honor-mini-btn btn-danger"
                onClick={handleClear}
              >
                确定清空
              </button>
            </div>
          ) : (
            <div className="honor-footer-actions">
              {records.length > 0 && (
                <button
                  type="button"
                  className="honor-btn-link-danger"
                  onClick={() => setConfirmClear(true)}
                >
                  🗑️ 重置清空账本
                </button>
              )}
              <button type="button" className="primary-action-btn" onClick={onClose}>
                关闭
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
