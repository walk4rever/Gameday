import type { FormEvent } from 'react';
import { useState } from 'react';
import { GameScreen } from './GameScreen.js';
import { LobbyScreen } from './LobbyScreen.js';
import { RoomTablesScreen } from './RoomTablesScreen.js';
import { RulesModal } from './RulesModal.js';
import { useOnlineGame } from './game/useOnlineGame.js';

type Mode =
  | { kind: 'join' }
  | { kind: 'tables'; name: string; room: string }
  | { kind: 'online'; name: string; room: string; tableId: string };

const NAME_STORAGE_KEY = 'guandan:playerName';

const FUN_NAMES = [
  '掼蛋小将',
  '红桃大侠',
  '顺风神手',
  '常胜将军',
  '炸弹小能手',
  '淮安雀仙',
  '同花顺子',
  '机智搭档'
];

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
    const savedName = localStorage.getItem(NAME_STORAGE_KEY);
    const roomParam = new URLSearchParams(window.location.search).get('room') ?? 'default';
    if (savedName && savedName.trim()) {
      return { kind: 'tables', name: savedName.trim(), room: roomParam };
    }
    return { kind: 'join' };
  });

  const [showGlobalRules, setShowGlobalRules] = useState(false);

  return (
    <>
      {mode.kind === 'join' && (
        <JoinScreen
          onJoin={(name, room) => setMode({ kind: 'tables', name, room })}
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
          onChangeNameOrRoom={() => setMode({ kind: 'join' })}
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

function JoinScreen({
  onJoin,
  onShowRules
}: {
  onJoin: (name: string, room: string) => void;
  onShowRules: () => void;
}) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_STORAGE_KEY) ?? '');
  const [roomParam, setRoomParam] = useState(
    () => new URLSearchParams(window.location.search).get('room') ?? ''
  );

  const randomizeName = () => {
    const randomPick = FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)]!;
    setName(randomPick);
  };

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim() || '玩家';
    localStorage.setItem(NAME_STORAGE_KEY, trimmed);

    const targetRoom = roomParam.trim() || 'default';
    const currentRoom = new URLSearchParams(window.location.search).get('room') ?? '';
    if (targetRoom !== currentRoom) {
      const url = new URL(window.location.href);
      if (targetRoom !== 'default') {
        url.searchParams.set('room', targetRoom);
      } else {
        url.searchParams.delete('room');
      }
      window.history.replaceState({}, '', url.toString());
    }

    onJoin(trimmed, targetRoom);
  }

  return (
    <div className="app join-screen-container">
      <div className="join-card">
        <div className="join-brand">
          <div className="join-suits-emblem">
            <span className="suit-spade">♠</span>
            <span className="suit-heart">♥</span>
            <span className="suit-club">♣</span>
            <span className="suit-diamond">♦</span>
          </div>
          <h1 className="join-title">掼 蛋</h1>
          <p className="join-subtitle">家庭联机 · 智能辅助 · 随时开战</p>
        </div>

        <form className="join-form" onSubmit={handleSubmit}>
          <div className="join-input-group">
            <label className="join-label">玩家昵称</label>
            <div className="join-input-with-action">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入或随机昵称"
                maxLength={12}
                autoFocus
              />
              <button
                type="button"
                className="btn-dice"
                onClick={randomizeName}
                title="随机换一个昵称"
              >
                🎲
              </button>
            </div>
          </div>

          <div className="join-input-group">
            <label className="join-label">房间号（默认房间可直接进入）</label>
            <input
              value={roomParam}
              onChange={(e) => setRoomParam(e.target.value)}
              placeholder="留空为默认房间 default"
              maxLength={16}
            />
          </div>

          <button type="submit" className="primary-action-btn pulse-glow join-btn">
            🚪 进入房间
          </button>
        </form>

        <div className="join-helper-actions">
          <button type="button" className="text-action-btn" onClick={onShowRules}>
            📖 掼蛋规则快速入门
          </button>
        </div>
      </div>
    </div>
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
