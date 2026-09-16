import type { Seat } from '@guandan/engine';
import type { MatchSessionInfo } from '@guandan/protocol';
import { calculateMatchResult, rankOrderTitle } from './cardDisplay.js';
import type { SeatView } from './game/types.js';

interface RoundOverModalProps {
  finishOrder: Seat[];
  humanSeat: Seat;
  seats: SeatView[];
  matchSession?: MatchSessionInfo | null | undefined;
  onRestart: () => void;
  onResetMatch?: () => void;
}

export function RoundOverModal({
  finishOrder,
  humanSeat,
  seats,
  matchSession,
  onRestart,
  onResetMatch
}: RoundOverModalProps) {
  const result = calculateMatchResult(finishOrder, humanSeat);
  const partnerSeat = ((humanSeat + 2) % 4) as Seat;
  const humanTeam = (humanSeat % 2) as 0 | 1;
  const isMatchOver = Boolean(matchSession?.isMatchOver);
  const isOurTeamWinner = isMatchOver && matchSession?.matchWinnerTeam === humanTeam;

  const seatInfo = (seat: Seat) => {
    const s = seats.find((item) => item.seat === seat);
    const isSelf = seat === humanSeat;
    const isPartner = seat === partnerSeat;
    return {
      name: s?.name ?? `座位 ${seat}`,
      isBot: s?.isBot ?? true,
      isSelf,
      isPartner,
      relation: isSelf ? '我' : isPartner ? '搭档' : '对手'
    };
  };

  return (
    <div className="modal-backdrop">
      <div
        className={`round-over-modal ${
          isMatchOver
            ? isOurTeamWinner
              ? 'match-grand-victory'
              : 'match-defeat'
            : result.isVictory
              ? 'victory'
              : 'defeat'
        }`}
      >
        {/* 顶部战果横幅 */}
        <div className="round-result-banner">
          {isMatchOver ? (
            <>
              <div className="match-trophy-icon">🏆</div>
              <h2 className="round-result-title">
                {isOurTeamWinner ? '🎉 决胜过 A！斩获总冠军！' : '比赛终局 · 对手决胜过 A'}
              </h2>
              <p className="round-result-subtitle">
                {isOurTeamWinner
                  ? '恭喜您与搭档成功打过 A，夺得本次家庭对抗赛大满贯总冠军！'
                  : '对手战队已成功打过 A 赢得整场比赛！'}
              </p>
            </>
          ) : (
            <>
              <h2 className="round-result-title">{result.title}</h2>
              <p className="round-result-subtitle">{result.subtitle}</p>
              {result.levelBonus !== 0 && (
                <div
                  className={`level-bonus-tag ${
                    result.levelBonus > 0 ? 'bonus-positive' : 'bonus-negative'
                  }`}
                >
                  {result.levelBonus > 0
                    ? `本副升级 +${result.levelBonus} 级`
                    : `本副落后 ${Math.abs(result.levelBonus)} 级`}
                </div>
              )}
              {result.tributeInfo && (
                <div className="round-tribute-hint">
                  <span>👑 {result.tributeInfo}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 场次比分看板进度 */}
        {matchSession && (
          <div className="round-session-scoreboard-bar">
            <div className={`session-team-score ${humanTeam === 0 ? 'team-mine' : ''}`}>
              <span className="session-team-label">🛡️ 南北队</span>
              <span className="session-team-rank">打 {matchSession.teamRanks[0]}</span>
            </div>
            <div className="session-vs-badge">
              <span>第 {matchSession.roundNumber} 副</span>
              <span className="session-vs-sep">VS</span>
            </div>
            <div className={`session-team-score ${humanTeam === 1 ? 'team-mine' : ''}`}>
              <span className="session-team-label">⚔️ 东西队</span>
              <span className="session-team-rank">打 {matchSession.teamRanks[1]}</span>
            </div>
          </div>
        )}

        {/* 出完名次榜 */}
        <div className="podium-list">
          {finishOrder.map((seat, index) => {
            const info = seatInfo(seat);
            const rank = rankOrderTitle(index);
            const isOurTeam = info.isSelf || info.isPartner;
            const seatObj = seats.find((s) => s.seat === seat);
            const handCount = seatObj?.handCount ?? 0;

            return (
              <div
                key={seat}
                className={`podium-card ${isOurTeam ? 'podium-our-team' : 'podium-opp-team'} ${
                  info.isSelf ? 'podium-self' : ''
                }`}
              >
                <div className="podium-rank-badge" style={{ color: rank.color }}>
                  {rank.badge}
                </div>
                <div className="podium-player-info">
                  <span className="podium-player-name">{info.name}</span>
                  <span className={`podium-relation-tag ${isOurTeam ? 'tag-friend' : 'tag-rival'}`}>
                    {info.relation}
                    {info.isBot ? ' 🤖' : ''}
                  </span>
                  {handCount > 0 && (
                    <span className="podium-hand-count">剩 {handCount} 张</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 操作按钮区 */}
        <div className="round-modal-actions">
          {isMatchOver ? (
            <button className="primary-action-btn pulse-glow" onClick={onRestart}>
              🏆 开启新一轮比赛（从打 2 重新开打）
            </button>
          ) : (
            <>
              <button className="primary-action-btn pulse-glow" onClick={onRestart}>
                🃏 进入下一副牌 →
              </button>
              {onResetMatch && (
                <button className="secondary-action-btn" onClick={onResetMatch}>
                  🔄 重置比赛从打 2 开始
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
