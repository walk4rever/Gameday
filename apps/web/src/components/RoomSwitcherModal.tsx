import { useEffect, useState } from 'react';
import {
  type FavoriteRoom,
  getFavoriteRooms,
  removeFavoriteRoom
} from '../game/roomManager.js';

interface RoomSwitcherModalProps {
  currentRoom: string;
  onSelectRoom: (roomId: string) => void;
  onOpenCreate: () => void;
  onClose: () => void;
}

export function RoomSwitcherModal({
  currentRoom,
  onSelectRoom,
  onOpenCreate,
  onClose
}: RoomSwitcherModalProps) {
  const [history, setHistory] = useState<FavoriteRoom[]>([]);
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const list = getFavoriteRooms();
    // 确保列表包含公共大厅
    if (!list.some((r) => r.roomId === 'default')) {
      list.push({
        roomId: 'default',
        name: '公共大厅',
        hasPassword: false,
        lastVisitedAt: 0
      });
    }
    setHistory(list);
  }, []);

  const handleRemove = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    removeFavoriteRoom(roomId);
    setHistory((prev) => prev.filter((r) => r.roomId !== roomId));
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customRoomInput.trim();
    if (!clean) {
      setError('请输入有效的房间号');
      return;
    }
    onSelectRoom(clean);
  };

  return (
    <div className="room-modal-backdrop" onClick={onClose}>
      <div className="room-modal-card switcher-card" onClick={(e) => e.stopPropagation()}>
        <div className="room-modal-header">
          <div className="modal-header-title">
            <span className="modal-header-emoji">🚪</span>
            <h3>切换游戏房间</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="switcher-section">
          <div className="switcher-section-title">
            <span>我的常去家庭房间</span>
            <button
              type="button"
              className="room-inline-btn"
              onClick={() => {
                onClose();
                onOpenCreate();
              }}
            >
              ➕ 新建房间
            </button>
          </div>

          <div className="fav-room-list">
            {history.map((r) => {
              const isCurrent = r.roomId === currentRoom;
              return (
                <div
                  key={r.roomId}
                  className={`fav-room-item ${isCurrent ? 'fav-item-active' : ''}`}
                  onClick={() => {
                    if (!isCurrent) {
                      onSelectRoom(r.roomId);
                    } else {
                      onClose();
                    }
                  }}
                >
                  <div className="fav-room-main">
                    <span className="fav-room-name">
                      {r.name}
                      {r.hasPassword && <span className="fav-lock-icon" title="密码保护房间"> 🔒</span>}
                    </span>
                    <span className="fav-room-id">
                      {r.roomId === 'default' ? '默认官方大厅' : r.roomId}
                    </span>
                  </div>

                  <div className="fav-room-side">
                    {isCurrent ? (
                      <span className="fav-current-badge">当前所在</span>
                    ) : (
                      <button
                        type="button"
                        className="fav-del-btn"
                        onClick={(e) => handleRemove(e, r.roomId)}
                        title="从常用列表移除"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 手动输入房间号 */}
        <form className="switcher-manual-form" onSubmit={handleCustomSubmit}>
          <div className="switcher-section-title">
            <span>输入房间号直接进入</span>
          </div>
          <div className="switcher-input-row">
            <input
              type="text"
              className="room-form-input"
              value={customRoomInput}
              onChange={(e) => {
                setCustomRoomInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="例如：fam-7k8m2a 或 default"
            />
            <button type="submit" className="room-btn-primary switcher-go-btn">
              进入 →
            </button>
          </div>
          {error && <div className="room-modal-error">⚠️ {error}</div>}
        </form>
      </div>
    </div>
  );
}
