import type { Seat } from '@guandan/engine';
import { calculateMatchResult, rankOrderTitle } from './cardDisplay.js';
import type { SeatView } from './game/types.js';

interface RoundOverModalProps {
  finishOrder: Seat[];
  humanSeat: Seat;
  seats: SeatView[];
  onRestart: () => void;
}

export function RoundOverModal({ finishOrder, humanSeat, seats, onRestart }: RoundOverModalProps) {
  const result = calculateMatchResult(finishOrder, humanSeat);
  const partnerSeat = ((humanSeat + 2) % 4) as Seat;

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
      <div className={`round-over-modal ${result.isVictory ? 'victory' : 'defeat'}`}>
        <div className="round-result-banner">
          <h2 className="round-result-title">{result.title}</h2>
          <p className="round-result-subtitle">{result.subtitle}</p>
          {result.levelBonus !== 0 && (
            <div className={`level-bonus-tag ${result.levelBonus > 0 ? 'bonus-positive' : 'bonus-negative'}`}>
              {result.levelBonus > 0 ? `升级 +${result.levelBonus} 级` : `落后 ${Math.abs(result.levelBonus)} 级`}
            </div>
          )}
        </div>

        <div className="podium-list">
          {finishOrder.map((seat, index) => {
            const info = seatInfo(seat);
            const rank = rankOrderTitle(index);
            const isOurTeam = info.isSelf || info.isPartner;

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
                </div>
              </div>
            );
          })}
        </div>

        <div className="round-modal-actions">
          <button className="primary-action-btn pulse-glow" onClick={onRestart}>
            🃏 再来一局！
          </button>
        </div>
      </div>
    </div>
  );
}
