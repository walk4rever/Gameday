import { useEffect, useState } from 'react';
import { AuthScreen } from './AuthScreen.js';
import { GameScreen } from './GameScreen.js';
import { RulesModal } from './RulesModal.js';
import { SelectRoomScreen } from './SelectRoomScreen.js';
import { RoomPasswordModal } from './components/RoomPasswordModal.js';
import { getCurrentUser, logoutUser } from './game/playerId.js';
import { getRoomAuthToken, recordVisitedRoom } from './game/roomManager.js';
import { useOnlineGame } from './game/useOnlineGame.js';

type Mode =
  | { kind: 'auth' }
  | { kind: 'select_room'; name: string }
  | { kind: 'online'; name: string; room: string; tableId: string; preferredSeat?: number };

function defaultWsUrl(roomName: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${protocol}//${window.location.host}/ws`);
  url.searchParams.set('room', roomName);
  return url.toString();
}

function getServerUrl(roomName: string, tableId?: string, seat?: number): string {
  const base = import.meta.env.VITE_WS_URL || defaultWsUrl(roomName);
  const url = new URL(base);
  url.searchParams.set('room', roomName);
  const token = getRoomAuthToken(roomName);
  if (token) {
    url.searchParams.set('roomToken', token);
  }
  const table = tableId === '2' ? '2' : '1';
  url.searchParams.set('table', table);
  if (seat !== undefined && seat !== null) {
    url.searchParams.set('seat', String(seat));
  }
  return url.toString();
}

export function App() {
  const [mode, setMode] = useState<Mode>(() => {
    const user = getCurrentUser();
    const roomParam = new URLSearchParams(window.location.search).get('room');
    if (user && user.username) {
      if (roomParam && roomParam !== 'default') {
        recordVisitedRoom(roomParam, roomParam);
        return { kind: 'online', name: user.username, room: roomParam, tableId: '1' };
      }
      return { kind: 'select_room', name: user.username };
    }
    return { kind: 'auth' };
  });

  const [passwordRequiredRoom, setPasswordRequiredRoom] = useState<{
    roomId: string;
    roomName: string;
  } | null>(null);

  const [showGlobalRules, setShowGlobalRules] = useState(false);

  // 进入指定房间（直通游戏牌桌）
  const enterRoom = (newRoom: string) => {
    const cleanRoom = newRoom.trim();
    if (!cleanRoom) return;
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('room', cleanRoom);
    window.history.replaceState({}, '', currentUrl.toString());

    recordVisitedRoom(cleanRoom, cleanRoom);

    setMode((prev) => {
      const name = 'name' in prev ? prev.name : (getCurrentUser()?.username || '玩家');
      return { kind: 'online', name, room: cleanRoom, tableId: '1' };
    });
  };

  // 退出房间回到房间选择大厅
  const returnToSelectRoom = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('room');
    window.history.replaceState({}, '', currentUrl.toString());

    setMode((prev) => {
      const name = 'name' in prev ? prev.name : (getCurrentUser()?.username || '玩家');
      return { kind: 'select_room', name };
    });
  };

  // 检测当前房间是否需要密码拦截
  useEffect(() => {
    if (mode.kind !== 'online') {
      setPasswordRequiredRoom(null);
      return;
    }
    const currentRoom = mode.room;
    if (!currentRoom) {
      setPasswordRequiredRoom(null);
      return;
    }

    const token = getRoomAuthToken(currentRoom);
    let cancelled = false;

    void fetch(`/api/room/meta?room=${encodeURIComponent(currentRoom)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; hasPassword?: boolean; name?: string } | null) => {
        if (cancelled) return;
        if (data?.hasPassword) {
          if (!token) {
            setPasswordRequiredRoom({
              roomId: currentRoom,
              roomName: data.name || '专属房间'
            });
          } else {
            setPasswordRequiredRoom(null);
          }
        } else {
          setPasswordRequiredRoom(null);
        }
      })
      .catch(() => {
        // 网络异常暂不强拦截
      });

    return () => {
      cancelled = true;
    };
  }, [mode.kind, mode.kind === 'online' ? mode.room : '']);

  return (
    <>
      {mode.kind === 'auth' && (
        <AuthScreen
          onSuccess={(user) => {
            const roomParam = new URLSearchParams(window.location.search).get('room');
            if (roomParam && roomParam !== 'default') {
              recordVisitedRoom(roomParam, roomParam);
              setMode({ kind: 'online', name: user.username, room: roomParam, tableId: '1' });
            } else {
              setMode({ kind: 'select_room', name: user.username });
            }
          }}
          onShowRules={() => setShowGlobalRules(true)}
        />
      )}

      {mode.kind === 'select_room' && (
        <SelectRoomScreen
          playerName={mode.name}
          onSelectRoom={(roomId) => enterRoom(roomId)}
          onShowRules={() => setShowGlobalRules(true)}
          onLogout={() => {
            logoutUser();
            setMode({ kind: 'auth' });
          }}
        />
      )}

      {mode.kind === 'online' && (
        <OnlineGame
          name={mode.name}
          room={mode.room}
          tableId={mode.tableId}
          {...(mode.preferredSeat !== undefined ? { preferredSeat: mode.preferredSeat } : {})}
          onExit={returnToSelectRoom}
          onShowRules={() => setShowGlobalRules(true)}
        />
      )}

      {passwordRequiredRoom && (
        <RoomPasswordModal
          roomId={passwordRequiredRoom.roomId}
          roomName={passwordRequiredRoom.roomName}
          onSuccess={() => {
            setPasswordRequiredRoom(null);
          }}
          onCancel={() => {
            setPasswordRequiredRoom(null);
            returnToSelectRoom();
          }}
        />
      )}

      {showGlobalRules && <RulesModal onClose={() => setShowGlobalRules(false)} />}
    </>
  );
}

function OnlineGame({
  name,
  room,
  tableId,
  preferredSeat,
  onExit,
  onShowRules
}: {
  name: string;
  room: string;
  tableId: string;
  preferredSeat?: number | undefined;
  onExit: () => void;
  onShowRules: () => void;
}) {
  const wsUrl = getServerUrl(room, tableId, preferredSeat);
  const { status, view, leave } = useOnlineGame(wsUrl, name);

  const handleExit = () => {
    leave();
    onExit();
  };

  if (view.phase === 'connecting') {
    return (
      <div className="app menu connecting-page">
        <div className="connecting-card">
          <div className="loading-spinner" />
          <p className="connecting-text">
            {status === 'closed'
              ? '连接已断开，或本桌对局已满员（4人锁定）无法加入…'
              : `正在进入房间【${room}】…`}
          </p>
          <button className="secondary-action-btn" onClick={handleExit}>
            ← 返回选房大厅
          </button>
        </div>
      </div>
    );
  }

  return (
    <GameScreen
      game={view.game}
      room={room}
      onExit={handleExit}
      banner={
        status === 'open' ? undefined : (
          <div className="online-reconnecting-banner">
            <span className="pulse-warning-dot" />
            <span>网络连接中断，正在自动重连中…</span>
          </div>
        )
      }
    />
  );
}
