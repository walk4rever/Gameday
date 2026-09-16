import { useEffect, useRef, useState } from 'react';
import {
  type FavoriteRoom,
  getFavoriteRooms,
  removeFavoriteRoom
} from '../game/roomManager.js';

interface RegisteredRoomSearchResult {
  roomId: string;
  name: string;
  hasPassword: boolean;
  createdAt: number;
  createdBy: string;
}

interface RoomSwitcherModalProps {
  currentRoom: string;
  onSelectRoom: (roomId: string) => void;
  onOpenCreate: (initialName?: string | undefined) => void;
  onClose: () => void;
}

export function RoomSwitcherModal({
  currentRoom,
  onSelectRoom,
  onOpenCreate,
  onClose
}: RoomSwitcherModalProps) {
  const [history, setHistory] = useState<FavoriteRoom[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [searchResults, setSearchResults] = useState<RegisteredRoomSearchResult[]>([]);
  const [notFoundName, setNotFoundName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 监听输入，实时防抖模糊搜索房间名
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    setError(null);
    setNotFoundName(null);

    const q = nameInput.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/room/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; rooms: RegisteredRoomSearchResult[] };
          if (data.ok && Array.isArray(data.rooms)) {
            setSearchResults(data.rooms);
          }
        }
      } catch {
        // 忽略网络波动
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [nameInput]);

  const handleRemove = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    removeFavoriteRoom(roomId);
    setHistory((prev) => prev.filter((r) => r.roomId !== roomId));
  };

  // 按房间名字解析并进入
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) {
      setError('请输入要进入的房间名字');
      return;
    }

    // 1. 本地常去房间优先匹配
    const localMatch = history.find(
      (r) =>
        r.name.toLowerCase() === clean.toLowerCase() ||
        r.roomId.toLowerCase() === clean.toLowerCase()
    );
    if (localMatch) {
      onSelectRoom(localMatch.roomId);
      return;
    }

    // 2. 服务端精准解析房间名
    try {
      setResolving(true);
      setError(null);
      setNotFoundName(null);

      const res = await fetch(`/api/room/resolve?name=${encodeURIComponent(clean)}`);
      const data = (await res.json()) as {
        ok: boolean;
        room?: { roomId: string; name: string; hasPassword: boolean };
        message?: string;
      };

      if (res.ok && data.ok && data.room) {
        onSelectRoom(data.room.roomId);
      } else {
        setNotFoundName(clean);
        setError(data.message || `未找到名为「${clean}」的房间`);
      }
    } catch {
      setError('网络查询超时，请重试');
    } finally {
      setResolving(false);
    }
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

        {/* 按房间名字查找与进入 */}
        <form className="switcher-search-form" onSubmit={handleResolveSubmit}>
          <div className="switcher-section-title">
            <span>🔍 输入房间名字进入</span>
            <button
              type="button"
              className="room-inline-btn"
              onClick={() => {
                onClose();
                onOpenCreate(nameInput.trim() || undefined);
              }}
            >
              ➕ 新建专属房间
            </button>
          </div>

          <div className="switcher-input-row">
            <input
              type="text"
              className="room-form-input search-room-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="输入房间名字，例如：拯救地球、相亲相爱一家人..."
              autoFocus
            />
            <button
              type="submit"
              className="room-btn-primary switcher-go-btn"
              disabled={resolving || !nameInput.trim()}
            >
              {resolving ? '正在进入…' : '查找进入 →'}
            </button>
          </div>

          {/* 实时名字搜索匹配列表 */}
          {nameInput.trim() && searchResults.length > 0 && (
            <div className="search-results-box">
              <span className="search-results-label">找到匹配的房间：</span>
              <div className="search-results-list">
                {searchResults.map((sr) => (
                  <div
                    key={sr.roomId}
                    className="search-result-item"
                    onClick={() => onSelectRoom(sr.roomId)}
                  >
                    <div className="search-result-main">
                      <span className="search-result-name">
                        {sr.name}
                        {sr.hasPassword && <span className="fav-lock-icon" title="密码保护房间"> 🔒</span>}
                      </span>
                      <span className="search-result-sub">
                        {sr.roomId === 'default' ? '官方大厅' : `房主: ${sr.createdBy || '家人'}`}
                      </span>
                    </div>
                    <button type="button" className="search-result-go">
                      进入 →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searching && <div className="switcher-searching-tip">🔍 正在搜索匹配的房间…</div>}

          {/* 未找到房间时的友好引导：一键以此名字创建 */}
          {notFoundName && (
            <div className="not-found-prompt">
              <p className="not-found-text">未找到名为「<strong>{notFoundName}</strong>」的房间</p>
              <button
                type="button"
                className="room-highlight-btn create-named-room-btn"
                onClick={() => {
                  onClose();
                  onOpenCreate(notFoundName);
                }}
              >
                ➕ 立即创建「{notFoundName}」专属房间
              </button>
            </div>
          )}

          {error && !notFoundName && <div className="room-modal-error">⚠️ {error}</div>}
        </form>

        {/* 我的常去家庭房间 */}
        <div className="switcher-section">
          <div className="switcher-section-title">
            <span>我的常去家庭房间</span>
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
                      {r.roomId === 'default' ? '默认官方大厅' : '专属家庭房'}
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
      </div>
    </div>
  );
}
