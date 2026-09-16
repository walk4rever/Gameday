import { useEffect, useState } from 'react';
import { useOrientation } from './useOrientation.js';
import { getOrCreatePlayerId } from './game/playerId.js';

export interface TableSeatInfo {
  seat: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  status?: 'online' | 'offline' | 'left';
}

export interface TableInfo {
  id: string;
  name: string;
  type: 'guandan' | 'shuangsheng';
  gameActive: boolean;
  isFull: boolean;
  isMember: boolean;
  humanSeatsCount: number;
  maxSeats: number;
  status: 'playing' | 'full' | 'waiting' | 'empty' | 'developing';
  seats?: TableSeatInfo[];
}

export interface RoomStatusResponse {
  room: string;
  tables: TableInfo[];
}

interface RoomTablesScreenProps {
  room: string;
  playerName: string;
  onSelectTable: (tableId: string) => void;
  onShowRules: () => void;
  onChangeNameOrRoom: () => void;
}

export function RoomTablesScreen({
  room,
  playerName,
  onSelectTable,
  onShowRules,
  onChangeNameOrRoom
}: RoomTablesScreenProps) {
  const { isLandscape, needsForcedRotation, toggleOrientation } = useOrientation();
  const [tables, setTables] = useState<TableInfo[]>([
    {
      id: 'guandan',
      name: '经典掼蛋',
      type: 'guandan',
      gameActive: false,
      isFull: false,
      isMember: false,
      humanSeatsCount: 0,
      maxSeats: 4,
      status: 'empty'
    },
    {
      id: 'shuangsheng',
      name: '经典双升 · 拖拉机',
      type: 'shuangsheng',
      gameActive: false,
      isFull: false,
      isMember: false,
      humanSeatsCount: 0,
      maxSeats: 4,
      status: 'developing'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const playerId = getOrCreatePlayerId();
      const res = await fetch(`/api/room-status?room=${encodeURIComponent(room)}&playerId=${encodeURIComponent(playerId)}`);
      if (res.ok) {
        const data = (await res.json()) as RoomStatusResponse;
        if (data.tables) {
          setTables(data.tables);
        }
      }
    } catch {
      // 忽略短暂网络失败
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
    const timer = setInterval(() => {
      void fetchStatus();
    }, 3000);
    return () => clearInterval(timer);
  }, [room]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const guandanTable = tables.find((t) => t.id === 'guandan');
  const isGuandanFullAndLocked = Boolean(
    guandanTable && (guandanTable.isFull || guandanTable.gameActive) && !guandanTable.isMember
  );

  return (
    <div
      className={`app room-tables-page ${isLandscape ? 'landscape-mode' : ''} ${
        needsForcedRotation ? 'app-forced-landscape' : ''
      }`}
    >
      {/* 顶部房间信息与全局操作条 */}
      <div className="room-tables-header">
        <div className="room-info-box">
          <div className="room-badge-row">
            <span className="room-symbol">🏡</span>
            <h1 className="room-main-title">房间大厅</h1>
            <span className="room-tag">房号: {room}</span>
          </div>
          <p className="room-player-welcome">
            当前玩家: <strong className="player-highlight">{playerName}</strong>
          </p>
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
          <button className="icon-btn" onClick={() => void fetchStatus()} title="刷新桌况">
            {loading ? '⏳' : '🔄'}
          </button>
          <button className="icon-btn" onClick={onChangeNameOrRoom} title="更换昵称或房间">
            ← 离开房间
          </button>
        </div>
      </div>

      {/* 牌桌列表区（支持两张桌子及扩展） */}
      <div className="tables-list-container">
        {/* 桌子 1: 经典掼蛋 */}
        <div className={`table-entry-card table-guandan ${isGuandanFullAndLocked ? 'table-card-locked' : ''}`}>
          <div className="table-card-header">
            <div className="table-title-area">
              <span className="table-emblem">🎴</span>
              <div>
                <div className="table-title-row">
                  <h2 className="table-name">1号桌 · 经典掼蛋</h2>
                  <span className="table-capacity-pill">4人桌 (2v2)</span>
                </div>
                <p className="table-desc">两副牌 · 逢人配进贡 · 启发式 AI 随时替补</p>
              </div>
            </div>

            {/* 状态徽章 */}
            <div className="table-status-area">
              {guandanTable?.gameActive ? (
                <span className="status-badge badge-playing">
                  <span className="badge-pulse-dot dot-red" />
                  对局进行中 ({guandanTable.humanSeatsCount}/4)
                </span>
              ) : guandanTable?.humanSeatsCount && guandanTable.humanSeatsCount >= 4 ? (
                <span className="status-badge badge-full">
                  <span className="badge-pulse-dot dot-yellow" />
                  已满员 (4/4)
                </span>
              ) : guandanTable?.humanSeatsCount && guandanTable.humanSeatsCount > 0 ? (
                <span className="status-badge badge-waiting">
                  <span className="badge-pulse-dot dot-green" />
                  组队中 ({guandanTable.humanSeatsCount}/4)
                </span>
              ) : (
                <span className="status-badge badge-empty">
                  <span className="badge-pulse-dot dot-green" />
                  空闲桌 (随时可开)
                </span>
              )}
            </div>
          </div>

          {/* 座位微缩预览图 */}
          <div className="table-mini-seats-preview">
            {[0, 1, 2, 3].map((seatIdx) => {
              const seatData = guandanTable?.seats?.find((s) => s.seat === seatIdx);
              const hasHuman = seatData && !seatData.isBot;
              return (
                <div key={seatIdx} className={`mini-seat-item ${hasHuman ? 'seat-occupied' : 'seat-vacant'}`}>
                  <span className="mini-seat-avatar">{hasHuman ? '👤' : '🤖'}</span>
                  {hasHuman && (
                    seatData?.status === 'offline' ? (
                      <span className="mini-seat-dot dot-offline" title="掉线中" />
                    ) : seatData?.status === 'left' ? (
                      <span className="mini-seat-dot dot-left" title="已离开" />
                    ) : seatData?.connected ? (
                      <span className="mini-seat-dot" title="在线" />
                    ) : null
                  )}
                </div>
              );
            })}
          </div>

          {/* 底部进入操作与满员限制提示 */}
          <div className="table-card-footer">
            {isGuandanFullAndLocked ? (
              <div className="locked-warning-box">
                <span className="locked-warning-text">
                  ⚠️ 本桌游戏已开始且满员（4人锁定），第 5 人无法加入。请查看其他桌或等待对局结束。
                </span>
                <button
                  type="button"
                  className="table-action-btn btn-locked"
                  disabled
                  title="游戏已满员进行中"
                >
                  🚫 满员进行中
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="primary-action-btn pulse-glow table-action-btn"
                onClick={() => onSelectTable('guandan')}
              >
                {guandanTable?.isMember ? '🃏 继续我的对局 →' : '🪑 入座掼蛋桌 →'}
              </button>
            )}
          </div>
        </div>

        {/* 桌子 2: 经典双升 · 拖拉机（开发中） */}
        <div className="table-entry-card table-shuangsheng table-card-developing">
          <div className="table-card-header">
            <div className="table-title-area">
              <span className="table-emblem">♠️</span>
              <div>
                <div className="table-title-row">
                  <h2 className="table-name">2号桌 · 双升 (拖拉机)</h2>
                  <span className="table-capacity-pill">4人桌 (2v2)</span>
                </div>
                <p className="table-desc">两副牌升级 · 经典对家打过A · 扣底抓分</p>
              </div>
            </div>

            <div className="table-status-area">
              <span className="status-badge badge-developing">🚧 开发中</span>
            </div>
          </div>

          <div className="table-mini-seats-preview developing-preview">
            <div className="developing-notice">
              <span>🛠️ 双升游戏引擎与规则模块正在火热研发中，即将发布！</span>
            </div>
          </div>

          <div className="table-card-footer">
            <button
              type="button"
              className="table-action-btn btn-developing"
              onClick={() => showToast('♠️ 双升（拖拉机）玩法正在研发中，敬请期待下一版本！')}
            >
              ⏳ 研发中 · 敬请期待
            </button>
          </div>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="room-tables-footer">
        <p className="room-rule-note">
          💡 每张牌桌严格支持 4 位玩家。游戏开始后席位锁定，新访问者可查看桌况与空位。随时支持中途安全退出。
        </p>
      </div>

      {/* 浮动轻提示 */}
      {toastMsg && <div className="room-tables-toast">{toastMsg}</div>}
    </div>
  );
}
