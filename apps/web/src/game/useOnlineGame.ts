import { classifyPlay, getLegalPlays } from '@guandan/rules';
import type { Seat } from '@guandan/engine';
import type { ClientMessage, LobbyMessage, LobbySeatSnapshot, ServerMessage, StateMessage } from '@guandan/protocol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreatePlayerId } from './playerId.js';
import type { UseGameResult } from './types.js';

type NonErrorMessage = LobbyMessage | StateMessage;

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export type OnlinePhase =
  | { phase: 'connecting' }
  | { phase: 'lobby'; you: Seat; seats: LobbySeatSnapshot[]; start: () => void; error: string | null }
  | { phase: 'playing'; game: UseGameResult };

export interface UseOnlineGameResult {
  status: ConnectionStatus;
  view: OnlinePhase;
}

export function useOnlineGame(serverUrl: string, name: string): UseOnlineGameResult {
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [message, setMessage] = useState<NonErrorMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const url = new URL(serverUrl);
    url.searchParams.set('playerId', playerId);
    url.searchParams.set('name', name);

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.addEventListener('open', () => setStatus('open'));
    ws.addEventListener('close', () => setStatus('closed'));
    ws.addEventListener('error', () => setStatus('closed'));
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data as string) as ServerMessage;
      if (data.type === 'error') {
        setError(data.message);
      } else {
        setMessage(data);
        setError(null);
      }
    });

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [serverUrl, playerId, name]);

  const send = useCallback((clientMessage: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(clientMessage));
    }
  }, []);

  const start = useCallback(() => send({ type: 'start' }), [send]);

  const game = useMemo<UseGameResult | null>(() => {
    if (!message || message.type !== 'state') return null;
    const state: StateMessage = message;

    const humanSeat = state.you.seat;
    const isHumanTurn = !state.roundOver && state.currentTurn === humanSeat;
    const opponentLastPlay =
      state.lastPlay && state.lastPlay.seat !== humanSeat ? classifyPlay(state.lastPlay.cards) : null;
    const legalMoves = isHumanTurn ? getLegalPlays(state.you.hand, opponentLastPlay, state.level) : [];
    const canPass = isHumanTurn && state.lastPlay !== null && state.lastPlay.seat !== humanSeat;

    return {
      humanSeat,
      level: state.level,
      hand: state.you.hand,
      seats: state.seats,
      currentTurn: state.currentTurn,
      lastPlay: state.lastPlay,
      currentTrick: state.currentTrick,
      legalMoves,
      isHumanTurn,
      canPass,
      roundOver: state.roundOver,
      finishOrder: state.finished,
      error,
      clearError: () => setError(null),
      playSelected: (cards) => send({ type: 'play', cardIds: cards.map((c) => c.id) }),
      pass: () => send({ type: 'pass' }),
      restart: () => send({ type: 'restart' })
    };
  }, [message, error, send]);

  const view: OnlinePhase = useMemo(() => {
    if (game) return { phase: 'playing', game };
    if (message?.type === 'lobby') return { phase: 'lobby', you: message.you, seats: message.seats, start, error };
    return { phase: 'connecting' };
  }, [game, message, start, error]);

  return { status, view };
}
