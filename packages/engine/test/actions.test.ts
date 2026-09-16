import type { Card, Rank, Suit } from '@guandan/rules';
import { describe, expect, it } from 'vitest';
import { createGame, isRoundOver, legalMovesFor, passTurn, playCards } from '../src/actions.js';
import type { GameState, Seat } from '../src/types.js';

let counter = 0;
function card(suit: Suit, rank: Rank): Card {
  counter += 1;
  return { suit, rank, id: `${suit}-${rank}-${counter}` };
}

const level: Rank = '2';

function expectOk(result: { ok: boolean; state?: GameState; error?: string }): GameState {
  if (!result.ok || !result.state) {
    throw new Error(`预期成功但失败了: ${result.error}`);
  }
  return result.state;
}

function expectErr(result: { ok: boolean; error?: string }): string {
  if (result.ok) {
    throw new Error('预期失败但成功了');
  }
  return result.error ?? '';
}

describe('createGame', () => {
  it('初始状态：由 startSeat 领出，没有上一手牌，没人出完', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
    const state = createGame(hands, level, 2);
    expect(state.currentTurn).toBe(2);
    expect(state.lastPlay).toBeNull();
    expect(state.finished).toEqual([]);
  });
});

describe('playCards', () => {
  it('拒绝还没轮到的座位出牌', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '5')],
      [card('heart', '6')],
      [],
      []
    ];
    const state = createGame(hands, level, 0);
    const result = playCards(state, 1, [hands[1]![0]!]);
    expect(result.ok).toBe(false);
  });

  it('拒绝手里没有的牌', () => {
    const state = createGame([[card('spade', '5')], [], [], []], level, 0);
    const result = playCards(state, 0, [card('heart', '9')]);
    expect(result.ok).toBe(false);
  });

  it('拒绝压不过上一手牌的出牌', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '9')],
      [card('heart', '3')],
      [],
      []
    ];
    let state = createGame(hands, level, 0);
    state = expectOk(playCards(state, 0, [state.hands[0]![0]!]));
    const result = playCards(state, 1, [state.hands[1]![0]!]);
    expect(expectErr(result)).toMatch(/压不过/);
  });

  it('成功出牌后手牌减少、lastPlay 更新、轮到下一家', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '9'), card('heart', '3')],
      [],
      [],
      []
    ];
    const state = createGame(hands, level, 0);
    const played = state.hands[0]![0]!;
    const next = expectOk(playCards(state, 0, [played]));
    expect(next.hands[0]).toHaveLength(1);
    expect(next.lastPlay).toEqual({ seat: 0, play: expect.objectContaining({ type: 'single' }) });
    expect(next.currentTurn).toBe(1);
  });

  it('出完最后一张牌后加入 finished', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [[card('spade', '9')], [], [], []];
    const state = createGame(hands, level, 0);
    const next = expectOk(playCards(state, 0, state.hands[0]!));
    expect(next.finished).toEqual([0]);
    expect(next.hands[0]).toEqual([]);
  });
});

describe('passTurn', () => {
  it('新一轮（lastPlay 为 null）不能过', () => {
    const state = createGame([[card('spade', '5')], [], [], []], level, 0);
    const result = passTurn(state, 0);
    expect(result.ok).toBe(false);
  });

  it('不能过自己刚出的牌', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [[card('spade', '5')], [], [], []];
    let state = createGame(hands, level, 0);
    state = expectOk(playCards(state, 0, state.hands[0]!));
    // currentTurn 现在是 1，模拟走完一圈回到自己是另一个测试；这里直接验证过不了自己
    const result = passTurn({ ...state, currentTurn: 0 }, 0);
    expect(result.ok).toBe(false);
  });

  it('三家都过牌后，回到出牌人手上，lastPlay 清空', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '5'), card('heart', '5'), card('club', '9')],
      [card('spade', '3')],
      [card('heart', '4')],
      [card('club', '6')]
    ];
    let state = createGame(hands, level, 0);
    state = expectOk(playCards(state, 0, [hands[0]![0]!, hands[0]![1]!])); // 出对 5，领先
    expect(state.currentTurn).toBe(1);

    state = expectOk(passTurn(state, 1));
    expect(state.currentTurn).toBe(2);
    state = expectOk(passTurn(state, 2));
    expect(state.currentTurn).toBe(3);
    state = expectOk(passTurn(state, 3));

    expect(state.lastPlay).toBeNull();
    expect(state.currentTurn).toBe(0);

    // 原出牌人可以用新的单张重新起牌
    const led = expectOk(playCards(state, 0, [state.hands[0]![0]!]));
    expect(led.lastPlay?.seat).toBe(0);
  });

  it('currentTrick 累积每个座位这一墩的动作，一墩结束后清空', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '5'), card('heart', '5'), card('club', '9')],
      [card('spade', '3')],
      [card('heart', '4')],
      [card('club', '6')]
    ];
    let state = createGame(hands, level, 0);
    expect(state.currentTrick).toEqual({});

    state = expectOk(playCards(state, 0, [hands[0]![0]!, hands[0]![1]!]));
    expect(state.currentTrick[0]).toEqual({ type: 'play', play: expect.objectContaining({ type: 'pair' }) });

    state = expectOk(passTurn(state, 1));
    expect(state.currentTrick[1]).toEqual({ type: 'pass' });
    // 之前座位 0 的记录还在，没有被座位 1 的过牌覆盖掉
    expect(state.currentTrick[0]).toBeDefined();

    state = expectOk(passTurn(state, 2));
    state = expectOk(passTurn(state, 3)); // 三家都过完，一墩结束

    expect(state.currentTrick).toEqual({});
  });

  it('出牌人出完牌离场后，其余人均过牌，由其对家搭档接风领出', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '5'), card('heart', '5')],
      [card('spade', '3')],
      [card('heart', '4')],
      [card('club', '6')]
    ];
    let state = createGame(hands, level, 0);
    state = expectOk(playCards(state, 0, hands[0]!)); // 座位 0 出对 5 打完走脱
    expect(state.finished).toEqual([0]);
    expect(state.currentTurn).toBe(1);

    state = expectOk(passTurn(state, 1));
    state = expectOk(passTurn(state, 2));
    state = expectOk(passTurn(state, 3));

    expect(state.lastPlay).toBeNull();
    expect(state.currentTurn).toBe(2); // 掼蛋接风规则：座位 0 的搭档是座位 2，由座位 2 接风领出
  });

  it('如果搭档也已走脱出完牌，接风权顺延至下家在场玩家', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '5')],
      [card('spade', '3')],
      [], // 搭档座位 2 已经没有牌（已走脱）
      [card('club', '6')]
    ];
    let state = createGame(hands, level, 0);
    state.finished = [2]; // 座位 2 已经先走
    state = expectOk(playCards(state, 0, hands[0]!)); // 座位 0 打完走脱
    expect(state.finished).toEqual([2, 0]);

    state = expectOk(passTurn(state, 1));
    state = expectOk(passTurn(state, 3));

    expect(state.lastPlay).toBeNull();
    expect(state.currentTurn).toBe(1); // 搭档 2 已离场，接风权顺延至下家在场玩家 1
  });
});

describe('一整局流程', () => {
  it('三人出完牌后 isRoundOver 为 true，完成顺序被记录', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '3'), card('heart', '3')],
      [card('spade', '4'), card('heart', '4')],
      [card('spade', '5'), card('heart', '5')],
      [card('spade', '6'), card('heart', '6')]
    ];
    let state = createGame(hands, level, 0);
    expect(isRoundOver(state)).toBe(false);

    state = expectOk(playCards(state, 0, state.hands[0]!));
    state = expectOk(playCards(state, 1, state.hands[1]!));
    state = expectOk(playCards(state, 2, state.hands[2]!));

    expect(isRoundOver(state)).toBe(true);
    expect(state.finished).toEqual([0, 1, 2]);
    expect(state.hands[3]).toHaveLength(2);
  });
});

describe('legalMovesFor', () => {
  it('新一轮时任意合法牌型都可以出', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '5'), card('heart', '9')],
      [],
      [],
      []
    ];
    const state = createGame(hands, level, 0);
    const moves = legalMovesFor(state, 0);
    expect(moves.map((m) => m.type).sort()).toEqual(['single', 'single']);
  });

  it('跟牌时只返回能压过 lastPlay 的选项', () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [card('spade', '9')],
      [card('heart', '3'), card('club', 'K')],
      [],
      []
    ];
    let state = createGame(hands, level, 0);
    state = expectOk(playCards(state, 0, state.hands[0]!));
    const moves = legalMovesFor(state, 1);
    expect(moves).toHaveLength(1);
    expect(moves[0]?.rank).toBe('K');
  });
});
