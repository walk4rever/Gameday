import type { Seat } from '@guandan/engine';
import type { PausedInfo, PlayerStatus, SeatTrickAction } from '@guandan/protocol';
import type { Card, Play, Rank } from '@guandan/rules';

export interface SeatView {
  seat: Seat;
  name: string;
  isBot: boolean;
  connected: boolean;
  status: PlayerStatus;
  handCount: number;
}

export interface UseGameResult {
  humanSeat: Seat;
  level: Rank;
  hand: Card[];
  seats: SeatView[];
  currentTurn: Seat;
  lastPlay: { seat: Seat; cards: Card[] } | null;
  /** 当前这一墩每个座位出了什么/过了，UI 摆在对应玩家面前，见 GameScreen。 */
  currentTrick: SeatTrickAction[];
  legalMoves: Play[];
  isHumanTurn: boolean;
  canPass: boolean;
  roundOver: boolean;
  finishOrder: Seat[];
  paused: PausedInfo | null;
  tribute?: {
    type: 'none' | 'anti_tribute' | 'single' | 'double';
    description: string;
  } | null;
  error: string | null;
  clearError: () => void;
  playSelected: (cards: Card[]) => void;
  pass: () => void;
  restart: () => void;
  delegateBot: (seat: Seat) => void;
  dissolve: () => void;
}
