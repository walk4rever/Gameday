import { useEffect, useRef, useState } from 'react';
import { useOrientation } from './useOrientation.js';
import {
  type FavoriteRoom,
  getFavoriteRooms,
  removeFavoriteRoom
} from './game/roomManager.js';
import { CreateRoomModal } from './components/CreateRoomModal.js';

interface RegisteredRoomSearchResult {
  roomId: string;
  name: string;
  hasPassword: boolean;
  createdAt: number;
  createdBy: string;
}

interface SelectRoomScreenProps {
  playerName: string;
  onSelectRoom: (roomId: string) => void;
  onShowRules: () => void;
  onLogout: () => void;
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '曾经访问';
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
}

export function SelectRoomScreen({
  playerName,
  onSelectRoom,
  onShowRules,
  onLogout
}: SelectRoomScreenProps) {
  const { isLandscape, needsForcedRotation, toggleOrientation } = useOrientation();
  const [history, setHistory] = useState<FavoriteRoom[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialName, setCreateInitialName] = useState<string | undefined>(undefined);

  const [nameInput, setNameInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [searchResults, setSearchResults] = useState<RegisteredRoomSearchResult[]>([]);
  const [notFoundName, setNotFoundName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHistory(getFavoriteRooms());
  }, []);

  // 实时防抖搜索房间名
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
        // 忽略网络错误
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [nameInput]);

  const handleRemoveHistory = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    removeFavoriteRoom(roomId);
    setHistory((prev) => prev.filter((r) => r.roomId !== roomId));
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) {
      setError('请输入房间名字');
      return;
    }

    // 本地常去房间优先匹配
    const localMatch = history.find(
      (r) =>
        r.name.toLowerCase() === clean.toLowerCase() ||
        r.roomId.toLowerCase() === clean.toLowerCase()
    );
    if (localMatch) {
      onSelectRoom(localMatch.roomId);
      return;
    }

    // 服务端解析
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
      setError('网络连接超时，请重试');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className={`app select-room-page ${isLandscape ? 'landscape-mode' : ''} ${
        needsForcedRotation ? 'app-forced-landscape' : ''
      }`}
    >
      {/* 顶部导航栏 */}
      <header className="room-tables-header select-room-header">
        <div className="room-info-minimal">
          <span className="room-symbol">🎴</span>
          <div className="room-meta-group">
            <span className="room-title-text select-page-title">Gameday · 家庭牌室</span>
            <span className="room-player-tag">
              玩家: <strong>{playerName}</strong>
            </span>
          </div>
        </div>

        <div className="room-header-btns">
          <button
            className="icon-btn orientation-toggle-btn"
            onClick={toggleOrientation}
            title={isLandscape ? '切换为竖屏' : '切换为横屏'}
          >
            {isLandscape ? '📱 竖屏' : '📱 横屏'}
          </button>
          <button className="icon-btn" onClick={onShowRules} title="掼蛋规则速查">
            📖 规则
          </button>
          <button className="icon-btn" onClick={onLogout} title="退出登录">
            ← 退出
          </button>
        </div>
      </header>

      {/* 主选择区域 */}
      <main className="select-room-container">
        {/* 卡片 1: 创建专属房间 */}
        <section className="select-hero-card">
          <div className="hero-card-left">
            <span className="hero-emoji">🏡</span>
            <div className="hero-text-col">
              <h2 className="hero-title">创建家庭专属房间</h2>
              <p className="hero-desc">
                为家人或亲友定制专属房间（如「拯救地球」），支持 6 位纯数字密码保护
              </p>
            </div>
          </div>
          <button
            type="button"
            className="hero-action-btn"
            onClick={() => {
              setCreateInitialName(undefined);
              setShowCreateModal(true);
            }}
          >
            ➕ 立即创建房间 →
          </button>
        </section>

        {/* 卡片 2: 输入房间名字查找加入 */}
        <section className="select-search-section">
          <form className="select-search-form" onSubmit={handleResolveSubmit}>
            <div className="select-section-title">
              <span>🔍 输入房间名字或链接加入</span>
            </div>
            <div className="select-input-row">
              <input
                type="text"
                className="room-form-input select-name-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="输入房间名字（例如：拯救地球、相亲相爱一家人...）"
              />
              <button
                type="submit"
                className="room-btn-primary select-search-btn"
                disabled={resolving || !nameInput.trim()}
              >
                {resolving ? '正在查找…' : '查找进入 →'}
              </button>
            </div>

            {/* 匹配房间预览列表 */}
            {nameInput.trim() && searchResults.length > 0 && (
              <div className="search-results-box select-results-box">
                <span className="search-results-label">找到以下匹配房间：</span>
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
                          {sr.hasPassword && <span className="fav-lock-icon" title="密码保护"> 🔒</span>}
                        </span>
                        <span className="search-result-sub">
                          房主: {sr.createdBy || '家人'}
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

            {searching && <div className="switcher-searching-tip">🔍 正在检索房间…</div>}

            {notFoundName && (
              <div className="not-found-prompt select-not-found">
                <p className="not-found-text">
                  未找到名为「<strong>{notFoundName}</strong>」的房间
                </p>
                <button
                  type="button"
                  className="room-highlight-btn create-named-room-btn"
                  onClick={() => {
                    setCreateInitialName(notFoundName);
                    setShowCreateModal(true);
                  }}
                >
                  ➕ 立即创建「{notFoundName}」专属房间
                </button>
              </div>
            )}

            {error && !notFoundName && <div className="room-modal-error">⚠️ {error}</div>}
          </form>
        </section>

        {/* 卡片 3: 我的常去家庭房间 (历史记录) */}
        <section className="select-history-section">
          <div className="select-section-title">
            <span>我的家庭房间 ({history.length})</span>
            <span className="select-history-sub">您创建或进入过的房间将自动保留在此</span>
          </div>

          {history.length > 0 ? (
            <div className="history-rooms-grid">
              {history.map((r) => (
                <div
                  key={r.roomId}
                  className="history-room-card"
                  onClick={() => onSelectRoom(r.roomId)}
                >
                  <div className="history-card-top">
                    <div className="history-card-title-row">
                      <span className="history-card-icon">🏡</span>
                      <span className="history-card-name">{r.name}</span>
                      {r.hasPassword && <span className="history-card-lock" title="密码保护房间">🔒</span>}
                    </div>
                    <button
                      type="button"
                      className="fav-del-btn"
                      onClick={(e) => handleRemoveHistory(e, r.roomId)}
                      title="从历史列表移除"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="history-card-footer">
                    <span className="history-card-time">
                      🕒 最近访问: {formatRelativeTime(r.lastVisitedAt)}
                    </span>
                    <span className="history-card-go">进入对局 →</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="history-empty-card">
              <span className="empty-card-emoji">🛋️</span>
              <p className="empty-card-title">暂无家庭房间记录</p>
              <p className="empty-card-desc">
                您可以点击上方「➕ 立即创建房间」，或输入家人分享的房间名字加入。
              </p>
            </div>
          )}
        </section>
      </main>

      {/* 创建房间弹窗 */}
      {showCreateModal && (
        <CreateRoomModal
          playerName={playerName}
          initialName={createInitialName}
          onClose={() => {
            setShowCreateModal(false);
            setCreateInitialName(undefined);
          }}
          onCreated={(roomId) => {
            setShowCreateModal(false);
            onSelectRoom(roomId);
          }}
        />
      )}
    </div>
  );
}
