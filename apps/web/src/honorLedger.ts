import type { Seat } from '@guandan/engine';
import type { MatchSessionInfo } from '@guandan/protocol';
import type { SeatView } from './game/types.js';

export interface PlayerHonorRecord {
  playerName: string;
  totalRounds: number; // 总副数
  firstRankCount: number; // 头游（第一名）次数
  secondRankCount: number; // 二游次数
  thirdRankCount: number; // 三游次数
  lastRankCount: number; // 末游次数
  doubleUpWins: number; // 双上胜利次数
  grandChampionships: number; // 打过 A 夺冠总次数
  totalPoints: number; // 总体积分
  lastPlayedAt: number; // 最近活跃时间
}

const STORAGE_KEY = 'gameday_honor_records_v1';

export function getHonorRecords(): PlayerHonorRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlayerHonorRecord[];
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.totalPoints - a.totalPoints || b.firstRankCount - a.firstRankCount);
    }
    return [];
  } catch {
    return [];
  }
}

export function saveHonorRecords(records: PlayerHonorRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

export function clearHonorRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 获取荣誉称号称号 */
export function getHonorTitle(record: PlayerHonorRecord): string {
  if (record.grandChampionships >= 3 || record.totalPoints >= 30) return '🏆 掼蛋雀圣';
  if (record.grandChampionships >= 1 || record.totalPoints >= 15) return '👑 牌坛霸主';
  if (record.doubleUpWins >= 2 || record.totalPoints >= 8) return '⚔️ 常胜将军';
  if (record.firstRankCount >= 2) return '⭐ 头游达人';
  if (record.totalRounds >= 5) return '🎖️ 资深牌友';
  return '🌱 牌坛新秀';
}

/**
 * 记录单副牌结算结果
 */
export function recordRoundFinished(params: {
  seats: SeatView[];
  finishOrder: Seat[];
  matchSession?: MatchSessionInfo | null | undefined;
}): PlayerHonorRecord[] {
  const { seats, finishOrder, matchSession } = params;
  if (finishOrder.length < 4) return getHonorRecords();

  const firstSeat = finishOrder[0];
  const secondSeat = finishOrder[1];
  const lastSeat = finishOrder[3];
  if (firstSeat === undefined || secondSeat === undefined || lastSeat === undefined) {
    return getHonorRecords();
  }

  const records = getHonorRecords();
  const recordMap = new Map<string, PlayerHonorRecord>();
  for (const r of records) {
    recordMap.set(r.playerName, { ...r });
  }

  // 判断头游归属队伍 (0: 南北队[0,2], 1: 东西队[1,3])
  const winningTeam = (firstSeat % 2) as 0 | 1;
  const secondTeam = (secondSeat % 2) as 0 | 1;
  const lastTeam = (lastSeat % 2) as 0 | 1;

  // 计算本局胜负档次
  const isDoubleUp = winningTeam === secondTeam; // 双上
  const isDraw = winningTeam === lastTeam; // 平局 (头游+末游)

  let winBonus = 2; // 默认单上 +2
  if (isDoubleUp) winBonus = 3; // 双上 +3
  else if (isDraw) winBonus = 1; // 平局 +1

  const isGrandFinal = Boolean(matchSession?.isMatchOver && matchSession.matchWinnerTeam !== undefined);
  const grandWinnerTeam = matchSession?.matchWinnerTeam;

  // 为每个座位更新数据
  for (let rankIndex = 0; rankIndex < 4; rankIndex++) {
    const seat = finishOrder[rankIndex];
    if (seat === undefined) continue;
    const seatObj = seats.find((s) => s.seat === seat);
    const name = seatObj?.name ?? `玩家 ${seat + 1}`;
    const team = (seat % 2) as 0 | 1;
    const isWinner = team === winningTeam;

    const existing: PlayerHonorRecord = recordMap.get(name) ?? {
      playerName: name,
      totalRounds: 0,
      firstRankCount: 0,
      secondRankCount: 0,
      thirdRankCount: 0,
      lastRankCount: 0,
      doubleUpWins: 0,
      grandChampionships: 0,
      totalPoints: 0,
      lastPlayedAt: Date.now()
    };

    existing.totalRounds += 1;
    existing.lastPlayedAt = Date.now();

    if (rankIndex === 0) existing.firstRankCount += 1;
    else if (rankIndex === 1) existing.secondRankCount += 1;
    else if (rankIndex === 2) existing.thirdRankCount += 1;
    else if (rankIndex === 3) existing.lastRankCount += 1;

    if (isDoubleUp && isWinner) {
      existing.doubleUpWins += 1;
    }

    // 积分变更
    if (isWinner) {
      existing.totalPoints += winBonus;
    } else {
      existing.totalPoints -= winBonus;
    }

    // 如果决胜过 A 斩获大满贯总冠军
    if (isGrandFinal && grandWinnerTeam === team) {
      existing.grandChampionships += 1;
      existing.totalPoints += 10; // 冠军额外奖励
    }

    recordMap.set(name, existing);
  }

  const updatedList = Array.from(recordMap.values()).sort(
    (a, b) => b.totalPoints - a.totalPoints || b.firstRankCount - a.firstRankCount
  );
  saveHonorRecords(updatedList);
  return updatedList;
}
