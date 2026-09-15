import type { FormEvent } from 'react';
import { useState } from 'react';
import { GameScreen } from './GameScreen.js';
import { LobbyScreen } from './LobbyScreen.js';
import { RulesModal } from './RulesModal.js';
import { useOnlineGame } from './game/useOnlineGame.js';

type Mode = { kind: 'join' } | { kind: 'online'; name: string };

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

function defaultWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const room = new URLSearchParams(window.location.search).get('room');
  const url = new URL(`${protocol}//${window.location.host}/ws`);
  if (room) url.searchParams.set('room', room);
  return url.toString();
}

function getServerUrl(): string {
  return import.meta.env.VITE_WS_URL ?? defaultWsUrl();
}

export function App() {
  const [mode, setMode] = useState<Mode>({ kind: 'join' });
  const [showGlobalRules, setShowGlobalRules] = useState(false);

  return (
    <>
      {mode.kind === 'join' ? (
        <JoinScreen
          onJoin={(name) => setMode({ kind: 'online', name })}
          onShowRules={() => setShowGlobalRules(true)}
        />
      ) : (
        <OnlineGame
          name={mode.name}
          onExit={() => setMode({ kind: 'join' })}
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
  onJoin: (name: string) => void;
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

    // 如果修改了房间号，更新 URL 中的 ?room=
    const currentRoom = new URLSearchParams(window.location.search).get('room') ?? '';
    const targetRoom = roomParam.trim();
    if (targetRoom !== currentRoom) {
      const url = new URL(window.location.href);
      if (targetRoom) {
        url.searchParams.set('room', targetRoom);
      } else {
        url.searchParams.delete('room');
      }
      window.history.replaceState({}, '', url.toString());
    }

    onJoin(trimmed);
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
              placeholder="留空为默认公共房间"
              maxLength={16}
            />
          </div>

          <button type="submit" className="primary-action-btn pulse-glow join-btn">
            🚪 进入牌桌
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
  onExit,
  onShowRules
}: {
  name: string;
  onExit: () => void;
  onShowRules: () => void;
}) {
  const { status, view } = useOnlineGame(getServerUrl(), name);

  if (view.phase === 'connecting') {
    return (
      <div className="app menu connecting-page">
        <div className="connecting-card">
          <div className="loading-spinner" />
          <p className="connecting-text">
            {status === 'closed' ? '连接已断开，正在尝试重连…' : '正在连接专属牌桌…'}
          </p>
          <button className="secondary-action-btn" onClick={onExit}>
            ← 返回大厅更换昵称
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
      />
    );
  }

  return (
    <GameScreen
      game={view.game}
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
