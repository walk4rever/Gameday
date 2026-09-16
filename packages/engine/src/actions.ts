import { classifyPlay, comparePlays, getLegalPlays } from '@guandan/rules';
import type { Card, Play, Rank } from '@guandan/rules';
import type { ActionResult, GameState, HistoryEntry, Seat } from './types.js';

const SEATS: Seat[] = [0, 1, 2, 3];

export function createGame(
  hands: [Card[], Card[], Card[], Card[]],
  level: Rank,
  startSeat: Seat
): GameState {
  return {
    level,
    hands,
    currentTurn: startSeat,
    lastPlay: null,
    passSinceLastPlay: 0,
    finished: [],
    history: [],
    currentTrick: {}
  };
}

export function isRoundOver(state: GameState): boolean {
  return state.finished.length >= 3;
}

/** 当前该出牌的人能压过 lastPlay 的所有合法出牌方式；新一轮时任意合法牌型都可以。 */
export function legalMovesFor(state: GameState, seat: Seat): Play[] {
  const hand = state.hands[seat];
  const lastPlay = state.lastPlay && state.lastPlay.seat !== seat ? state.lastPlay.play : null;
  return getLegalPlays(hand, lastPlay, state.level);
}

export function playCards(state: GameState, seat: Seat, cards: Card[]): ActionResult {
  if (state.finished.includes(seat)) return { ok: false, error: '该玩家已经出完牌' };
  if (state.currentTurn !== seat) return { ok: false, error: '还没轮到该玩家' };

  const hand = state.hands[seat];
  if (!cards.every((c) => hand.some((h) => h.id === c.id))) {
    return { ok: false, error: '出的牌不在手上' };
  }

  const play = classifyPlay(cards, state.level);
  if (!play) return { ok: false, error: '不是合法牌型' };

  if (state.lastPlay !== null) {
    const cmp = comparePlays(play, state.lastPlay.play, state.level);
    if (cmp === null || cmp <= 0) return { ok: false, error: '压不过上家的牌' };
  }

  const playedIds = new Set(cards.map((c) => c.id));
  const remainingHand = hand.filter((c) => !playedIds.has(c.id));
  const hands = replaceSeat(state.hands, seat, remainingHand);
  const finished = remainingHand.length === 0 ? [...state.finished, seat] : state.finished;
  const entry: HistoryEntry = { seat, action: 'play', play };

  const nextState: GameState = {
    ...state,
    hands,
    lastPlay: { seat, play },
    passSinceLastPlay: 0,
    finished,
    currentTurn: nextActiveSeat(seat, finished),
    history: [...state.history, entry],
    // lastPlay 为 null 时（领出新一墩）currentTrick 已经在上一次归零，
    // 直接 spread 一份新的即可，不用再特判。
    currentTrick: { ...state.currentTrick, [seat]: { type: 'play', play } }
  };

  return { ok: true, state: nextState };
}

export function passTurn(state: GameState, seat: Seat): ActionResult {
  if (state.finished.includes(seat)) return { ok: false, error: '该玩家已经出完牌' };
  if (state.currentTurn !== seat) return { ok: false, error: '还没轮到该玩家' };
  if (state.lastPlay === null) return { ok: false, error: '新的一轮必须出牌，不能过' };
  if (state.lastPlay.seat === seat) return { ok: false, error: '自己出的牌不能过' };

  const entry: HistoryEntry = { seat, action: 'pass' };
  const activeSeats = SEATS.filter((s) => !state.finished.includes(s));
  const ownerStillActive = !state.finished.includes(state.lastPlay.seat);
  const requiredPasses = activeSeats.length - (ownerStillActive ? 1 : 0);
  const passCount = state.passSinceLastPlay + 1;
  const everyoneElsePassed = passCount >= requiredPasses;

  if (everyoneElsePassed) {
    const lastPlaySeat = state.lastPlay.seat;
    const partnerSeat = ((lastPlaySeat + 2) % 4) as Seat;
    const leadSeat = state.finished.includes(lastPlaySeat)
      ? (!state.finished.includes(partnerSeat)
          ? partnerSeat
          : nextActiveSeat(lastPlaySeat, state.finished))
      : lastPlaySeat;

    return {
      ok: true,
      state: {
        ...state,
        lastPlay: null,
        passSinceLastPlay: 0,
        currentTurn: leadSeat,
        history: [...state.history, entry],
        currentTrick: {} // 一墩结束，清空桌面
      }
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      passSinceLastPlay: passCount,
      currentTurn: nextActiveSeat(seat, state.finished),
      history: [...state.history, entry],
      currentTrick: { ...state.currentTrick, [seat]: { type: 'pass' } }
    }
  };
}

export function nextActiveSeat(fromSeat: Seat, finished: Seat[]): Seat {
  for (let i = 1; i <= 4; i++) {
    const candidate = ((fromSeat + i) % 4) as Seat;
    if (!finished.includes(candidate)) return candidate;
  }
  return fromSeat;
}

function replaceSeat(
  hands: [Card[], Card[], Card[], Card[]],
  seat: Seat,
  newHand: Card[]
): [Card[], Card[], Card[], Card[]] {
  const next = [...hands] as [Card[], Card[], Card[], Card[]];
  next[seat] = newHand;
  return next;
}
