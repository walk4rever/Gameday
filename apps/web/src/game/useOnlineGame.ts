import { classifyPlay, getLegalPlays } from '@guandan/rules';
import type { Seat } from '@guandan/engine';
import type {
  ChatMessage,
  ClientMessage,
  LobbyMessage,
  LobbySeatSnapshot,
  ServerMessage,
  StateMessage
} from '@guandan/protocol';
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
  leave: () => void;
}

export function useOnlineGame(serverUrl: string, name: string): UseOnlineGameResult {
  const playerId = useMemo(() => getOrCreatePlayerId(), []);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [message, setMessage] = useState<NonErrorMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomingChat, setIncomingChat] = useState<ChatMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userLeftRef = useRef(false);

  useEffect(() => {
    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    userLeftRef.current = false;

    function connect() {
      if (unmounted || userLeftRef.current) return;
      const url = new URL(serverUrl);
      url.searchParams.set('playerId', playerId);
      url.searchParams.set('name', name);

      setStatus('connecting');
      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        if (unmounted) return;
        setStatus('open');

        // 启动 5 秒心跳保活检测机制
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 5000);
      });

      ws.addEventListener('close', (e) => {
        if (pingInterval) clearInterval(pingInterval);
        if (unmounted) return;
        setStatus('closed');
        // 如果用户已主动退出或正常结束，不自动重连
        if (userLeftRef.current || e.code === 1000) return;
        // 自动重连：1.5 秒后再次尝试
        reconnectTimer = setTimeout(() => {
          connect();
        }, 1500);
      });

      ws.addEventListener('error', () => {
        if (unmounted) return;
        setStatus('closed');
      });

      ws.addEventListener('message', (event) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(event.data as string) as ServerMessage;
          if (data.type === 'pong') {
            // 心跳响应，忽略
            return;
          }
          if (data.type === 'chat') {
            setIncomingChat(data);
            return;
          }
          if (data.type === 'error') {
            setError(data.message);
          } else {
            setMessage(data);
            setError(null);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      });
    }

    connect();

    // 浏览器网络状态变化即时监听
    const handleOnline = () => {
      if (status !== 'open' && !userLeftRef.current) {
        connect();
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      unmounted = true;
      window.removeEventListener('online', handleOnline);
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [serverUrl, playerId, name]);

  const send = useCallback((clientMessage: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(clientMessage));
    }
  }, []);

  const start = useCallback(() => send({ type: 'start' }), [send]);

  const leave = useCallback(() => {
    userLeftRef.current = true;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave' }));
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'voluntary_leave');
      wsRef.current = null;
    }
    setStatus('closed');
  }, []);

  const delegateBot = useCallback(
    (seat: Seat) => {
      send({ type: 'delegate_bot', seat });
    },
    [send]
  );

  const dissolve = useCallback(() => {
    send({ type: 'dissolve' });
  }, [send]);

  const sendChat = useCallback(
    (text: string, emoji?: string) => {
      send({ type: 'chat', message: text, emoji });
    },
    [send]
  );

  const game = useMemo<UseGameResult | null>(() => {
    if (!message) return null;

    if (message.type === 'lobby') {
      const lobbyMsg = message;
      return {
        humanSeat: lobbyMsg.you,
        level: '2',
        hand: [],
        seats: lobbyMsg.seats.map((s) => ({
          seat: s.seat,
          name: s.name,
          isBot: s.isBot,
          connected: s.connected,
          status: s.status,
          handCount: 0
        })),
        currentTurn: 0,
        lastPlay: null,
        currentTrick: [],
        legalMoves: [],
        isHumanTurn: false,
        canPass: false,
        roundOver: false,
        finishOrder: [],
        paused: null,
        waitingToStart: true,
        onStartGame: start,
        error,
        clearError: () => setError(null),
        playSelected: () => {},
        pass: () => {},
        restart: start,
        resetMatch: () => send({ type: 'reset_match' }),
        payTribute: () => {},
        returnTribute: () => {},
        delegateBot,
        dissolve,
        sendChat
      };
    }

    if (message.type !== 'state') return null;
    const state: StateMessage = message;

    const humanSeat = state.you.seat;
    const isHumanTurn = !state.roundOver && state.currentTurn === humanSeat;
    const opponentLastPlay =
      state.lastPlay && state.lastPlay.seat !== humanSeat ? classifyPlay(state.lastPlay.cards, state.level) : null;
    const legalMoves = isHumanTurn ? getLegalPlays(state.you.hand, opponentLastPlay, state.level) : [];
    const canPass = isHumanTurn && state.lastPlay !== null && state.lastPlay.seat !== humanSeat;

    return {
      humanSeat: state.you.seat,
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
      finishOrder: (() => {
        let order = state.finished;
        if (state.roundOver && order.length < 4) {
          const allSeats: Seat[] = [0, 1, 2, 3];
          const remaining = allSeats.filter((s) => !order.includes(s));
          remaining.sort((a, b) => {
            const countA = state.seats.find((s) => s.seat === a)?.handCount ?? 0;
            const countB = state.seats.find((s) => s.seat === b)?.handCount ?? 0;
            return countA - countB;
          });
          order = [...order, ...remaining];
        }
        return order;
      })(),
      paused: state.paused ?? null,
      waitingToStart: false,
      onStartGame: start,
      tribute: state.tribute ?? null,
      tributePhase: state.tributePhase ?? null,
      matchSession: state.matchSession ?? null,
      playedCards: state.playedCards ?? [],
      incomingChat,
      error,
      clearError: () => setError(null),
      playSelected: (cards) => send({ type: 'play', cardIds: cards.map((c) => c.id) }),
      pass: () => send({ type: 'pass' }),
      restart: () => send({ type: 'restart' }),
      resetMatch: () => send({ type: 'reset_match' }),
      payTribute: (cardId: string) => send({ type: 'pay_tribute', cardId }),
      returnTribute: (cardId: string) => send({ type: 'return_tribute', cardId }),
      delegateBot,
      dissolve,
      sendChat
    };
  }, [message, error, send, start, delegateBot, dissolve, sendChat, incomingChat]);

  const view: OnlinePhase = useMemo(() => {
    if (game) return { phase: 'playing', game };
    return { phase: 'connecting' };
  }, [game]);

  return { status, view, leave };
}
