import { chooseBotPlay } from '@guandan/bot';
import { createDeck } from '@guandan/rules';
import type { Rank } from '@guandan/rules';
import { describe, expect, it } from 'vitest';
import { createGame, isRoundOver, playCards, passTurn } from '../src/actions.js';
import { dealHands, shuffleDeck } from '../src/deal.js';
import type { Seat } from '../src/types.js';

// 四个座位都交给 bot 出牌，跑完整局，验证 engine + bot + rules 接线正确、
// 不会卡死或抛异常 —— 相当于 apps/web 里 useGame 那套循环的无 UI 版本。
const LEVEL: Rank = '2';
const MAX_STEPS = 2000;

function partnerOf(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}

function playFullGame(startSeat: Seat) {
  let state = createGame(dealHands(shuffleDeck(createDeck())), LEVEL, startSeat);
  let steps = 0;

  while (!isRoundOver(state) && steps < MAX_STEPS) {
    steps += 1;
    const seat = state.currentTurn;
    const partner = partnerOf(seat);
    const lastPlay = state.lastPlay && state.lastPlay.seat !== seat ? state.lastPlay.play : null;

    const move = chooseBotPlay({
      hand: state.hands[seat],
      lastPlay,
      level: LEVEL,
      isLastPlayFromPartner: state.lastPlay?.seat === partner,
      partnerHandSize: state.finished.includes(partner) ? 0 : state.hands[partner].length
    });

    const result = move === null ? passTurn(state, seat) : playCards(state, seat, move);
    if (!result.ok) {
      throw new Error(
        `第 ${steps} 步失败：座位 ${seat} ${move === null ? '过牌' : '出牌'}被拒绝，原因：${result.error}`
      );
    }
    state = result.state;
  }

  return { state, steps };
}

describe('完整对局仿真（四个座位都用 bot 出牌）', () => {
  it('能在有限步数内正常结束，产生互不重复的完成顺序', () => {
    for (let game = 0; game < 30; game++) {
      const startSeat = (game % 4) as Seat;
      const { state, steps } = playFullGame(startSeat);

      expect(steps).toBeLessThan(MAX_STEPS);
      expect(isRoundOver(state)).toBe(true);
      expect(state.finished).toHaveLength(3);
      expect(new Set(state.finished).size).toBe(3);
    }
  });
});
