import type { Seat } from '@guandan/engine';
import type { SeatTrickAction } from '@guandan/protocol';
import type { Card, Play } from '@guandan/rules';
import { classifyPlay } from '@guandan/rules';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeSelection,
  describePlay,
  isRed,
  playTypeName,
  rankLabel,
  rankOrderTitle,
  smallestMove,
  sortHand
} from './cardDisplay.js';
import type { SeatView, UseGameResult } from './game/types.js';
import { PlayingCard, SuitIcon } from './PlayingCard.js';
import { RoundOverModal } from './RoundOverModal.js';
import { RulesModal } from './RulesModal.js';
import { sound } from './sound.js';

const FAN_CARD_WIDTH_PX = 66;
const FAN_LIFT_PX = 24;

export interface GameScreenProps {
  game: UseGameResult;
  banner?: ReactNode;
}

/** 动态半扇形排布：牌多时紧凑收拢，牌少时舒展居中，弧度自然。 */
function calculateFanStyle(index: number, total: number, selected: boolean): CSSProperties {
  if (total <= 1) {
    return {
      left: '50%',
      transform: `translateX(-50%) translateY(${selected ? -FAN_LIFT_PX : 0}px)`,
      zIndex: selected ? 200 : 10
    };
  }

  // 牌数多时控制在 36 度以内，牌数少时 12~24 度，手感更沉稳
  const maxSpreadDeg = total > 16 ? 38 : total > 8 ? 28 : 16;
  const steps = total - 1;
  const anglePerCard = maxSpreadDeg / steps;
  const angle = (index - steps / 2) * anglePerCard;

  // 手机端自适应边距与跨度
  const edgeInsetPx = 16;
  const span = `(100% - ${FAN_CARD_WIDTH_PX}px - ${2 * edgeInsetPx}px)`;
  const leftCalc = `calc(${edgeInsetPx}px + ${index} * ${span} / ${steps})`;

  const lift = selected ? FAN_LIFT_PX : 0;
  // 边缘的牌稍往下落，中间微拱起，形成优美的弧面
  const archOffset = Math.sin((index / steps) * Math.PI) * 8;

  return {
    left: leftCalc,
    transform: `rotate(${angle}deg) translateY(-${lift + archOffset}px)`,
    zIndex: selected ? 200 + index : index + 10
  };
}

function seatAt(seats: SeatView[], seat: Seat): SeatView {
  return (
    seats.find((s) => s.seat === seat) ?? {
      seat,
      name: `座位 ${seat}`,
      isBot: true,
      connected: false,
      handCount: 0
    }
  );
}

function trickFor(currentTrick: SeatTrickAction[], seat: Seat): SeatTrickAction | undefined {
  return currentTrick.find((a) => a.seat === seat);
}

/** 桌面打出的小扑克牌 */
function TableMiniCard({ card }: { card: Card }) {
  const red = isRed(card);
  return (
    <div className={`table-mini-card ${red ? 'card-red' : 'card-black'}`}>
      <span className="mini-rank">{rankLabel(card)}</span>
      <SuitIcon suit={card.suit} className="mini-suit-icon" />
    </div>
  );
}

/** 牌桌上各家打出的牌区 */
function TrickDisplay({
  action,
  isWinning
}: {
  action: SeatTrickAction | undefined;
  isWinning?: boolean;
}) {
  if (!action) return <div className="trick-slot empty" />;

  if (action.action === 'pass') {
    return (
      <div className="trick-slot">
        <span className="trick-pass-bubble">不要</span>
      </div>
    );
  }

  const play = classifyPlay(action.cards);
  const typeText = play ? describePlay(play) : `${action.cards.length} 张`;

  return (
    <div className={`trick-slot has-cards ${isWinning ? 'trick-winning' : ''}`}>
      <div className="trick-tag">
        {isWinning && <span className="winning-star">👑 </span>}
        {typeText}
      </div>
      <div className="trick-cards-row">
        {action.cards.map((card, idx) => (
          <div
            key={card.id}
            className="trick-card-wrapper"
            style={{ marginLeft: idx === 0 ? 0 : '-18px', zIndex: idx }}
          >
            <TableMiniCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 牌桌座位席卡片 */
function SeatCard({
  seat,
  active,
  role,
  finishedRank
}: {
  seat: SeatView;
  active: boolean;
  role: 'partner' | 'rival';
  finishedRank?: number | undefined;
}) {
  const isPartner = role === 'partner';
  const roleText = isPartner ? '搭档' : '对手';
  const count = seat.handCount;
  const isFinished = count === 0;

  // 报牌逻辑：掼蛋报牌机制（剩 10 张以下黄标，剩 5 张以下红标急报）
  const isUrgent = !isFinished && count <= 5;
  const isWarning = !isFinished && count <= 10 && !isUrgent;

  return (
    <div
      className={`table-seat-card table-seat-${role} ${active ? 'seat-active' : ''} ${
        isFinished ? 'seat-finished' : ''
      }`}
    >
      <div className="seat-avatar-wrap">
        <div className="seat-avatar">
          {seat.isBot ? '🤖' : '👤'}
          {seat.connected && !seat.isBot && <span className="seat-online-dot" />}
        </div>
        {active && <span className="thinking-beacon" title="行动中" />}
      </div>

      <div className="seat-main-info">
        <div className="seat-top-row">
          <span className="seat-display-name">{seat.name}</span>
          <span className={`seat-role-pill ${isPartner ? 'pill-partner' : 'pill-rival'}`}>
            {roleText}
          </span>
        </div>

        {/* 剩余牌数及报牌警告 */}
        <div className="seat-status-row">
          {isFinished ? (
            <span className="seat-finished-badge">
              {finishedRank !== undefined ? rankOrderTitle(finishedRank).badge : '已出完'}
            </span>
          ) : (
            <span
              className={`seat-count-badge ${isUrgent ? 'count-urgent' : isWarning ? 'count-warning' : ''}`}
            >
              {isUrgent ? `🚨 剩 ${count} 张` : isWarning ? `⚠️ 剩 ${count} 张` : `剩 ${count} 张`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function GameScreen({ game, banner }: GameScreenProps) {
  const {
    level,
    seats,
    currentTurn,
    currentTrick,
    legalMoves,
    isHumanTurn,
    canPass,
    roundOver,
    finishOrder,
    humanSeat,
    lastPlay
  } = game;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showRules, setShowRules] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => sound.isEnabled());

  // 滑动多选（滑动触控/拖拽连选）
  const [isDragging, setIsDragging] = useState(false);
  const dragVisitedIdsRef = useRef<Set<string>>(new Set());

  // 音效触发监控
  const prevTurnRef = useRef(currentTurn);
  useEffect(() => {
    if (prevTurnRef.current !== currentTurn) {
      if (isHumanTurn && !roundOver) {
        sound.yourTurn();
      }
      prevTurnRef.current = currentTurn;
    }
  }, [currentTurn, isHumanTurn, roundOver]);

  const prevRoundOverRef = useRef(roundOver);
  useEffect(() => {
    if (!prevRoundOverRef.current && roundOver) {
      sound.victory();
    }
    prevRoundOverRef.current = roundOver;
  }, [roundOver]);

  const topSeat = ((humanSeat + 2) % 4) as Seat;
  const leftSeat = ((humanSeat + 1) % 4) as Seat;
  const rightSeat = ((humanSeat + 3) % 4) as Seat;

  const hand = useMemo(() => sortHand(game.hand, level), [game.hand, level]);
  const selectedCards = useMemo(
    () => hand.filter((c) => selectedIds.has(c.id)),
    [hand, selectedIds]
  );

  // 提示牌
  const hint = useMemo(
    () => (legalMoves.length > 0 ? smallestMove(legalMoves, level) : null),
    [legalMoves, level]
  );
  const hintIds = useMemo(() => new Set(hint?.cards.map((c) => c.id) ?? []), [hint]);

  // 上家需压制的牌
  const opponentLastPlay: Play | null = useMemo(() => {
    if (!lastPlay || lastPlay.seat === humanSeat) return null;
    return classifyPlay(lastPlay.cards);
  }, [lastPlay, humanSeat]);

  // 实时出牌智能分析（裁判+教练指导）
  const selectionAnalysis = useMemo(
    () => analyzeSelection(selectedCards, opponentLastPlay, level),
    [selectedCards, opponentLastPlay, level]
  );

  const toggleCard = (cardId: string) => {
    if (!isHumanTurn || roundOver) return;
    game.clearError();

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
        sound.cardDeselect();
      } else {
        next.add(cardId);
        sound.cardSelect();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(8);
        }
      }
      return next;
    });
  };

  // 滑动选择支持
  const handlePointerDown = (cardId: string) => {
    if (!isHumanTurn || roundOver) return;
    setIsDragging(true);
    dragVisitedIdsRef.current = new Set([cardId]);
    toggleCard(cardId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !isHumanTurn || roundOver) return;
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const cardElement = element?.closest('[data-card-id]') as HTMLElement | null;
    const cardId = cardElement?.dataset.cardId;
    if (cardId && !dragVisitedIdsRef.current.has(cardId)) {
      dragVisitedIdsRef.current.add(cardId);
      toggleCard(cardId);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragVisitedIdsRef.current.clear();
  };

  const handlePlay = () => {
    if (!selectionAnalysis.valid || selectedCards.length === 0) return;
    if (selectionAnalysis.play?.type === 'bomb' || selectionAnalysis.play?.type === 'fourJokers') {
      sound.bomb();
    } else {
      sound.cardPlay();
    }
    game.playSelected(selectedCards);
    setSelectedIds(new Set());
  };

  const handlePass = () => {
    if (!canPass) return;
    sound.pass();
    game.pass();
    setSelectedIds(new Set());
  };

  const handleHint = () => {
    if (!hint) return;
    setSelectedIds(hintIds);
    sound.cardSelect();
    game.clearError();
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    sound.cardDeselect();
  };

  const toggleSound = () => {
    const next = sound.toggle();
    setSoundEnabled(next);
  };

  const seatName = (seat: Seat) => seatAt(seats, seat).name;

  return (
    <div
      className="app game-screen-container"
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      {banner}

      {/* 顶部状态与快捷控制条 */}
      <div className="game-top-bar">
        <div className="top-level-badge" title="当前主牌/级牌">
          <span className="crown-icon">👑</span>
          <span className="level-text">级牌: {level}</span>
          <span className="level-wild-hint">（红桃{level}逢人配）</span>
        </div>

        <div className="top-bar-controls">
          <button
            className={`top-icon-btn ${soundEnabled ? 'active' : 'muted'}`}
            onClick={toggleSound}
            title={soundEnabled ? '音效已开启' : '音效已静音'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button className="top-icon-btn" onClick={() => setShowRules(true)} title="掼蛋规则速查">
            📖 规则
          </button>
          <button className="top-icon-btn" onClick={game.restart} title="重新发牌开新局">
            🔄 重开
          </button>
        </div>
      </div>

      {/* 牌桌核心交互区（椭圆毛毡拟真台面） */}
      <div className="felt-table-wrapper" onClick={handleClearSelection}>
        <div className="felt-table-surface" onClick={(e) => e.stopPropagation()}>
          {/* 台面中央暗纹 */}
          <div className="felt-center-watermark">
            <span className="felt-watermark-text">GUANDAN</span>
            <span className="felt-watermark-sub">级牌 {level}</span>
          </div>

          {/* 北：搭档席位 */}
          <div className="table-zone zone-top">
            <SeatCard
              seat={seatAt(seats, topSeat)}
              active={currentTurn === topSeat && !roundOver}
              role="partner"
              finishedRank={finishOrder.includes(topSeat) ? finishOrder.indexOf(topSeat) : undefined}
            />
            <TrickDisplay
              action={trickFor(currentTrick, topSeat)}
              isWinning={lastPlay?.seat === topSeat}
            />
          </div>

          {/* 西：上家（对手）席位 */}
          <div className="table-zone zone-left">
            <SeatCard
              seat={seatAt(seats, leftSeat)}
              active={currentTurn === leftSeat && !roundOver}
              role="rival"
              finishedRank={finishOrder.includes(leftSeat) ? finishOrder.indexOf(leftSeat) : undefined}
            />
            <TrickDisplay
              action={trickFor(currentTrick, leftSeat)}
              isWinning={lastPlay?.seat === leftSeat}
            />
          </div>

          {/* 东：下家（对手）席位 */}
          <div className="table-zone zone-right">
            <SeatCard
              seat={seatAt(seats, rightSeat)}
              active={currentTurn === rightSeat && !roundOver}
              role="rival"
              finishedRank={finishOrder.includes(rightSeat) ? finishOrder.indexOf(rightSeat) : undefined}
            />
            <TrickDisplay
              action={trickFor(currentTrick, rightSeat)}
              isWinning={lastPlay?.seat === rightSeat}
            />
          </div>

          {/* 南：我打出的牌区 */}
          <div className="table-zone zone-self">
            <TrickDisplay
              action={trickFor(currentTrick, humanSeat)}
              isWinning={lastPlay?.seat === humanSeat}
            />
          </div>
        </div>
      </div>

      {/* 实时出牌裁判与智能指导条 */}
      <div className="play-coach-bar">
        {selectedCards.length > 0 ? (
          <div className={`coach-pill ${selectionAnalysis.valid ? 'pill-valid' : 'pill-invalid'}`}>
            <span className="coach-icon">{selectionAnalysis.valid ? '✓' : '⚠️'}</span>
            <span className="coach-name">{selectionAnalysis.name || '选牌分析'}</span>
            <span className="coach-detail">{selectionAnalysis.detail}</span>
            <button
              className="coach-clear-btn"
              onClick={handleClearSelection}
              title="清空当前已选牌"
            >
              清空
            </button>
          </div>
        ) : (
          <div className={`coach-pill ${isHumanTurn ? 'pill-turn' : 'pill-wait'}`}>
            <span className="coach-icon">{isHumanTurn ? '👉' : '⏳'}</span>
            <span className="coach-detail">
              {roundOver
                ? '对局已结束'
                : isHumanTurn
                  ? opponentLastPlay
                    ? `上家出了 ${playTypeName(opponentLastPlay.type, opponentLastPlay.size)}，请选牌压制或跳过`
                    : '轮到你首出，请选择任意合法牌型领出'
                  : currentTurn === humanSeat
                    ? '轮到你出牌'
                    : `等待 ${seatName(currentTurn)} 出牌中…`}
            </span>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {game.error && <div className="game-error-toast">{game.error}</div>}

      {/* 玩家手牌扇形展示区 */}
      <div className="hand-fan-area">
        <div className="hand-fan-container">
          {hand.map((card, index) => {
            const selected = selectedIds.has(card.id);
            const hinted = hintIds.has(card.id);
            return (
              <PlayingCard
                key={card.id}
                card={card}
                level={level}
                selected={selected}
                hinted={hinted}
                disabled={!isHumanTurn || roundOver}
                onPointerDown={() => handlePointerDown(card.id)}
                style={calculateFanStyle(index, hand.length, selected)}
              />
            );
          })}
        </div>
      </div>

      {/* 底部操作按钮栏 */}
      <div className="game-action-controls">
        <button
          type="button"
          className="btn-pass"
          onClick={handlePass}
          disabled={!canPass || roundOver || !isHumanTurn}
          title={!canPass && isHumanTurn ? '本轮为你领出，不可跳过' : ''}
        >
          {!canPass && isHumanTurn ? '请领出' : '不要'}
        </button>

        <button
          type="button"
          className="btn-hint"
          onClick={handleHint}
          disabled={!isHumanTurn || roundOver || !hint}
        >
          💡 提示
        </button>

        <button
          type="button"
          className={`btn-play ${selectionAnalysis.valid && selectedCards.length > 0 ? 'pulse-ready' : ''}`}
          onClick={handlePlay}
          disabled={!isHumanTurn || roundOver || !selectionAnalysis.valid}
        >
          {selectedCards.length > 0 ? `出牌 (${selectedCards.length})` : '出牌'}
        </button>
      </div>

      {/* 规则指南弹窗 */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* 结算颁奖台弹窗 */}
      {roundOver && (
        <RoundOverModal
          finishOrder={finishOrder}
          humanSeat={humanSeat}
          seats={seats}
          onRestart={game.restart}
        />
      )}
    </div>
  );
}
