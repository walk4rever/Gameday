import { useEffect, useState } from 'react';
import { AuthScreen } from './AuthScreen.js';
import { GameScreen } from './GameScreen.js';
import { LobbyScreen } from './LobbyScreen.js';
import { RoomTablesScreen } from './RoomTablesScreen.js';
import { RulesModal } from './RulesModal.js';
import { RoomPasswordModal } from './components/RoomPasswordModal.js';
import { getCurrentUser, logoutUser } from './game/playerId.js';
import { getRoomAuthToken } from './game/roomManager.js';
import { useOnlineGame } from './game/useOnlineGame.js';

type Mode =
  | { kind: 'auth' }
  | { kind: 'tables'; name: string; room: string }
  | { kind: 'online'; name: string; room: string; tableId: string; preferredSeat?: number };

function defaultWsUrl(roomName?: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const room = roomName ?? new URLSearchParams(window.location.search).get('room') ?? 'default';
  const url = new URL(`${protocol}//${window.location.host}/ws`);
  url.searchParams.set('room', room);
  return url.toString();
}

function getServerUrl(roomName?: string, tableId?: string, seat?: number): string {
  const base = import.meta.env.VITE_WS_URL || defaultWsUrl(roomName);
  const url = new URL(base);
  if (roomName) {
    url.searchParams.set('room', roomName);
    const token = getRoomAuthToken(roomName);
    if (token) {
      url.searchParams.set('roomToken', token);
    }
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
    const roomParam = new URLSearchParams(window.location.search).get('room') ?? 'default';
    if (user && user.username) {
      return { kind: 'tables', name: user.username, room: roomParam };
    }
    return { kind: 'auth' };
  });

  const [passwordRequiredRoom, setPasswordRequiredRoom] = useState<{
    roomId: string;
    roomName: string;
  } | null>(null);

  const [showGlobalRules, setShowGlobalRules] = useState(false);

  // 房间切换时同步浏览器 URL 与历史记录
  const switchRoom = (newRoom: string) => {
    const cleanRoom = newRoom.trim() || 'default';
    const currentUrl = new URL(window.location.href);
    if (cleanRoom === 'default') {
      currentUrl.searchParams.delete('room');
    } else {
      currentUrl.searchParams.set('room', cleanRoom);
    }
    window.history.replaceState({}, '', currentUrl.toString());

    setMode((prev) => {
      if (prev.kind === 'tables') {
        return { ...prev, room: cleanRoom };
      }
      if (prev.kind === 'online') {
        return { kind: 'tables', name: prev.name, room: cleanRoom };
      }
      return prev;
    });
  };

  // 检测当前房间是否需要密码拦截
  useEffect(() => {
    if (mode.kind === 'auth') return;
    const currentRoom = mode.room;
    if (!currentRoom || currentRoom === 'default') {
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
  }, [mode.kind, mode.kind !== 'auth' ? mode.room : '']);

  return (
    <>
      {mode.kind === 'auth' && (
        <AuthScreen
          onSuccess={(user) => {
            const roomParam =
              new URLSearchParams(window.location.search).get('room') ?? 'default';
            setMode({ kind: 'tables', name: user.username, room: roomParam });
          }}
          onShowRules={() => setShowGlobalRules(true)}
        />
      )}

      {mode.kind === 'tables' && (
        <RoomTablesScreen
          room={mode.room}
          playerName={mode.name}
          onSelectTable={(tableId, seat) =>
            setMode({
              kind: 'online',
              name: mode.name,
              room: mode.room,
              tableId,
              ...(seat !== undefined ? { preferredSeat: seat } : {})
            })
          }
          onShowRules={() => setShowGlobalRules(true)}
          onChangeNameOrRoom={() => {
            logoutUser();
            setMode({ kind: 'auth' });
          }}
          onSwitchRoom={switchRoom}
        />
      )}

      {mode.kind === 'online' && (
        <OnlineGame
          name={mode.name}
          room={mode.room}
          tableId={mode.tableId}
          {...(mode.preferredSeat !== undefined ? { preferredSeat: mode.preferredSeat } : {})}
          onExit={() => setMode({ kind: 'tables', name: mode.name, room: mode.room })}
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
            switchRoom('default');
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
              : `正在连接 ${tableId === '2' ? '2' : '1'}号桌 · 经典掼蛋…`}
          </p>
          <button className="secondary-action-btn" onClick={handleExit}>
            ← 返回桌子列表
          </button>
        </div>
      </div>
    );
  }

  if (view.phase === 'lobby') {
    return (
      <LobbyScreen
        you={view.you}
        seats={view.seats}
        error={view.error}
        onStart={view.start}
        onShowRules={onShowRules}
        onExit={handleExit}
      />
    );
  }

  return (
    <GameScreen
      game={view.game}
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
