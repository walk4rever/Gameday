import { useEffect, useState } from 'react';
import { useOrientation } from './useOrientation.js';
import { getOrCreatePlayerId } from './game/playerId.js';

export interface TableSeatInfo {
  seat: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  playerId?: string | null;
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
  onSelectTable: (tableId: string, seat?: number) => void;
  onShowRules: () => void;
  onChangeNameOrRoom: () => void;
}

export interface SeatDirectionMeta {
  seat: number;
  direction: 'north' | 'south' | 'west' | 'east';
  chineseDir: string;
  englishDir: string;
  teamId: 0 | 1;
  teamName: string;
  teamIcon: string;
  partnerSeat: number;
  partnerDir: string;
}

// 掼蛋官方规范：
// Seat 0 = 南 (South), 队 0 (南北搭档)
// Seat 1 = 东 (East), 队 1 (东西搭档)
// Seat 2 = 北 (North), 队 0 (南北搭档)
// Seat 3 = 西 (West), 队 1 (东西搭档)
export const SEAT_CONFIGS: Record<number, SeatDirectionMeta> = {
  2: {
    seat: 2,
    direction: 'north',
    chineseDir: '北',
    englishDir: 'North',
    teamId: 0,
    teamName: '南北队',
    teamIcon: '🛡️',
    partnerSeat: 0,
    partnerDir: '南'
  },
  0: {
    seat: 0,
    direction: 'south',
    chineseDir: '南',
    englishDir: 'South',
    teamId: 0,
    teamName: '南北队',
    teamIcon: '🛡️',
    partnerSeat: 2,
    partnerDir: '北'
  },
  3: {
    seat: 3,
    direction: 'west',
    chineseDir: '西',
    englishDir: 'West',
    teamId: 1,
    teamName: '东西队',
    teamIcon: '⚔️',
    partnerSeat: 1,
    partnerDir: '东'
  },
  1: {
    seat: 1,
    direction: 'east',
    chineseDir: '东',
    englishDir: 'East',
    teamId: 1,
    teamName: '东西队',
    teamIcon: '⚔️',
    partnerSeat: 3,
    partnerDir: '西'
  }
};

const DEFAULT_SEATS: TableSeatInfo[] = [
  { seat: 0, name: '机器人 1', isBot: true, connected: false, status: 'online' },
  { seat: 1, name: '机器人 2', isBot: true, connected: false, status: 'online' },
  { seat: 2, name: '机器人 3', isBot: true, connected: false, status: 'online' },
  { seat: 3, name: '机器人 4', isBot: true, connected: false, status: 'online' }
];

export function RoomTablesScreen({
  room,
  playerName,
  onSelectTable,
  onShowRules,
  onChangeNameOrRoom
}: RoomTablesScreenProps) {
  const { isLandscape, needsForcedRotation, toggleOrientation } = useOrientation();
  const myPlayerId = getOrCreatePlayerId();

  const [tables, setTables] = useState<TableInfo[]>([
    {
      id: '1',
      name: '1号桌 · 经典掼蛋',
      type: 'guandan',
      gameActive: false,
      isFull: false,
      isMember: false,
      humanSeatsCount: 0,
      maxSeats: 4,
      status: 'empty',
      seats: DEFAULT_SEATS
    },
    {
      id: '2',
      name: '2号桌 · 经典掼蛋',
      type: 'guandan',
      gameActive: false,
      isFull: false,
      isMember: false,
      humanSeatsCount: 0,
      maxSeats: 4,
      status: 'empty',
      seats: DEFAULT_SEATS
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/room-status?room=${encodeURIComponent(room)}&playerId=${encodeURIComponent(myPlayerId)}`
      );
      if (res.ok) {
        const data = (await res.json()) as RoomStatusResponse;
        if (data.tables && Array.isArray(data.tables)) {
          setTables(data.tables);
        }
      }
    } catch {
      // 忽略短暂网络波动
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

      {/* 提示横幅：解释对家搭档机制与方向 */}
      <div className="room-team-guide-banner">
        <div className="guide-item">
          <span className="guide-badge badge-team-ns">🛡️ 南北对家 (搭档)</span>
          <span className="guide-text">南席 (0号) ↔ 北席 (2号)</span>
        </div>
        <div className="guide-divider">VS</div>
        <div className="guide-item">
          <span className="guide-badge badge-team-ew">⚔️ 东西对家 (搭档)</span>
          <span className="guide-text">东席 (1号) ↔ 西席 (3号)</span>
        </div>
        <span className="guide-tip-hint">👉 点击桌边空椅子即可精准挑选对家入座</span>
      </div>

      {/* 牌桌列表区（1号桌 与 2号桌 东南西北布局） */}
      <div className="tables-list-container">
        {tables.map((table) => (
          <DirectionalTableCard
            key={table.id}
            table={table}
            myPlayerId={myPlayerId}
            onSelectTable={onSelectTable}
            onShowToast={showToast}
          />
        ))}
      </div>

      {/* 底部提示 */}
      <div className="room-tables-footer">
        <p className="room-rule-note">
          💡 掼蛋 2v2 核心机制：坐对面的玩家为搭档，顺时针出牌。若想与朋友联手，请点击其对面方向的空椅子入座！
        </p>
      </div>

      {/* 浮动轻提示 */}
      {toastMsg && <div className="room-tables-toast">{toastMsg}</div>}
    </div>
  );
}

interface DirectionalTableCardProps {
  table: TableInfo;
  myPlayerId: string;
  onSelectTable: (tableId: string, seat?: number) => void;
  onShowToast: (msg: string) => void;
}

function DirectionalTableCard({
  table,
  myPlayerId,
  onSelectTable,
  onShowToast
}: DirectionalTableCardProps) {
  const isLocked = Boolean((table.isFull || table.gameActive) && !table.isMember);
  const seats = table.seats ?? DEFAULT_SEATS;

  // 检查当前玩家是否已入座本桌
  const mySeat = seats.find((s) => s.playerId === myPlayerId && !s.isBot);
  const mySeatMeta = mySeat !== undefined ? SEAT_CONFIGS[mySeat.seat] : undefined;

  const renderChair = (cfg: SeatDirectionMeta) => {
    const seatData = seats.find((s) => s.seat === cfg.seat);
    const partnerData = seats.find((s) => s.seat === cfg.partnerSeat);

    const hasHuman = Boolean(seatData && !seatData.isBot && seatData.playerId);
    const isMe = Boolean(hasHuman && seatData?.playerId === myPlayerId);
    const hasPartnerHuman = Boolean(partnerData && !partnerData.isBot && partnerData.playerId);

    const isAvailable = !hasHuman && !isLocked;
    const isTeamNS = cfg.teamId === 0;

    const handleChairClick = () => {
      if (isMe) {
        // 重回我自己的席位
        onSelectTable(table.id, cfg.seat);
        return;
      }
      if (isLocked) {
        onShowToast('⚠️ 该桌对局正在进行且已满员锁定，无法入座');
        return;
      }
      if (hasHuman) {
        onShowToast(`🪑 该席位已被玩家【${seatData?.name}】入座，请选择其他空座`);
        return;
      }
      // 空闲席位或机器人席位：直接入座该席位
      onSelectTable(table.id, cfg.seat);
    };

    return (
      <div
        key={cfg.seat}
        className={`chair-node chair-${cfg.direction} ${isTeamNS ? 'team-ns' : 'team-ew'} ${
          isMe ? 'chair-me' : hasHuman ? 'chair-occupied' : 'chair-vacant'
        } ${isAvailable ? 'chair-clickable' : ''}`}
        onClick={handleChairClick}
        title={
          isMe
            ? '这是您的席位，点击回到对局'
            : isAvailable
              ? `点击入座 ${cfg.chineseDir}席（成为 ${cfg.teamName}）`
              : hasHuman
                ? `已入座：${seatData?.name}`
                : '桌子已锁定'
        }
      >
        {/* 椅子顶部方向与战队标记 */}
        <div className="chair-header-row">
          <span className="chair-dir-badge">
            {cfg.chineseDir} ({cfg.englishDir})
          </span>
          <span className="chair-team-pill">
            {cfg.teamIcon} {cfg.teamName}
          </span>
        </div>

        {/* 椅子主体内容：玩家/空位信息 */}
        <div className="chair-body">
          <div className="chair-avatar-wrap">
            {isMe ? (
              <span className="chair-avatar avatar-me">👑</span>
            ) : hasHuman ? (
              <span className="chair-avatar avatar-human">👤</span>
            ) : (
              <span className="chair-avatar avatar-empty">🪑</span>
            )}
            {hasHuman && (
              <span
                className={`chair-status-dot ${
                  seatData?.status === 'offline'
                    ? 'dot-offline'
                    : seatData?.status === 'left'
                      ? 'dot-left'
                      : seatData?.connected
                        ? 'dot-online'
                        : 'dot-offline'
                }`}
                title={
                  seatData?.status === 'offline'
                    ? '离线/掉线'
                    : seatData?.status === 'left'
                      ? '已离开'
                      : '在线'
                }
              />
            )}
          </div>

          <div className="chair-text-info">
            {isMe ? (
              <div className="chair-name chair-name-me">
                <span>{seatData?.name}</span>
                <span className="me-badge">我</span>
              </div>
            ) : hasHuman ? (
              <div className="chair-name">
                <span>{seatData?.name}</span>
              </div>
            ) : (
              <div className="chair-vacant-label">
                <span>空位 (机器人替补)</span>
              </div>
            )}

            {/* 对家关系智能提示 */}
            <div className="chair-sub-tip">
              {isMe ? (
                <span className="tip-partner-info">
                  {hasPartnerHuman ? `搭档：${partnerData?.name}` : `对家搭档待入座`}
                </span>
              ) : hasHuman ? (
                <span className="tip-seated-info">
                  {seatData?.connected ? '🟢 在线就绪' : '🔴 暂时离线'}
                </span>
              ) : hasPartnerHuman ? (
                <span className="tip-partner-invite">
                  🤝 与<strong>【{partnerData?.name}】</strong>搭档
                </span>
              ) : (
                <span className="tip-click-join">👈 点击入座此席</span>
              )}
            </div>
          </div>
        </div>

        {/* 底部交互状态按钮条 */}
        <div className="chair-action-bar">
          {isMe ? (
            <span className="chair-btn btn-rejoin">▶️ 回到座位</span>
          ) : isAvailable ? (
            <span className="chair-btn btn-claim">
              {hasPartnerHuman ? '🪑 入座对家' : '🪑 点击入座'}
            </span>
          ) : hasHuman ? (
            <span className="chair-btn btn-occupied">已入座</span>
          ) : (
            <span className="chair-btn btn-locked">锁定</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`table-entry-card table-guandan ${isLocked ? 'table-card-locked' : ''}`}>
      {/* 牌桌卡片头部：桌号与状态 */}
      <div className="table-card-header">
        <div className="table-title-area">
          <span className="table-emblem">🎴</span>
          <div>
            <div className="table-title-row">
              <h2 className="table-name">{table.name}</h2>
              <span className="table-capacity-pill">4人桌 (2v2)</span>
            </div>
            <p className="table-desc">经典淮安掼蛋 · 顺时针出牌 · 南北搭档 ⚔️ 东西搭档</p>
          </div>
        </div>

        {/* 状态徽章 */}
        <div className="table-status-area">
          {table.gameActive ? (
            <span className="status-badge badge-playing">
              <span className="badge-pulse-dot dot-red" />
              对局进行中 ({table.humanSeatsCount}/4)
            </span>
          ) : table.humanSeatsCount >= 4 ? (
            <span className="status-badge badge-full">
              <span className="badge-pulse-dot dot-yellow" />
              已满员 (4/4)
            </span>
          ) : table.humanSeatsCount > 0 ? (
            <span className="status-badge badge-waiting">
              <span className="badge-pulse-dot dot-green" />
              组队中 ({table.humanSeatsCount}/4)
            </span>
          ) : (
            <span className="status-badge badge-empty">
              <span className="badge-pulse-dot dot-green" />
              空闲桌 (随时开局)
            </span>
          )}
        </div>
      </div>

      {/* 东南西北真实方桌竞技场视图 */}
      <div className="table-felt-arena">
        {/* 北席 (Top, Seat 2) */}
        {renderChair(SEAT_CONFIGS[2]!)}

        {/* 西席 (Left, Seat 3) */}
        {renderChair(SEAT_CONFIGS[3]!)}

        {/* 中央绿呢方桌台面 */}
        <div className="felt-table-surface">
          {/* 十字连线：南北搭档线 & 东西搭档线 */}
          <div className="felt-crossline felt-line-ns" title="南北对家搭档线">
            <span className="crossline-label">南北对家 🛡️</span>
          </div>
          <div className="felt-crossline felt-line-ew" title="东西对家搭档线">
            <span className="crossline-label">东西对家 ⚔️</span>
          </div>

          {/* 牌桌中央徽章 */}
          <div className="felt-center-emblem">
            <span className="felt-table-badge">{table.name.slice(0, 3)}</span>
            <span className="felt-sub-text">绿呢牌桌</span>
            <span className="felt-mode-pill">经典掼蛋</span>
          </div>
        </div>

        {/* 东席 (Right, Seat 1) */}
        {renderChair(SEAT_CONFIGS[1]!)}

        {/* 南席 (Bottom, Seat 0) */}
        {renderChair(SEAT_CONFIGS[0]!)}
      </div>

      {/* 底部快速操作栏 */}
      <div className="table-card-footer">
        {isLocked ? (
          <div className="locked-warning-box">
            <span className="locked-warning-text">
              ⚠️ 本桌游戏已开始且满员（4人锁定），第 5 人无法加入。请选择另一桌或等待对局结束。
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
        ) : table.isMember && mySeatMeta ? (
          <button
            type="button"
            className="primary-action-btn pulse-glow table-action-btn"
            onClick={() => onSelectTable(table.id, mySeatMeta.seat)}
          >
            🃏 继续我的对局 (坐在 {mySeatMeta.chineseDir}席 · {mySeatMeta.teamName}) →
          </button>
        ) : (
          <div className="table-join-actions">
            <button
              type="button"
              className="primary-action-btn pulse-glow table-action-btn"
              onClick={() => onSelectTable(table.id)}
            >
              🎲 快速入座 (自动选座) →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
