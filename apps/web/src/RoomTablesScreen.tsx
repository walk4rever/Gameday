import { useEffect, useState } from 'react';
import { useOrientation } from './useOrientation.js';
import { getOrCreatePlayerId } from './game/playerId.js';
import { generateShareText, recordVisitedRoom } from './game/roomManager.js';
import { CreateRoomModal } from './components/CreateRoomModal.js';
import { RoomSwitcherModal } from './components/RoomSwitcherModal.js';
import { HeaderMenu } from './components/HeaderMenu.js';

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
  roomName?: string;
  hasPassword?: boolean;
  tables: TableInfo[];
}

interface RoomTablesScreenProps {
  room: string;
  playerName: string;
  onSelectTable: (tableId: string, seat?: number) => void;
  onShowRules: () => void;
  onChangeNameOrRoom: () => void;
  onSwitchRoom: (newRoom: string) => void;
}

interface SeatMeta {
  seat: number;
  dir: 'north' | 'south' | 'west' | 'east';
  label: string;
  team: 'NS' | 'EW';
  teamName: string;
  partnerSeat: number;
}

// 掼蛋规范：
// 0: 南 (South), 2: 北 (North) => 南北搭档 (NS)
// 1: 东 (East),  3: 西 (West)  => 东西搭档 (EW)
const SEAT_METAS: Record<number, SeatMeta> = {
  2: { seat: 2, dir: 'north', label: '北', team: 'NS', teamName: '南北搭档', partnerSeat: 0 },
  0: { seat: 0, dir: 'south', label: '南', team: 'NS', teamName: '南北搭档', partnerSeat: 2 },
  3: { seat: 3, dir: 'west',  label: '西', team: 'EW', teamName: '东西搭档', partnerSeat: 1 },
  1: { seat: 1, dir: 'east',  label: '东', team: 'EW', teamName: '东西搭档', partnerSeat: 3 }
};

const DEFAULT_SEATS_1: TableSeatInfo[] = [
  { seat: 0, name: '机器人 1', isBot: true, connected: false, status: 'online' },
  { seat: 1, name: '机器人 2', isBot: true, connected: false, status: 'online' },
  { seat: 2, name: '机器人 3', isBot: true, connected: false, status: 'online' },
  { seat: 3, name: '机器人 4', isBot: true, connected: false, status: 'online' }
];

const DEFAULT_SEATS_2: TableSeatInfo[] = [
  { seat: 0, name: '待开放', isBot: true, connected: false, status: 'online' },
  { seat: 1, name: '待开放', isBot: true, connected: false, status: 'online' },
  { seat: 2, name: '待开放', isBot: true, connected: false, status: 'online' },
  { seat: 3, name: '待开放', isBot: true, connected: false, status: 'online' }
];

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
    }
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const success = document.execCommand('copy');
    textArea.remove();
    return success;
  } catch {
    textArea.remove();
    return false;
  }
}

export function RoomTablesScreen({
  room,
  playerName,
  onSelectTable,
  onShowRules,
  onChangeNameOrRoom,
  onSwitchRoom
}: RoomTablesScreenProps) {
  const { isLandscape, needsForcedRotation, toggleOrientation } = useOrientation();
  const myPlayerId = getOrCreatePlayerId();

  const [roomMeta, setRoomMeta] = useState<{ name: string; hasPassword: boolean }>({
    name: room === 'default' ? '公共大厅' : '家庭游戏室',
    hasPassword: false
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const [initialCreateName, setInitialCreateName] = useState<string | undefined>(undefined);

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
      seats: DEFAULT_SEATS_1
    },
    {
      id: '2',
      name: '2号桌 · 经典双升',
      type: 'shuangsheng',
      gameActive: false,
      isFull: false,
      isMember: false,
      humanSeatsCount: 0,
      maxSeats: 4,
      status: 'developing',
      seats: DEFAULT_SEATS_2
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/room-status?room=${encodeURIComponent(room)}&playerId=${encodeURIComponent(myPlayerId)}`
      );
      if (res.ok) {
        const data = (await res.json()) as RoomStatusResponse;
        if (data.roomName) {
          setRoomMeta({
            name: data.roomName,
            hasPassword: Boolean(data.hasPassword)
          });
          recordVisitedRoom({
            roomId: room,
            name: data.roomName,
            hasPassword: Boolean(data.hasPassword)
          });
        }
        if (data.tables && Array.isArray(data.tables)) {
          setTables(data.tables);
        }
      }
    } catch {
      // 忽略网络波动
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

  const handleInvite = async () => {
    const shareText = generateShareText({
      roomId: room,
      roomName: roomMeta.name,
      hasPassword: roomMeta.hasPassword
    });

    const success = await copyTextToClipboard(shareText);
    if (success) {
      showToast('🎉 已复制微信邀请文案！直接发给微信好友/家人即可入座');
    } else {
      showToast('未能自动复制，请复制当前浏览器地址发给家人');
    }
  };

  const handleRoomCreated = (newRoomId: string, newRoomName: string, password?: string) => {
    setShowCreateModal(false);
    onSwitchRoom(newRoomId);
    const shareText = generateShareText({
      roomId: newRoomId,
      roomName: newRoomName,
      hasPassword: Boolean(password),
      ...(password !== undefined ? { password } : {})
    });
    void copyTextToClipboard(shareText);
    showToast(`🏡 已创建房间「${newRoomName}」，邀请文案已复制到剪贴板！`);
  };

  return (
    <div
      className={`app room-tables-page ${isLandscape ? 'landscape-mode' : ''} ${
        needsForcedRotation ? 'app-forced-landscape' : ''
      }`}
    >
      {/* 极简顶部条：房间名、定制邀请、换房与控制 */}
      <header className="room-tables-header minimal-header">
        <div
          className="room-info-minimal clickable-room-title"
          onClick={() => setShowSwitcherModal(true)}
          title="点击切换或查看常用房间"
        >
          <span className="room-symbol">🏡</span>
          <div className="room-meta-group">
            <div className="room-name-row">
              <span className="room-title-text">{roomMeta.name}</span>
              {roomMeta.hasPassword && (
                <span className="room-badge-lock" title="6位密码保护房间">
                  🔒
                </span>
              )}
              <span className="room-code-badge">{room}</span>
              <span className="room-arrow-down">▾</span>
            </div>
            <span className="room-player-tag">
              玩家: <strong>{playerName}</strong>
            </span>
          </div>
        </div>

        <div className="room-header-btns">
          <button
            className="room-highlight-btn invite-btn"
            onClick={() => void handleInvite()}
            title="一键复制微信邀请文案发给家人"
          >
            📤 邀请家人
          </button>
          <HeaderMenu
            title="房间选项与设置"
            triggerIcon="⚙️"
            triggerLabel="选项"
            items={[
              {
                id: 'switch-room',
                icon: '🚪',
                label: '切换房间',
                sublabel: '搜索或切换到常去房间',
                onClick: () => setShowSwitcherModal(true)
              },
              {
                id: 'create-room',
                icon: '➕',
                label: '新建专属房间',
                sublabel: '定制家庭/好友专属牌室',
                onClick: () => setShowCreateModal(true)
              },
              {
                id: 'orientation',
                icon: '📱',
                label: isLandscape ? '切换为竖屏' : '切换为横屏',
                badge: isLandscape ? '横屏中' : '竖屏中',
                onClick: toggleOrientation
              },
              {
                id: 'rules',
                icon: '📖',
                label: '掼蛋规则速查',
                sublabel: '牌型、炸弹与升级规则',
                onClick: onShowRules
              },
              {
                id: 'refresh',
                icon: '🔄',
                label: '手动刷新桌况',
                onClick: () => void fetchStatus()
              },
              {
                id: 'exit',
                icon: '←',
                label: '返回门户 / 退出',
                danger: true,
                onClick: onChangeNameOrRoom
              }
            ]}
          />
        </div>
      </header>

      {/* 1号桌与2号桌：极简东南西北桌面 */}
      <main className="tables-list-container minimal-tables-grid">
        {tables.map((table) => (
          <MinimalTableArena
            key={table.id}
            table={table}
            myPlayerId={myPlayerId}
            onSelectTable={onSelectTable}
            onShowToast={showToast}
          />
        ))}
      </main>

      {/* 创建房间弹窗 */}
      {showCreateModal && (
        <CreateRoomModal
          playerName={playerName}
          initialName={initialCreateName}
          onClose={() => {
            setShowCreateModal(false);
            setInitialCreateName(undefined);
          }}
          onCreated={handleRoomCreated}
        />
      )}

      {/* 常用房间切换弹窗 */}
      {showSwitcherModal && (
        <RoomSwitcherModal
          currentRoom={room}
          onSelectRoom={(newRoomId) => {
            setShowSwitcherModal(false);
            onSwitchRoom(newRoomId);
          }}
          onOpenCreate={(name) => {
            setInitialCreateName(name);
            setShowCreateModal(true);
          }}
          onClose={() => setShowSwitcherModal(false)}
        />
      )}

      {/* 浮动轻提示 */}
      {toastMsg && <div className="room-tables-toast">{toastMsg}</div>}
    </div>
  );
}

interface MinimalTableArenaProps {
  table: TableInfo;
  myPlayerId: string;
  onSelectTable: (tableId: string, seat?: number) => void;
  onShowToast: (msg: string) => void;
}

function MinimalTableArena({
  table,
  myPlayerId,
  onSelectTable,
  onShowToast
}: MinimalTableArenaProps) {
  const isDeveloping = table.type === 'shuangsheng' || table.status === 'developing';
  const isLocked = !isDeveloping && Boolean((table.isFull || table.gameActive) && !table.isMember);
  const seats = table.seats ?? (isDeveloping ? DEFAULT_SEATS_2 : DEFAULT_SEATS_1);

  const mySeat = seats.find((s) => s.playerId === myPlayerId && !s.isBot);
  const mySeatMeta = mySeat !== undefined ? SEAT_METAS[mySeat.seat] : undefined;

  const handleSeatClick = (cfg: SeatMeta) => {
    if (isDeveloping) {
      onShowToast('♠️ 2号桌 · 经典双升正在全力研发中，敬请期待！');
      return;
    }

    const seatData = seats.find((s) => s.seat === cfg.seat);
    const hasHuman = Boolean(seatData && !seatData.isBot && seatData.playerId);
    const isMe = Boolean(hasHuman && seatData?.playerId === myPlayerId);

    if (isMe) {
      onSelectTable(table.id, cfg.seat);
      return;
    }
    if (isLocked) {
      onShowToast('⚠️ 该桌对局正在进行且已满员锁定');
      return;
    }
    if (hasHuman) {
      onShowToast(`🪑 该位置已有玩家【${seatData?.name}】入座`);
      return;
    }
    onSelectTable(table.id, cfg.seat);
  };

  const handleQuickJoin = () => {
    if (isDeveloping) {
      onShowToast('♠️ 2号桌 · 经典双升研发中，敬请期待！');
      return;
    }
    if (table.isMember && mySeatMeta) {
      onSelectTable(table.id, mySeatMeta.seat);
    } else {
      onSelectTable(table.id);
    }
  };

  const renderSeat = (cfg: SeatMeta) => {
    const seatData = seats.find((s) => s.seat === cfg.seat);
    const partnerData = seats.find((s) => s.seat === cfg.partnerSeat);

    const hasHuman = !isDeveloping && Boolean(seatData && !seatData.isBot && seatData.playerId);
    const isMe = Boolean(hasHuman && seatData?.playerId === myPlayerId);
    const hasPartner = !isDeveloping && Boolean(partnerData && !partnerData.isBot && partnerData.playerId);

    const isAvailable = !isDeveloping && !hasHuman && !isLocked;

    return (
      <div
        key={cfg.seat}
        className={`minimal-seat seat-${cfg.dir} seat-team-${cfg.team.toLowerCase()} ${
          isMe ? 'seat-me' : hasHuman ? 'seat-occupied' : 'seat-vacant'
        } ${isAvailable ? 'seat-clickable' : ''}`}
        onClick={() => handleSeatClick(cfg)}
        title={
          isDeveloping
            ? '研发中'
            : isMe
              ? '您的席位，点击返回'
              : isAvailable
                ? `点击入座 ${cfg.label}席 (${cfg.teamName})`
                : hasHuman
                  ? `已入座: ${seatData?.name}`
                  : ''
        }
      >
        <div className="seat-dir-tag">
          <span className="dir-name">{cfg.label}</span>
          <span className={`team-dot dot-${cfg.team.toLowerCase()}`} />
        </div>

        <div className="seat-user-info">
          {isDeveloping ? (
            <span className="seat-placeholder">待开放</span>
          ) : isMe ? (
            <div className="seat-human-row">
              <span className="seat-name-text me-text">{seatData?.name}</span>
              <span className="me-pill">我</span>
            </div>
          ) : hasHuman ? (
            <div className="seat-human-row">
              <span className="seat-name-text">{seatData?.name}</span>
              <span
                className={`status-mini-dot ${
                  seatData?.status === 'offline'
                    ? 'dot-offline'
                    : seatData?.connected
                      ? 'dot-online'
                      : 'dot-offline'
                }`}
              />
            </div>
          ) : hasPartner ? (
            <span className="seat-partner-invite">🤝 搭档 {partnerData?.name}</span>
          ) : (
            <span className="seat-empty-text">+ 入座</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`minimal-table-card ${isDeveloping ? 'card-developing' : ''}`}>
      {/* 东南西北真实方桌布局，1/2号桌标志卡片位于正中央 */}
      <div className="minimal-felt-table">
        {/* 北席 (Top, Seat 2) */}
        {renderSeat(SEAT_METAS[2]!)}

        {/* 西席 (Left, Seat 3) */}
        {renderSeat(SEAT_METAS[3]!)}

        {/* 桌子中央标志卡片 (用户指定：1号桌与2号桌的标志卡片在桌子中央) */}
        <div
          className={`table-center-badge-card ${isDeveloping ? 'center-developing' : ''}`}
          onClick={handleQuickJoin}
        >
          <div className="center-card-top">
            <span className="center-card-emblem">{isDeveloping ? '♠️' : '🎴'}</span>
            <span className="center-card-title">{table.name}</span>
          </div>

          <div className="center-card-status">
            {isDeveloping ? (
              <span className="center-status-tag tag-developing">🚧 开发中 · 敬请期待</span>
            ) : table.gameActive ? (
              <span className="center-status-tag tag-playing">
                <span className="pulse-dot-red" />
                激战中 ({table.humanSeatsCount}/4)
              </span>
            ) : table.humanSeatsCount >= 4 ? (
              <span className="center-status-tag tag-full">已满员 (4/4)</span>
            ) : table.humanSeatsCount > 0 ? (
              <span className="center-status-tag tag-waiting">
                <span className="pulse-dot-green" />
                组队中 ({table.humanSeatsCount}/4)
              </span>
            ) : (
              <span className="center-status-tag tag-empty">🟢 空闲可入座</span>
            )}
          </div>

          {!isDeveloping && (
            <span className="center-card-hint">
              {table.isMember ? '▶️ 点击回到对局' : '点击空位自主挑选对家'}
            </span>
          )}
        </div>

        {/* 东席 (Right, Seat 1) */}
        {renderSeat(SEAT_METAS[1]!)}

        {/* 南席 (Bottom, Seat 0) */}
        {renderSeat(SEAT_METAS[0]!)}
      </div>

      {/* 桌底快速入座操作条 */}
      <div className="minimal-table-footer">
        {isDeveloping ? (
          <button
            type="button"
            className="minimal-action-btn btn-dev-disabled"
            onClick={() => onShowToast('♠️ 经典双升（拖拉机）即将发布，敬请期待！')}
          >
            ⏳ 双升玩法研发中
          </button>
        ) : isLocked ? (
          <button type="button" className="minimal-action-btn btn-full-locked" disabled>
            🔒 本桌对局满员进行中
          </button>
        ) : table.isMember && mySeatMeta ? (
          <button
            type="button"
            className="minimal-action-btn btn-rejoin-primary"
            onClick={handleQuickJoin}
          >
            🃏 继续我的对局 (坐{mySeatMeta.label}席) →
          </button>
        ) : (
          <button
            type="button"
            className="minimal-action-btn btn-quick-join"
            onClick={handleQuickJoin}
          >
            🎲 快速入座 (自动分配席位) →
          </button>
        )}
      </div>
    </div>
  );
}
