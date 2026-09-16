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

/** 经典小丑角标微缩帽子图标（左上角/右下角/出牌区） */
export function MiniJokerCap({ isBig, className }: { isBig: boolean; className?: string }) {
  const primary = isBig ? '#dc2626' : '#1e293b';
  const accent = isBig ? '#f59e0b' : '#94a3b8';
  return (
    <svg viewBox="0 0 24 20" fill="none" className={className} width="1em" height="1em">
      <path d="M9 12C6 6 2 7 1 11C1 14 3 15 5 14C3.5 13 3.5 10 7 9C8 8.5 8.8 10 9 12Z" fill={primary} />
      <circle cx="5" cy="14.5" r="1.2" fill={accent} />
      <path d="M15 12C18 6 22 7 23 11C23 14 21 15 19 14C20.5 13 20.5 10 17 9C16 8.5 15.2 10 15 12Z" fill={primary} />
      <circle cx="19" cy="14.5" r="1.2" fill={accent} />
      <path d="M10 12C10 5 14 3 15 4C16 5 15 8 13 9C12 9.5 11 11 10 12Z" fill={primary} />
      <circle cx="15" cy="4" r="1.2" fill={accent} />
      <path d="M8 12C10 13 14 13 16 12L15.5 14.5C13.5 15.5 10.5 15.5 8.5 14.5Z" fill={accent} />
    </svg>
  );
}

/** 经典红黑小丑精细插画（传统中国扑克 / 经典竞技扑克传神小丑画） */
export function ClassicJokerIllustration({ isBig, className }: { isBig: boolean; className?: string }) {
  const primary = isBig ? '#dc2626' : '#1e293b';
  const secondary = isBig ? '#d97706' : '#475569';
  const highlight = isBig ? '#fde047' : '#94a3b8';
  const faceBg = isBig ? '#fffbeb' : '#f8fafc';
  const blush = isBig ? '#ef4444' : '#64748b';
  const border = isBig ? '#b91c1c' : '#1e293b';
  const idPrefix = isBig ? 'bigJoker' : 'smallJoker';

  return (
    <svg viewBox="0 0 100 135" className={className} width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`${idPrefix}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isBig ? '#fef08a' : '#cbd5e1'} stopOpacity={isBig ? 0.35 : 0.25} />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 复古椭圆底衬与双线花边 */}
      <ellipse cx="50" cy="68" rx="46" ry="58" fill={`url(#${idPrefix}-glow)`} />
      <ellipse cx="50" cy="68" rx="45" ry="57" fill="none" stroke={border} strokeWidth="1.2" />
      <ellipse cx="50" cy="68" rx="42.5" ry="54.5" fill="none" stroke={border} strokeWidth="0.7" strokeDasharray="2 1.5" opacity="0.6" />

      {/* 顶部 JOKER 经典花体标题 */}
      <text
        x="50"
        y="22"
        textAnchor="middle"
        fontSize="9"
        fontWeight="900"
        fontFamily="serif"
        fill={primary}
        letterSpacing="2.5"
      >
        JOKER
      </text>

      {/* 小丑卷发刘海 */}
      <path
        d="M32 52C28 48 26 56 30 62M68 52C72 48 74 56 70 62"
        fill="none"
        stroke={secondary}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* 小丑面庞底色与轮廓 */}
      <path
        d="M35 50C35 40 65 40 65 50C65 64 58 73 50 75C42 73 35 64 35 50Z"
        fill={faceBg}
        stroke={border}
        strokeWidth="1.2"
      />

      {/* 经典三峰小丑帽 (Jester Hat) */}
      {/* 左角 */}
      <path
        d="M35 46C26 34 16 35 12 48C10 55 14 60 18 57C15 54 14 47 22 43C27 40 33 42 36 45Z"
        fill={primary}
        stroke={border}
        strokeWidth="0.8"
      />
      <circle cx="18" cy="58" r="2.8" fill={highlight} stroke={border} strokeWidth="0.8" />
      <line x1="16.5" y1="58" x2="19.5" y2="58" stroke={border} strokeWidth="0.6" />

      {/* 右角 */}
      <path
        d="M65 46C74 34 84 35 88 48C90 55 86 60 82 57C85 54 86 47 78 43C73 40 67 42 64 45Z"
        fill={secondary}
        stroke={border}
        strokeWidth="0.8"
      />
      <circle cx="82" cy="58" r="2.8" fill={highlight} stroke={border} strokeWidth="0.8" />
      <line x1="80.5" y1="58" x2="83.5" y2="58" stroke={border} strokeWidth="0.6" />

      {/* 中角 */}
      <path
        d="M42 43C43 28 51 22 55 24C58 26 57 32 50 34C46 36 44 40 43 43Z"
        fill={primary}
        stroke={border}
        strokeWidth="0.8"
      />
      <circle cx="56" cy="24" r="2.8" fill={highlight} stroke={border} strokeWidth="0.8" />

      {/* 前额装饰带 */}
      <path
        d="M34 47C44 49 56 49 66 47L65 51C55 53 45 53 35 51Z"
        fill={highlight}
        stroke={border}
        strokeWidth="0.8"
      />

      {/* 生动传神的五官 */}
      <path d="M39 49C42 47 45 48 46 50" fill="none" stroke={border} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M61 49C58 47 55 48 54 50" fill="none" stroke={border} strokeWidth="1.2" strokeLinecap="round" />

      <path d="M40 54C42 52 45 52 46 54" fill="none" stroke={border} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="43" cy="53" r="0.9" fill={border} />
      <path d="M60 54C58 52 55 52 54 54" fill="none" stroke={border} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="57" cy="53" r="0.9" fill={border} />

      {/* 小丑红鼻头 */}
      <circle cx="50" cy="58" r="2.4" fill={blush} stroke={border} strokeWidth="0.7" />

      {/* 经典滑稽脸颊彩绘 */}
      <polygon points="41,59 43,62 41,65 39,62" fill={blush} opacity="0.65" />
      <polygon points="59,59 61,62 59,65 57,62" fill={blush} opacity="0.65" />

      {/* 灿烂欢笑大嘴巴 */}
      <path
        d="M42 64C46 70 54 70 58 64C55 67 45 67 42 64Z"
        fill={blush}
        stroke={border}
        strokeWidth="0.8"
      />
      <path d="M44 65C47 67 53 67 56 65" fill="#ffffff" />
      <path d="M40 63C41 65 42 66 43 65M60 63C59 65 58 66 57 65" stroke={border} strokeWidth="1" strokeLinecap="round" />

      {/* 荷叶齿状领 (Ruffle Collar) */}
      <path
        d="M34 72L22 79L30 84L21 91L34 90L37 99L44 91L50 102L56 91L63 99L66 90L79 91L70 84L78 79L66 72C60 76 40 76 34 72Z"
        fill={primary}
        stroke={border}
        strokeWidth="1"
      />
      <polygon points="34,72 22,79 30,84 34,77" fill={secondary} opacity="0.85" />
      <polygon points="34,90 37,99 44,91 41,83" fill={secondary} opacity="0.85" />
      <polygon points="56,91 63,99 66,90 59,83" fill={secondary} opacity="0.85" />
      <polygon points="70,84 78,79 66,72 66,77" fill={secondary} opacity="0.85" />

      {/* 领尖小金铃铛 */}
      <circle cx="21" cy="79" r="1.8" fill={highlight} stroke={border} strokeWidth="0.6" />
      <circle cx="20" cy="91" r="1.8" fill={highlight} stroke={border} strokeWidth="0.6" />
      <circle cx="37" cy="100" r="1.8" fill={highlight} stroke={border} strokeWidth="0.6" />
      <circle cx="50" cy="103" r="2.2" fill={highlight} stroke={border} strokeWidth="0.7" />
      <circle cx="63" cy="100" r="1.8" fill={highlight} stroke={border} strokeWidth="0.6" />
      <circle cx="80" cy="91" r="1.8" fill={highlight} stroke={border} strokeWidth="0.6" />
      <circle cx="79" cy="79" r="1.8" fill={highlight} stroke={border} strokeWidth="0.6" />

      {/* 经典小丑手持权杖 (Marotte) */}
      <line x1="72" y1="95" x2="88" y2="72" stroke={secondary} strokeWidth="2" strokeLinecap="round" />
      <line x1="72" y1="95" x2="88" y2="72" stroke={highlight} strokeWidth="0.8" strokeDasharray="3 3" />
      <circle cx="88" cy="71" r="4.2" fill={faceBg} stroke={border} strokeWidth="0.8" />
      <path d="M85 68C85 65 91 65 91 68" fill={primary} />
      <circle cx="88" cy="64" r="1.3" fill={highlight} stroke={border} strokeWidth="0.5" />
      <circle cx="87" cy="70" r="0.5" fill={border} />
      <circle cx="90" cy="70" r="0.5" fill={border} />
      <path d="M86.8 72C88 73.2 89.5 73.2 90.2 72" stroke={blush} strokeWidth="0.6" fill="none" />

      {/* 底部典雅名牌横幅 */}
      <rect x="22" y="112" width="56" height="15" rx="3" fill={faceBg} stroke={border} strokeWidth="1.2" />
      <rect x="24" y="114" width="52" height="11" rx="2" fill="none" stroke={secondary} strokeWidth="0.6" opacity="0.6" />
      <text
        x="50"
        y="122.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="900"
        fill={primary}
        letterSpacing="2"
      >
        {isBig ? '★ 大 王 ★' : '★ 小 王 ★'}
      </text>
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
            <circle cx="20" cy="5.5" r="1.2" />
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
  const isBig = card.rank === 'big_joker';
  const red = isRed(card);
  const isLevel = level ? isLevelCard(card, level) : false;
  const isWild = level ? isWildCard(card, level) : false;

  const className = [
    'card',
    red ? 'card-red' : 'card-black',
    joker ? (isBig ? 'card-big-joker' : 'card-small-joker') : '',
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
            <span className="card-rank">{isBig ? '大' : '小'}</span>
            <span className="card-rank">王</span>
            <MiniJokerCap isBig={isBig} className="card-corner-joker-icon" />
          </div>
          <div className="card-joker-center">
            <ClassicJokerIllustration isBig={isBig} className="card-joker-illustration" />
          </div>
          <div className="card-corner card-corner-bottom">
            <span className="card-rank">{isBig ? '大' : '小'}</span>
            <span className="card-rank">王</span>
            <MiniJokerCap isBig={isBig} className="card-corner-joker-icon" />
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
