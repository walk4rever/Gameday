import type { Card, Rank } from '@guandan/rules';
import type { CSSProperties, PointerEvent } from 'react';
import { isJoker, isLevelCard, isRed, isWildCard, rankLabel } from './cardDisplay.js';

export interface PlayingCardProps {
  card: Card;
  level?: Rank;
  selected?: boolean;
  hinted?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter?: (e: PointerEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

/** 经典法式四花色高精度矢量图标（平滑微弧方块、饱满黑桃/梅花/红桃） */
export function SuitIcon({ suit, className }: { suit: string; className?: string }) {
  switch (suit) {
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="1em" height="1em">
          <path d="M12 21.5C11.3 20.8 2 13.8 2 8.5C2 5.2 4.6 2.5 8 2.5C10.2 2.5 11.4 3.7 12 4.7C12.6 3.7 13.8 2.5 16 2.5C19.4 2.5 22 5.2 22 8.5C22 13.8 12.7 20.8 12 21.5Z" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="1em" height="1em">
          <path d="M12 1.5C12 7 7 12 1.5 12C7 12 12 17 12 22.5C12 17 17 12 22.5 12C17 12 12 7 12 1.5Z" />
        </svg>
      );
    case 'spade':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="1em" height="1em">
          <path d="M12 1.5C11.2 5.5 2.5 11 2.5 15C2.5 18 5 20 8 19.5C9.8 19.2 11 18 11.5 17C11.2 18.5 9.5 20.8 8 22.5H16C14.5 20.8 12.8 18.5 12.5 17C13 18 14.2 19.2 16 19.5C19 20 21.5 18 21.5 15C21.5 11 12.8 5.5 12 1.5Z" />
        </svg>
      );
    case 'club':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="1em" height="1em">
          <path d="M12 2A4.5 4.5 0 0 0 7.8 7.5A4.5 4.5 0 0 0 2.5 14A4.5 4.5 0 0 0 9.8 17.2C9.6 18.5 8.5 20.5 7 22.5H17C15.5 20.5 14.4 18.5 14.2 17.2A4.5 4.5 0 0 0 21.5 14A4.5 4.5 0 0 0 16.2 7.5A4.5 4.5 0 0 0 12 2Z" />
        </svg>
      );
    default:
      return null;
  }
}

/** 大王（Red Joker）专属高贵皇冠图腾 */
export function BigJokerCrown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} width="1em" height="1em">
      <path
        d="M8 37H40V33C40 31.9 39.1 31 38 31H10C8.9 31 8 31.9 8 33V37Z"
        fill="currentColor"
      />
      <circle cx="16" cy="34" r="1.5" fill="#fef08a" />
      <circle cx="24" cy="34" r="1.8" fill="#fef08a" />
      <circle cx="32" cy="34" r="1.5" fill="#fef08a" />
      <path
        d="M8 31L11 15L20 24L24 9L28 24L37 15L40 31H8Z"
        fill="currentColor"
        opacity="0.95"
      />
      <circle cx="24" cy="7.5" r="2.5" fill="#fef08a" />
      <circle cx="11" cy="13.5" r="2" fill="#fef08a" />
      <circle cx="37" cy="13.5" r="2" fill="#fef08a" />
      <path d="M24 2L25 5L28 6L25 7L24 10L23 7L20 6L23 5L24 2Z" fill="#f59e0b" />
    </svg>
  );
}

/** 小王（Black Joker）专属小丑假面与权杖图腾 */
export function SmallJokerMask({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} width="1em" height="1em">
      <path
        d="M12 26C11 16 5 12 3 13C2 14 3 17 6 19C10 21 12 24 12 26Z"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="3.5" cy="13" r="2" fill="#f59e0b" />
      <path
        d="M36 26C37 16 43 12 45 13C46 14 45 17 42 19C38 21 36 24 36 26Z"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="44.5" cy="13" r="2" fill="#f59e0b" />
      <path
        d="M24 6C20 12 13 22 13 26H35C35 22 28 12 24 6Z"
        fill="currentColor"
      />
      <circle cx="24" cy="5" r="2.5" fill="#f59e0b" />
      <path
        d="M15 26C15 33 19 38 24 38C29 38 33 33 33 26C30 28 27 27 24 27C21 27 18 28 15 26Z"
        fill="currentColor"
        opacity="0.9"
      />
      <ellipse cx="19.5" cy="30" rx="2.5" ry="1.5" fill="#ffffff" />
      <ellipse cx="28.5" cy="30" rx="2.5" ry="1.5" fill="#ffffff" />
      <path d="M21 34C22.5 35.5 25.5 35.5 27 34" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** 人头牌（J, Q, K, A）专属古典微雕徽章 */
function CourtCardCenter({ rank, suit }: { rank: Rank; suit: string }) {
  switch (rank) {
    case 'K':
      return (
        <div className="court-emblem court-king">
          <svg viewBox="0 0 40 40" className="court-emblem-svg" width="2.4em" height="2.4em" fill="currentColor">
            <path d="M12 13L15 7L20 11L25 7L28 13H12Z" opacity="0.85" />
            <circle cx="20" cy="5.5" r="1.2" />
            <circle cx="15" cy="5.5" r="1" />
            <circle cx="25" cy="5.5" r="1" />
            <path
              d="M7 16C5 21 5 27 7 32C12 34 28 34 33 32C35 27 35 21 33 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="2 1.5"
              opacity="0.45"
            />
          </svg>
          <SuitIcon suit={suit} className="card-suit-large court-suit" />
          <span className="court-letter">KING</span>
        </div>
      );
    case 'Q':
      return (
        <div className="court-emblem court-queen">
          <svg viewBox="0 0 40 40" className="court-emblem-svg" width="2.4em" height="2.4em" fill="currentColor">
            <path d="M14 11C16 8 20 6.5 20 6.5C20 6.5 24 8 26 11C23 11 20 9.2 20 9.2C20 9.2 17 11 14 11Z" opacity="0.85" />
            <circle cx="20" cy="5" r="1.2" />
            <ellipse
              cx="20"
              cy="23"
              rx="13"
              ry="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="1.5 1.5"
              opacity="0.4"
            />
          </svg>
          <SuitIcon suit={suit} className="card-suit-large court-suit" />
          <span className="court-letter">QUEEN</span>
        </div>
      );
    case 'J':
      return (
        <div className="court-emblem court-jack">
          <svg viewBox="0 0 40 40" className="court-emblem-svg" width="2.4em" height="2.4em" fill="currentColor">
            <path d="M19 5.5C19 5.5 21 8.5 20 11.5C23 8.5 25 5.5 25 5.5C24 8.5 23 11.5 21 12.5H19V5.5Z" opacity="0.85" />
            <path
              d="M9 15H31V25C31 30 20 34.5 20 34.5C20 34.5 9 30 9 25V15Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity="0.4"
            />
          </svg>
          <SuitIcon suit={suit} className="card-suit-large court-suit" />
          <span className="court-letter">JACK</span>
        </div>
      );
    case 'A':
      return (
        <div className="court-emblem court-ace">
          <svg viewBox="0 0 40 40" className="court-emblem-svg ace-starburst" width="2.5em" height="2.5em" fill="currentColor">
            <g opacity="0.32" stroke="currentColor" strokeWidth="1">
              <line x1="20" y1="3" x2="20" y2="37" strokeDasharray="2 2" />
              <line x1="3" y1="20" x2="37" y2="20" strokeDasharray="2 2" />
              <line x1="8" y1="8" x2="32" y2="32" strokeDasharray="2 2" />
              <line x1="8" y1="32" x2="32" y2="8" strokeDasharray="2 2" />
              <circle cx="20" cy="20" r="14.5" fill="none" strokeWidth="0.8" />
            </g>
          </svg>
          <SuitIcon suit={suit} className="card-suit-large court-suit ace-suit" />
          <span className="court-letter">ACE</span>
        </div>
      );
    default:
      return <SuitIcon suit={suit} className="card-suit-large" />;
  }
}

/** 现代高质感扑克牌：清晰角标、自适应级牌与逢人配标识、触控拖拽友好。 */
export function PlayingCard({
  card,
  level,
  selected,
  hinted,
  disabled,
  onClick,
  onPointerDown,
  onPointerEnter,
  style
}: PlayingCardProps) {
  const joker = isJoker(card);
  const red = isRed(card);
  const isLevel = level ? isLevelCard(card, level) : false;
  const isWild = level ? isWildCard(card, level) : false;

  const className = [
    'card',
    red ? 'card-red' : 'card-black',
    joker ? (card.rank === 'big_joker' ? 'card-big-joker' : 'card-small-joker') : '',
    selected ? 'card-selected' : '',
    hinted ? 'card-hinted' : '',
    isLevel ? 'card-level' : '',
    isWild ? 'card-wild' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      disabled={disabled}
      data-card-id={card.id}
    >
      {/* 级牌 / 逢人配右上角专属勋章 */}
      {isWild ? (
        <span className="card-badge card-badge-wild" title="逢人配（百搭万能牌）">
          ★ 配
        </span>
      ) : isLevel ? (
        <span className="card-badge card-badge-level" title="当前级牌">
          级
        </span>
      ) : null}

      {joker ? (
        <div className="card-joker-body">
          <div className="card-corner card-corner-top">
            <span className="card-rank">{card.rank === 'big_joker' ? '大' : '小'}</span>
            <span className="card-rank">王</span>
            {card.rank === 'big_joker' ? (
              <BigJokerCrown className="card-corner-joker-icon" />
            ) : (
              <SmallJokerMask className="card-corner-joker-icon" />
            )}
          </div>
          <div className="card-joker-center">
            {card.rank === 'big_joker' ? (
              <BigJokerCrown className="card-joker-svg" />
            ) : (
              <SmallJokerMask className="card-joker-svg" />
            )}
            <span className="card-joker-title">{rankLabel(card)}</span>
            <span className="card-joker-subtitle">
              {card.rank === 'big_joker' ? '★ RED JOKER ★' : '★ BLACK JOKER ★'}
            </span>
          </div>
          <div className="card-corner card-corner-bottom">
            <span className="card-rank">{card.rank === 'big_joker' ? '大' : '小'}</span>
            <span className="card-rank">王</span>
            {card.rank === 'big_joker' ? (
              <BigJokerCrown className="card-corner-joker-icon" />
            ) : (
              <SmallJokerMask className="card-corner-joker-icon" />
            )}
          </div>
        </div>
      ) : (
        <>
          {/* 左上角标：确保叠牌时依然清晰可见 */}
          <div className="card-corner card-corner-top">
            <span className="card-rank">{rankLabel(card)}</span>
            <SuitIcon suit={card.suit} className="card-suit-small" />
          </div>

          {/* 中间高精度花色/宫廷大牌徽章 */}
          <div className="card-center">
            {card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' || card.rank === 'A' ? (
              <CourtCardCenter rank={card.rank} suit={card.suit} />
            ) : (
              <SuitIcon suit={card.suit} className="card-suit-large" />
            )}
          </div>

          {/* 右下对称角标 */}
          <div className="card-corner card-corner-bottom">
            <span className="card-rank">{rankLabel(card)}</span>
            <SuitIcon suit={card.suit} className="card-suit-small" />
          </div>
        </>
      )}
    </button>
  );
}
