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

export function SuitIcon({ suit, className }: { suit: string; className?: string }) {
  switch (suit) {
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="1em" height="1em">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="1em" height="1em">
          <path d="M12 2L4 12l8 10 8-10L12 2z" />
        </svg>
      );
    case 'spade':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="1em" height="1em">
          <path d="M12 2C9.5 6 4 10.5 4 14.5c0 2.5 1.8 4.5 4.3 4.5 1.4 0 2.7-.6 3.7-1.6V20h-3v2h8v-2h-3v-2.6c1 1 2.3 1.6 3.7 1.6 2.5 0 4.3-2 4.3-4.5 0-4-5.5-8.5-8-12.5z" />
        </svg>
      );
    case 'club':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="1em" height="1em">
          <path d="M12 2a4 4 0 0 0-4 4c0 .4.1.8.2 1.2A4.5 4.5 0 0 0 5 11.5 4.5 4.5 0 0 0 9.5 16H10v1.5H7.5V19h9v-1.5H14V16h.5A4.5 4.5 0 0 0 19 11.5 4.5 4.5 0 0 0 15.8 7.2c.1-.4.2-.8.2-1.2a4 4 0 0 0-4-4z" />
        </svg>
      );
    default:
      return null;
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
          </div>
          <div className="card-joker-center">
            <span className="card-joker-icon">{card.rank === 'big_joker' ? '👑' : '🃏'}</span>
            <span className="card-joker-title">{rankLabel(card)}</span>
          </div>
          <div className="card-corner card-corner-bottom">
            <span className="card-rank">{card.rank === 'big_joker' ? '大' : '小'}</span>
            <span className="card-rank">王</span>
          </div>
        </div>
      ) : (
        <>
          {/* 左上角标：确保叠牌时依然清晰可见 */}
          <div className="card-corner card-corner-top">
            <span className="card-rank">{rankLabel(card)}</span>
            <SuitIcon suit={card.suit} className="card-suit-small" />
          </div>

          {/* 中间高精度花色水印 */}
          <div className="card-center">
            <SuitIcon suit={card.suit} className="card-suit-large" />
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
