import { useState } from 'react';
import { AuthScreen } from './AuthScreen.js';
import { GameScreen } from './GameScreen.js';
import { LobbyScreen } from './LobbyScreen.js';
import { RoomTablesScreen } from './RoomTablesScreen.js';
import { RulesModal } from './RulesModal.js';
import { getCurrentUser, logoutUser } from './game/playerId.js';
import { useOnlineGame } from './game/useOnlineGame.js';

type Mode =
  | { kind: 'auth' }
  | { kind: 'tables'; name: string; room: string }
  | { kind: 'online'; name: string; room: string; tableId: string };

function defaultWsUrl(roomName?: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const room = roomName ?? new URLSearchParams(window.location.search).get('room') ?? 'default';
  const url = new URL(`${protocol}//${window.location.host}/ws`);
  url.searchParams.set('room', room);
  return url.toString();
}

function getServerUrl(roomName?: string): string {
  if (import.meta.env.VITE_WS_URL) {
    const url = new URL(import.meta.env.VITE_WS_URL);
    if (roomName) url.searchParams.set('room', roomName);
    return url.toString();
  }
  return defaultWsUrl(roomName);
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

  const [showGlobalRules, setShowGlobalRules] = useState(false);

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
          onSelectTable={(tableId) =>
            setMode({ kind: 'online', name: mode.name, room: mode.room, tableId })
          }
          onShowRules={() => setShowGlobalRules(true)}
          onChangeNameOrRoom={() => {
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
          onExit={() => setMode({ kind: 'tables', name: mode.name, room: mode.room })}
          onShowRules={() => setShowGlobalRules(true)}
        />
      )}

      {showGlobalRules && <RulesModal onClose={() => setShowGlobalRules(false)} />}
    </>
  );
}

function OnlineGame({
  name,
  room,
  tableId: _tableId,
  onExit,
  onShowRules
}: {
  name: string;
  room: string;
  tableId: string;
  onExit: () => void;
  onShowRules: () => void;
}) {
  const wsUrl = getServerUrl(room);
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
              : '正在连接 1号桌·经典掼蛋…'}
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
