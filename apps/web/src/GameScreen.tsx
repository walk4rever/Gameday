import { getRankedHintPlays } from '@guandan/bot';
import type { Seat } from '@guandan/engine';
import type { SeatTrickAction } from '@guandan/protocol';
import type { Card, Play } from '@guandan/rules';
import {
  classifyPlay,
  formatCardName,
  getLegalReturnCards,
  getLegalTributeCards,
  recommendReturnCard,
  recommendTributeCard,
  validateReturnCard,
  validateTributeCard
} from '@guandan/rules';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeSelection,
  describePlay,
  isJoker,
  isRed,
  rankLabel,
  rankOrderTitle,
  sortHand
} from './cardDisplay.js';
import type { SeatView, UseGameResult } from './game/types.js';
import { GameSettingsModal } from './components/GameSettingsModal.js';
import { ChatInteraction } from './components/ChatInteraction.js';
import { HonorModal } from './HonorModal.js';
import { recordRoundFinished } from './honorLedger.js';
import { MiniJokerCap, PlayingCard, SuitIcon } from './PlayingCard.js';
import { RoundOverModal } from './RoundOverModal.js';
import { RulesModal } from './RulesModal.js';
import { sound } from './sound.js';
import { useOrientation } from './useOrientation.js';

const FAN_CARD_WIDTH_PX = 52;
const FAN_LIFT_PX = 18;

export interface GameScreenProps {
  game: UseGameResult;
  room?: string;
  banner?: ReactNode;
  onExit?: () => void;
}

function getPortraitStepPx(total: number): number {
  if (total <= 2) return 50;
  if (total <= 3) return 44;
  if (total <= 4) return 38;
  if (total <= 6) return 32;
  if (total <= 8) return 28;
  if (total <= 12) return 22;
  if (total <= 16) return 18;
  if (total <= 20) return 15;
  return 12;
}

function getLandscapeStepPx(total: number): number {
  if (total <= 2) return 66;
  if (total <= 3) return 60;
  if (total <= 4) return 54;
  if (total <= 6) return 48;
  if (total <= 8) return 42;
  if (total <= 12) return 36;
  if (total <= 16) return 30;
  if (total <= 20) return 26;
  return 22;
}

/** 动态半扇形排布：牌少时向中间聚拢，牌多时自适应容器宽度，最外侧牌绝不出界 */
function calculateFanStyle(
  index: number,
  total: number,
  selected: boolean,
  isLandscape: boolean,
  containerWidth: number
): CSSProperties {
  const cardWidth = isLandscape ? 50 : FAN_CARD_WIDTH_PX;
  const liftPx = isLandscape ? 14 : FAN_LIFT_PX;

  if (total <= 1) {
    return {
      left: '50%',
      transform: `translateX(-50%) translateY(${selected ? -liftPx : 0}px)`,
      zIndex: 10
    };
  }

  const steps = total - 1;

  // 预留两侧安全边距（含卡牌旋转向外倾斜产生的位移量，确保最左边的牌角标完全可见）
  const edgeSafetyMargin = isLandscape ? 36 : 28;
  const usableWidth = Math.max(160, containerWidth - edgeSafetyMargin);
  const maxSafeStep = (usableWidth - cardWidth) / steps;

  const preferredStep = isLandscape ? getLandscapeStepPx(total) : getPortraitStepPx(total);
  const stepPx = Math.min(preferredStep, Math.max(8, maxSafeStep));

  // 以屏幕正中 50% 为锚点，两侧对称向中心聚拢
  const offsetFromCenter = (index - steps / 2) * stepPx;
  const leftCalc = `calc(50% - ${cardWidth / 2}px + ${offsetFromCenter}px)`;

  // 弧度控制：随着牌数增多平缓微拱，最外侧牌倾角严格受控，防止左上角切出屏幕
  const maxSpreadDeg = total <= 2
    ? 0
    : total <= 4
      ? isLandscape ? 4 : 5
      : isLandscape
        ? total > 16
          ? 18
          : 12
        : total > 16
          ? 18
          : 12;

  const anglePerCard = maxSpreadDeg / steps;
  const angle = (index - steps / 2) * anglePerCard;

  const lift = selected ? liftPx : 0;
  // 边缘的牌稍往下落，中间微拱起；牌少时不需要多余起拱，保持平整易点
  const archFactor = total <= 3 ? 0 : total <= 6 ? 2 : isLandscape ? 3 : 6;
  const archOffset = Math.sin((index / steps) * Math.PI) * archFactor;

  return {
    left: leftCalc,
    transform: `rotate(${angle}deg) translateY(-${lift + archOffset}px)`,
    // 保持手牌自然的从左往右叠放层级，浮出时不要跨层盖到右边邻牌的左上角数字与花色
    zIndex: index + 10
  };
}

function seatAt(seats: SeatView[], seat: Seat): SeatView {
  return (
    seats.find((s) => s.seat === seat) ?? {
      seat,
      name: `座位 ${seat}`,
      isBot: true,
      connected: false,
      status: 'online',
      handCount: 0
    }
  );
}

function trickFor(currentTrick: SeatTrickAction[], seat: Seat): SeatTrickAction | undefined {
  return currentTrick.find((a) => a.seat === seat);
}

/** 动态计算牌桌打出牌的重叠间距，牌少时完全不重叠，牌多时依然留出足够宽的左侧角标可见区域 */
function getTrickCardMarginLeft(idx: number, total: number, isLandscape: boolean): number {
  if (idx === 0) return 0;
  // 1-2张牌：完全无重叠，清晰平铺
  if (total <= 2) return isLandscape ? 4 : 3;
  // 3张牌：微贴并排
  if (total <= 3) return isLandscape ? 2 : 1;
  // 4张牌：炸弹等，微叠，留出20px以上可见角标
  if (total <= 4) return isLandscape ? -7 : -8;
  // 5张牌（顺子/同花顺/三带二）：留出18px以上可见角标
  if (total <= 5) return isLandscape ? -9 : -10;
  // 6张牌（钢板/木板连对）：留出16px以上可见角标
  if (total <= 6) return isLandscape ? -10 : -11;
  // 7张以上（大型炸弹）：留出15px以上可见角标
  return isLandscape ? -11 : -12;
}

/** 掼蛋标准规范席位方位定义：0:南, 1:东, 2:北, 3:西 (对门为搭档) */
const SEAT_DIRECTIONS: Record<Seat, { name: '南' | '东' | '北' | '西'; team: '南北' | '东西'; teamCode: 'NS' | 'EW' }> = {
  0: { name: '南', team: '南北', teamCode: 'NS' },
  1: { name: '东', team: '东西', teamCode: 'EW' },
  2: { name: '北', team: '南北', teamCode: 'NS' },
  3: { name: '西', team: '东西', teamCode: 'EW' }
};

/** 牌桌上各家打出的牌区：使用与手牌统一的 PlayingCard 矢量渲染，图案、王牌与逢人配角标完全一致 */
function TrickDisplay({
  action,
  level,
  isWinning,
  isLandscape
}: {
  action: SeatTrickAction | undefined;
  level?: Rank | undefined;
  isWinning?: boolean;
  isLandscape?: boolean;
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
  const count = action.cards.length;

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
            style={{
              marginLeft: getTrickCardMarginLeft(idx, count, Boolean(isLandscape)),
              zIndex: idx + 1
            }}
          >
            <PlayingCard card={card} level={level} size="table" />
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
  finishedRank,
  chatBubble
}: {
  seat: SeatView;
  active: boolean;
  role: 'partner' | 'rival' | 'self';
  finishedRank?: number | undefined;
  chatBubble?: { text: string; emoji?: string | undefined } | undefined;
}) {
  const dirMeta = SEAT_DIRECTIONS[seat.seat];
  const isPartner = role === 'partner';
  const isSelf = role === 'self';
  const roleText = isSelf ? '我' : isPartner ? '搭档' : '对手';
  const count = seat.handCount;
  const isFinished = count === 0;

  // 报牌逻辑：掼蛋报牌机制（剩 1 张报单，剩 2 张报双，剩 5 张以下急报，剩 10 张以下黄标）
  const isSingle = !isFinished && count === 1;
  const isDouble = !isFinished && count === 2;
  const isUrgent = !isFinished && count <= 5 && !isSingle && !isDouble;
  const isWarning = !isFinished && count <= 10 && !isUrgent && !isSingle && !isDouble;

  return (
    <div
      className={`table-seat-card table-seat-${role} ${active ? 'seat-active' : ''} ${
        isFinished ? 'seat-finished' : ''
      }`}
    >
      {/* 实时互动气泡 */}
      {chatBubble && (
        <div className="seat-speech-bubble-pop">
          {chatBubble.emoji && <span className="bubble-emoji">{chatBubble.emoji}</span>}
          <span className="bubble-text">{chatBubble.text}</span>
          <div className="bubble-arrow" />
        </div>
      )}

      <div className="seat-avatar-wrap">
        <div
          className={`seat-avatar ${
            !seat.isBot && seat.status === 'offline'
              ? 'avatar-offline'
              : !seat.isBot && seat.status === 'left'
                ? 'avatar-left'
                : ''
          }`}
        >
          {seat.isBot ? '🤖' : '👤'}
          {!seat.isBot && seat.status === 'offline' && (
            <span className="seat-offline-dot" title="掉线中" />
          )}
          {!seat.isBot && seat.status === 'left' && (
            <span className="seat-left-dot" title="已退出" />
          )}
          {!seat.isBot && seat.status === 'online' && seat.connected && (
            <span className="seat-online-dot" title="在线" />
          )}
        </div>
        {active && <span className="thinking-beacon" title="行动中" />}
      </div>

      <div className="seat-main-info">
        <div className="seat-top-row">
          <span className="seat-display-name">{seat.name}</span>
          {!seat.isBot && seat.status === 'offline' && (
            <span className="seat-status-pill pill-offline">🔴 掉线</span>
          )}
          {!seat.isBot && seat.status === 'left' && (
            <span className="seat-status-pill pill-left">🚪 离开</span>
          )}
          <span
            className={`seat-role-pill ${
              isSelf ? 'pill-self' : isPartner ? 'pill-partner' : 'pill-rival'
            }`}
          >
            {dirMeta.name} · {roleText}
          </span>
        </div>

        {/* 剩余牌数及报牌警告 */}
        <div className="seat-status-row">
          {finishedRank !== undefined ? (
            <span className="seat-finished-badge">
              {rankOrderTitle(finishedRank).badge}
              {count > 0 ? ` (剩${count}张)` : ''}
            </span>
          ) : isFinished ? (
            <span className="seat-finished-badge">已出完</span>
          ) : (
            <span
              className={`seat-count-badge ${
                isSingle
                  ? 'count-report-single pulse-alarm'
                  : isDouble
                    ? 'count-report-double pulse-alarm'
                    : isUrgent
                      ? 'count-urgent'
                      : isWarning
                        ? 'count-warning'
                        : ''
              }`}
            >
              {isSingle
                ? '🚨 报单 1 张！'
                : isDouble
                  ? '⚠️ 报双 2 张！'
                  : isUrgent
                    ? `🚨 剩 ${count} 张`
                    : isWarning
                      ? `⚠️ 剩 ${count} 张`
                      : `剩 ${count} 张`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function GameScreen({ game, room, banner, onExit }: GameScreenProps) {
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

  const { isLandscape, needsForcedRotation, toggleOrientation } = useOrientation();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => sound.isEnabled());
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleShareRoom = () => {
    try {
      void navigator.clipboard.writeText(window.location.href);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  // 容器宽度动态感知，严密防止最左边与最右边的牌在不同手机视口上被裁切
  const fanAreaRef = useRef<HTMLDivElement>(null);
  const [fanWidth, setFanWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth - 16 : 360
  );

  useEffect(() => {
    const updateWidth = () => {
      if (fanAreaRef.current) {
        const w = fanAreaRef.current.clientWidth;
        if (w > 0) {
          setFanWidth(w);
          return;
        }
      }
      setFanWidth(window.innerWidth - 16);
    };

    updateWidth();

    const el = fanAreaRef.current;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && el) {
      observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(el);
    }

    window.addEventListener('resize', updateWidth);
    window.addEventListener('orientationchange', updateWidth);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
      window.removeEventListener('orientationchange', updateWidth);
    };
  }, []);

  // 滑动多选（滑动触控/拖拽连选）
  const [isDragging, setIsDragging] = useState(false);
  const dragVisitedIdsRef = useRef<Set<string>>(new Set());

  // 音效与触感监控（轮到自己出牌时即刻播放提示音与触感）
  const prevTurnRef = useRef<Seat | null>(null);
  useEffect(() => {
    if (prevTurnRef.current !== currentTurn) {
      if (isHumanTurn && !roundOver) {
        sound.yourTurn();
        sound.haptic('medium');
      }
      prevTurnRef.current = currentTurn;
    }
  }, [currentTurn, isHumanTurn, roundOver]);

  const prevRoundOverRef = useRef(roundOver);
  useEffect(() => {
    if (!prevRoundOverRef.current && roundOver) {
      sound.victory();
      sound.haptic('success');
    }
    prevRoundOverRef.current = roundOver;
  }, [roundOver]);

  // 家庭荣誉榜与结算自动记账
  const [showHonorModal, setShowHonorModal] = useState(false);
  const recordedRoundsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (roundOver && finishOrder.length === 4) {
      const roundKey = `${game.matchSession?.roundNumber ?? 1}-${finishOrder.join(',')}`;
      if (!recordedRoundsRef.current.has(roundKey)) {
        recordedRoundsRef.current.add(roundKey);
        recordRoundFinished({
          seats,
          finishOrder,
          matchSession: game.matchSession ?? null
        });
      }
    }
  }, [roundOver, finishOrder, seats, game.matchSession]);

  // 报单 / 报双首次触发全场高亮横幅与急促警报音
  const [alertNotice, setAlertNotice] = useState<{ text: string; id: number } | null>(null);
  const prevHandCountsRef = useRef<Record<number, number>>({});

  useEffect(() => {
    const currentCounts: Record<number, number> = {};
    for (const s of seats) {
      currentCounts[s.seat] = s.handCount;
      const prev = prevHandCountsRef.current[s.seat];
      if (prev !== undefined && prev > 2) {
        if (s.handCount === 1) {
          sound.alertWarning();
          setAlertNotice({
            text: `🚨 【${s.name}】报单！只剩 1 张牌！`,
            id: Date.now()
          });
        } else if (s.handCount === 2) {
          sound.alertWarning();
          setAlertNotice({
            text: `⚠️ 【${s.name}】报双！只剩 2 张牌！`,
            id: Date.now()
          });
        }
      }
    }
    prevHandCountsRef.current = currentCounts;
  }, [seats]);

  useEffect(() => {
    if (!alertNotice) return;
    const timer = setTimeout(() => {
      setAlertNotice((curr) => (curr?.id === alertNotice.id ? null : curr));
    }, 3200);
    return () => clearTimeout(timer);
  }, [alertNotice]);

  // 快捷短语与表情气泡弹出管理
  const [chatBubbles, setChatBubbles] = useState<
    Record<number, { text: string; emoji?: string | undefined; id: number }>
  >({});

  useEffect(() => {
    const chat = game.incomingChat;
    if (!chat) return;
    sound.popBubble();
    const id = Date.now();
    setChatBubbles((prev) => ({
      ...prev,
      [chat.seat]: { text: chat.message, emoji: chat.emoji, id }
    }));
    const timer = setTimeout(() => {
      setChatBubbles((prev) => {
        if (prev[chat.seat]?.id === id) {
          const next = { ...prev };
          delete next[chat.seat];
          return next;
        }
        return prev;
      });
    }, 3800);
    return () => clearTimeout(timer);
  }, [game.incomingChat]);

  const topSeat = ((humanSeat + 2) % 4) as Seat;
  const leftSeat = ((humanSeat + 1) % 4) as Seat;
  const rightSeat = ((humanSeat + 3) % 4) as Seat;

  const hand = useMemo(() => sortHand(game.hand, level), [game.hand, level]);
  const selectedCards = useMemo(
    () => hand.filter((c) => selectedIds.has(c.id)),
    [hand, selectedIds]
  );

  // 上家需压制的牌（传入 level，正确识别逢人配百搭）
  const opponentLastPlay: Play | null = useMemo(() => {
    if (!lastPlay || lastPlay.seat === humanSeat) return null;
    return classifyPlay(lastPlay.cards, level);
  }, [lastPlay, humanSeat, level]);

  const isLastPlayFromPartner = useMemo(() => {
    if (!lastPlay) return false;
    return lastPlay.seat === topSeat;
  }, [lastPlay, topSeat]);

  const partnerHandSize = useMemo(() => {
    const s = seats.find((item) => item.seat === topSeat);
    return s ? s.handCount : Infinity;
  }, [seats, topSeat]);

  // 启发式智能提示推荐列表（按综合战术价值由优至劣排序，去重保护炸弹）
  const hintOptions: Play[] = useMemo(() => {
    if (!isHumanTurn || roundOver) return [];
    return getRankedHintPlays(
      {
        hand: game.hand,
        lastPlay: opponentLastPlay,
        level,
        isLastPlayFromPartner,
        partnerHandSize
      },
      4
    );
  }, [isHumanTurn, roundOver, game.hand, opponentLastPlay, level, isLastPlayFromPartner, partnerHandSize]);

  const [hintIndex, setHintIndex] = useState(0);

  // 轮次变化、上家出牌变化或对局结束时重置提示轮换索引
  useEffect(() => {
    setHintIndex(0);
  }, [currentTurn, opponentLastPlay, roundOver]);

  // 实时出牌智能分析（裁判+教练指导）
  const selectionAnalysis = useMemo(
    () => analyzeSelection(selectedCards, opponentLastPlay, level),
    [selectedCards, opponentLastPlay, level]
  );

  // 进贡 / 还贡阶段交互状态
  const tributePhase = game.tributePhase;
  const isTributeActive = Boolean(tributePhase);
  const [tributeError, setTributeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTributeActive) {
      setTributeError(null);
    }
  }, [isTributeActive]);

  const myPayExchange = useMemo(() => {
    if (!tributePhase || tributePhase.stage !== 'pay') return null;
    return tributePhase.exchanges.find((ex) => ex.fromSeat === humanSeat && !ex.tributeCard) ?? null;
  }, [tributePhase, humanSeat]);

  const myReturnExchange = useMemo(() => {
    if (!tributePhase || tributePhase.stage !== 'return') return null;
    return tributePhase.exchanges.find((ex) => ex.toSeat === humanSeat && !ex.returnCard) ?? null;
  }, [tributePhase, humanSeat]);

  const isMyPayTurn = Boolean(myPayExchange);
  const isMyReturnTurn = Boolean(myReturnExchange);
  const isMyTributeTurn = isMyPayTurn || isMyReturnTurn;

  const tributeTargetName = useMemo(() => {
    if (myPayExchange) {
      return seats.find((s) => s.seat === myPayExchange.toSeat)?.name ?? `座位 ${myPayExchange.toSeat + 1}`;
    }
    if (myReturnExchange) {
      return seats.find((s) => s.seat === myReturnExchange.fromSeat)?.name ?? `座位 ${myReturnExchange.fromSeat + 1}`;
    }
    return '';
  }, [myPayExchange, myReturnExchange, seats]);

  const legalTributeCards = useMemo(() => {
    if (!isMyPayTurn) return [];
    return getLegalTributeCards(hand, level);
  }, [isMyPayTurn, hand, level]);

  const recommendedTribute = useMemo(() => {
    if (!isMyPayTurn) return null;
    return recommendTributeCard(hand, level);
  }, [isMyPayTurn, hand, level]);

  const legalReturnCards = useMemo(() => {
    if (!isMyReturnTurn) return [];
    return getLegalReturnCards(hand, level);
  }, [isMyReturnTurn, hand, level]);

  const recommendedReturn = useMemo(() => {
    if (!isMyReturnTurn) return null;
    return recommendReturnCard(hand, level);
  }, [isMyReturnTurn, hand, level]);

  const handleSmartTributeRecommend = () => {
    if (isMyPayTurn && recommendedTribute) {
      setSelectedIds(new Set([recommendedTribute.id]));
      setTributeError(null);
      sound.cardSelect();
      sound.haptic('selection');
    } else if (isMyReturnTurn && recommendedReturn) {
      setSelectedIds(new Set([recommendedReturn.id]));
      setTributeError(null);
      sound.cardSelect();
      sound.haptic('selection');
    }
  };

  const handleConfirmPayTribute = () => {
    if (!isMyPayTurn) return;
    if (selectedCards.length !== 1) {
      setTributeError('请选择一张牌进行进贡');
      sound.haptic('error');
      return;
    }
    const chosen = selectedCards[0]!;
    const validation = validateTributeCard(chosen, hand, level);
    if (!validation.ok) {
      setTributeError(validation.error);
      sound.haptic('error');
      return;
    }
    setTributeError(null);
    setSelectedIds(new Set());
    sound.cardPlay();
    sound.haptic('medium');
    game.payTribute(chosen.id);
  };

  const handleConfirmReturnTribute = () => {
    if (!isMyReturnTurn) return;
    if (selectedCards.length !== 1) {
      setTributeError('请选择一张牌进行还贡');
      sound.haptic('error');
      return;
    }
    const chosen = selectedCards[0]!;
    const validation = validateReturnCard(chosen, hand, level);
    if (!validation.ok) {
      setTributeError(validation.error);
      sound.haptic('error');
      return;
    }
    setTributeError(null);
    setSelectedIds(new Set());
    sound.cardPlay();
    sound.haptic('medium');
    game.returnTribute(chosen.id);
  };

  const toggleCard = (cardId: string) => {
    if (!isHumanTurn || roundOver) return;
    game.clearError();

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
        sound.cardDeselect();
        sound.haptic('light');
      } else {
        next.add(cardId);
        sound.cardSelect();
        sound.haptic('selection');
      }
      return next;
    });
  };

  // 滑动选择支持
  const handlePointerDown = (cardId: string) => {
    if (isTributeActive) {
      if (!isMyTributeTurn) return;
      setSelectedIds(new Set([cardId]));
      setTributeError(null);
      sound.cardSelect();
      sound.haptic('selection');
      return;
    }
    if (!isHumanTurn || roundOver) return;
    setIsDragging(true);
    dragVisitedIdsRef.current = new Set([cardId]);
    toggleCard(cardId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isTributeActive || !isDragging || !isHumanTurn || roundOver) return;
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
      sound.haptic('heavy');
    } else {
      sound.cardPlay();
      sound.haptic('medium');
    }
    game.playSelected(selectedCards);
    setSelectedIds(new Set());
  };

  const handlePass = () => {
    if (!canPass) return;
    sound.pass();
    sound.haptic('light');
    game.pass();
    setSelectedIds(new Set());
  };

  const handleHint = () => {
    if (hintOptions.length === 0) return;
    const currentOption = hintOptions[hintIndex % hintOptions.length]!;
    setSelectedIds(new Set(currentOption.cards.map((c) => c.id)));
    setHintIndex((prev) => (prev + 1) % hintOptions.length);
    sound.cardSelect();
    sound.haptic('selection');
    game.clearError();
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    sound.cardDeselect();
    sound.haptic('light');
  };

  const toggleSound = () => {
    const next = sound.toggle();
    setSoundEnabled(next);
  };

  const seatName = (seat: Seat) => seatAt(seats, seat).name;

  const matchSession = game.matchSession;
  const nsRank = matchSession?.teamRanks[0] ?? level;
  const ewRank = matchSession?.teamRanks[1] ?? '2';
  const dealerTeam = matchSession?.dealerTeam ?? 0;
  const isMyTeamNS = (humanSeat % 2) === 0;

  return (
    <div
      className={`app game-screen-container ${isLandscape ? 'landscape-mode' : ''} ${
        needsForcedRotation ? 'app-forced-landscape' : ''
      }`}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      {banner}

      {/* 顶部常驻极简信息与统一设置栏 */}
      <div className="game-top-bar">
        {/* 左上角：两方当前打几 + 庄家 + 当前级牌融合看板 */}
        <div
          className="match-unified-pill"
          onClick={() => setShowSettingsModal(true)}
          role="button"
          tabIndex={0}
          title="点击查看详细计分与记牌器"
        >
          <div className="unified-teams-group">
            <div className={`unified-team-item ${isMyTeamNS ? 'is-me' : ''}`}>
              <span className="unified-team-label">南北</span>
              <span className="unified-team-rank">打<strong>{nsRank}</strong></span>
              {dealerTeam === 0 && <span className="unified-dealer-tag">庄</span>}
            </div>

            <span className="unified-vs-sep">:</span>

            <div className={`unified-team-item ${!isMyTeamNS ? 'is-me' : ''}`}>
              <span className="unified-team-label">东西</span>
              <span className="unified-team-rank">打<strong>{ewRank}</strong></span>
              {dealerTeam === 1 && <span className="unified-dealer-tag">庄</span>}
            </div>
          </div>

          <span className="unified-pipe-sep" />

          <div className="unified-level-group">
            <span className="unified-level-text">级牌 <strong>{level}</strong></span>
            <span className="unified-wild-text">♥配</span>
          </div>
        </div>

        <div className="top-bar-controls">
          <button
            type="button"
            className="top-settings-btn"
            onClick={() => setShowSettingsModal(true)}
            aria-label="打开设置与计分看板"
          >
            ⚙️ 设置
          </button>
        </div>
      </div>

      {/* 进贡 / 还贡阶段实时交互提示栏 */}
      {isTributeActive && tributePhase && (
        <div className={`tribute-interactive-banner stage-${tributePhase.stage}`}>
          <span className="tribute-interactive-icon">
            {tributePhase.stage === 'pay' ? '👑' : '🎁'}
          </span>
          <div className="tribute-interactive-content">
            {isMyPayTurn ? (
              <span className="tribute-interactive-text">
                <strong>请选择手中最大的牌进贡</strong> 给【{tributeTargetName}】（已为你高亮候选牌）
              </span>
            ) : isMyReturnTurn ? (
              <span className="tribute-interactive-text">
                已收到【{tributeTargetName}】进贡的【
                {myReturnExchange?.tributeCard ? formatCardName(myReturnExchange.tributeCard) : '大牌'}
                】，<strong>请选择一张不超过 10 的牌还贡</strong>
              </span>
            ) : (
              <span className="tribute-interactive-text">
                {tributePhase.stage === 'pay'
                  ? `进贡环节：正在等待【${tributePhase.waitingSeats
                      .map((s) => seats.find((item) => item.seat === s)?.name ?? `座位 ${s + 1}`)
                      .join('、')}】进贡最大牌...`
                  : `还贡环节：正在等待【${tributePhase.waitingSeats
                      .map((s) => seats.find((item) => item.seat === s)?.name ?? `座位 ${s + 1}`)
                      .join('、')}】挑选还贡牌...`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 进贡 / 抗贡已完成事件广播横幅 */}
      {!isTributeActive && game.tribute && game.tribute.type !== 'none' && !roundOver && (
        <div className={`tribute-broadcast-banner tribute-${game.tribute.type}`}>
          <span className="tribute-icon">
            {game.tribute.type === 'anti_tribute' ? '🛡️' : '👑'}
          </span>
          <span className="tribute-desc">{game.tribute.description}</span>
        </div>
      )}

      {/* 牌桌核心交互区（椭圆毛毡拟真台面） */}
      <div className="felt-table-wrapper" onClick={handleClearSelection}>
        <div
          className="felt-table-surface"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button, .card, .seat-card, a')) return;
            handleClearSelection();
          }}
        >
          {/* 台面中央暗纹 / 等候开局发牌面板 */}
          {game.waitingToStart ? (
            <div className="table-waiting-center-card">
              <div className="waiting-center-badge">🎴 等候开局</div>
              <h2 className="waiting-center-title">经典掼蛋 · 4 人对局</h2>
              <p className="waiting-center-desc">
                {seats.filter((s) => !s.isBot && s.connected).length > 1
                  ? `已有 ${seats.filter((s) => !s.isBot && s.connected).length} 位真人玩家就座，随时可以发牌`
                  : '空位已自动由智能 AI 补齐，随时可以开始发牌'}
              </p>
              <div className="waiting-center-actions">
                <button
                  type="button"
                  className="waiting-start-deal-btn pulse-glow"
                  onClick={game.onStartGame}
                >
                  🃏 开始发牌
                </button>
                <button
                  type="button"
                  className={`waiting-share-invite-btn ${copiedInvite ? 'is-copied' : ''}`}
                  onClick={handleShareRoom}
                >
                  {copiedInvite ? '✓ 已复制邀请链接' : '🔗 邀请好友同桌'}
                </button>
              </div>
            </div>
          ) : (
            <div className="felt-center-watermark">
              <span className="felt-watermark-text">GUANDAN</span>
              <span className="felt-watermark-sub">级牌 {level} · 红桃配</span>
            </div>
          )}

          {/* 北：搭档席位 */}
          <div className="table-zone zone-top">
            <SeatCard
              seat={seatAt(seats, topSeat)}
              active={currentTurn === topSeat && !roundOver}
              role="partner"
              finishedRank={finishOrder.includes(topSeat) ? finishOrder.indexOf(topSeat) : undefined}
              chatBubble={chatBubbles[topSeat]}
            />
            <TrickDisplay
              action={trickFor(currentTrick, topSeat)}
              level={level}
              isWinning={lastPlay?.seat === topSeat}
              isLandscape={isLandscape}
            />
          </div>

          {/* 西/东：上家席位 */}
          <div className="table-zone zone-left">
            <SeatCard
              seat={seatAt(seats, leftSeat)}
              active={currentTurn === leftSeat && !roundOver}
              role="rival"
              finishedRank={finishOrder.includes(leftSeat) ? finishOrder.indexOf(leftSeat) : undefined}
              chatBubble={chatBubbles[leftSeat]}
            />
            <TrickDisplay
              action={trickFor(currentTrick, leftSeat)}
              level={level}
              isWinning={lastPlay?.seat === leftSeat}
              isLandscape={isLandscape}
            />
          </div>

          {/* 东/西：下家席位 */}
          <div className="table-zone zone-right">
            <SeatCard
              seat={seatAt(seats, rightSeat)}
              active={currentTurn === rightSeat && !roundOver}
              role="rival"
              finishedRank={finishOrder.includes(rightSeat) ? finishOrder.indexOf(rightSeat) : undefined}
              chatBubble={chatBubbles[rightSeat]}
            />
            <TrickDisplay
              action={trickFor(currentTrick, rightSeat)}
              level={level}
              isWinning={lastPlay?.seat === rightSeat}
              isLandscape={isLandscape}
            />
          </div>

          {/* 南：我（自己）席位与打出的牌区 */}
          <div className="table-zone zone-self">
            <TrickDisplay
              action={trickFor(currentTrick, humanSeat)}
              level={level}
              isWinning={lastPlay?.seat === humanSeat}
              isLandscape={isLandscape}
            />
            <SeatCard
              seat={seatAt(seats, humanSeat)}
              active={isHumanTurn && !roundOver}
              role="self"
              finishedRank={finishOrder.includes(humanSeat) ? finishOrder.indexOf(humanSeat) : undefined}
              chatBubble={chatBubbles[humanSeat]}
            />
          </div>
        </div>
      </div>

      {/* 玩家掉线或主动退出时的对局暂停与等待决策横幅 */}
      {game.paused && (
        <div className="paused-waiting-banner">
          <div className="paused-badge-row">
            <span className="paused-pulse-dot" />
            <span className="paused-title">
              {game.paused.reason === 'offline'
                ? `⏸️ 牌局暂停：玩家【${game.paused.name}】掉线中`
                : `⏸️ 牌局暂停：玩家【${game.paused.name}】已退出游戏`}
            </span>
          </div>
          <p className="paused-desc">
            {game.paused.reason === 'offline'
              ? '系统已暂停当前出牌，正在等待其重新联网进入（未托管给机器人）'
              : '该玩家已离开牌局，牌局暂停中（未托管给机器人）'}
          </p>
          <div className="paused-actions">
            <button
              type="button"
              className="secondary-action-btn paused-action-btn"
              onClick={() => game.delegateBot(game.paused!.seat)}
              title="同桌玩家可协商授权由AI替补代打"
            >
              🤖 授权AI接管替打
            </button>
            <button
              type="button"
              className="secondary-action-btn paused-action-btn btn-dissolve"
              onClick={() => game.dissolve()}
              title="协商解散本局，重回大厅"
            >
              🚪 解散本局回大厅
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 / 规则验证提示 */}
      {(tributeError || game.error) && (
        <div className="game-error-toast">{tributeError || game.error}</div>
      )}

      {/* 玩家手牌扇形展示区 */}
      <div
        ref={fanAreaRef}
        className={`hand-fan-area ${
          (isTributeActive ? isMyTributeTurn : isHumanTurn && !roundOver) ? 'hand-my-turn' : ''
        }`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.card, button')) return;
          handleClearSelection();
        }}
      >
        <div className="hand-fan-container">
          {hand.map((card, index) => {
            const selected = selectedIds.has(card.id);
            const tributeBadge = (() => {
              if (isMyPayTurn) {
                if (legalTributeCards.some((c) => c.id === card.id)) return '进贡';
              } else if (isMyReturnTurn) {
                if (recommendedReturn?.id === card.id) return '推荐';
                if (legalReturnCards.some((c) => c.id === card.id)) return '可还';
              }
              return undefined;
            })();

            return (
              <PlayingCard
                key={card.id}
                card={card}
                level={level}
                selected={selected}
                tributeBadge={tributeBadge}
                disabled={isTributeActive ? !isMyTributeTurn : !isHumanTurn || roundOver}
                onPointerDown={() => handlePointerDown(card.id)}
                style={calculateFanStyle(index, hand.length, selected, isLandscape, fanWidth)}
              />
            );
          })}
        </div>
      </div>

      {/* 底部操作按钮栏（仅在正式发牌后显示） */}
      {!game.waitingToStart && (
        isTributeActive ? (
          <div
            className={`game-action-controls tribute-action-controls ${
              isMyTributeTurn ? 'controls-my-turn' : 'controls-waiting'
            }`}
          >
            {isMyPayTurn ? (
              <>
                <button
                  type="button"
                  className="btn-hint tribute-btn-recommend"
                  onClick={handleSmartTributeRecommend}
                >
                  💡 智能推荐
                </button>
                <button
                  type="button"
                  className={`btn-play tribute-btn-confirm ${selectedCards.length === 1 ? 'pulse-ready' : ''}`}
                  onClick={handleConfirmPayTribute}
                  disabled={selectedCards.length !== 1}
                >
                  👑 进贡此牌 {selectedCards.length === 1 ? `(${formatCardName(selectedCards[0]!)})` : ''}
                </button>
              </>
            ) : isMyReturnTurn ? (
              <>
                <button
                  type="button"
                  className="btn-hint tribute-btn-recommend"
                  onClick={handleSmartTributeRecommend}
                >
                  💡 智能推荐
                </button>
                <button
                  type="button"
                  className={`btn-play tribute-btn-confirm ${selectedCards.length === 1 ? 'pulse-ready' : ''}`}
                  onClick={handleConfirmReturnTribute}
                  disabled={selectedCards.length !== 1}
                >
                  🎁 还贡此牌 {selectedCards.length === 1 ? `(${formatCardName(selectedCards[0]!)})` : ''}
                </button>
              </>
            ) : (
              <div className="tribute-waiting-pill">
                <span className="tribute-waiting-dot" />
                <span>
                  {tributePhase?.stage === 'pay' ? '正在等待其他玩家进贡...' : '正在等待受贡方挑选还贡牌...'}
                </span>
              </div>
            )}
            <ChatInteraction onSend={game.sendChat} />
          </div>
        ) : (
          <div className={`game-action-controls ${isHumanTurn && !roundOver ? 'controls-my-turn' : ''}`}>
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
              disabled={!isHumanTurn || roundOver || hintOptions.length === 0}
            >
              💡 提示{hintOptions.length > 1 ? ` (${(hintIndex % hintOptions.length) + 1}/${hintOptions.length})` : ''}
            </button>

            <button
              type="button"
              className={`btn-play ${selectionAnalysis.valid && selectedCards.length > 0 ? 'pulse-ready' : ''}`}
              onClick={handlePlay}
              disabled={!isHumanTurn || roundOver || !selectionAnalysis.valid}
              title={selectedCards.length > 0 ? selectionAnalysis.detail : undefined}
            >
              {selectedCards.length > 0
                ? selectionAnalysis.valid
                  ? `出牌 (${selectedCards.length})`
                  : '无法出牌'
                : '出牌'}
            </button>

            {/* 快捷短语互动入口 */}
            <ChatInteraction onSend={game.sendChat} />
          </div>
        )
      )}

      {/* 报单/报双全屏横幅警报 */}
      {alertNotice && (
        <div className="fullscreen-alert-banner pulse-alarm">
          <span>{alertNotice.text}</span>
        </div>
      )}

      {/* 游戏设置与计分看板全局模态窗 */}
      {showSettingsModal && (
        <GameSettingsModal
          level={level}
          myHand={hand}
          playedCards={game.playedCards ?? []}
          matchSession={game.matchSession}
          humanSeat={humanSeat}
          room={room}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onShareRoom={handleShareRoom}
          copiedInvite={copiedInvite}
          onShowRules={() => setShowRules(true)}
          onShowHonor={() => setShowHonorModal(true)}
          onResetMatch={() => setShowResetConfirm(true)}
          onExit={onExit ? () => setShowExitConfirm(true) : undefined}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* 规则指南弹窗 */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* 家庭战绩荣誉榜弹窗 */}
      {showHonorModal && <HonorModal onClose={() => setShowHonorModal(false)} />}

      {/* 结算颁奖台弹窗 */}
      {roundOver && (
        <RoundOverModal
          finishOrder={finishOrder}
          humanSeat={humanSeat}
          seats={seats}
          matchSession={game.matchSession ?? null}
          onRestart={game.restart}
          onResetMatch={game.resetMatch}
        />
      )}

      {/* 重置比赛从打2开局确认弹窗 */}
      {showResetConfirm && (
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)}>
          <div className="exit-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="exit-modal-title">🔄 重置比赛从打 2 开始？</h3>
            <p className="exit-modal-desc">
              确定要重置当前对决进度吗？双方战队级数将归零重回打 2，局数重新从第 1 副起计。
            </p>
            <div className="exit-modal-actions">
              <button
                type="button"
                className="secondary-action-btn"
                onClick={() => setShowResetConfirm(false)}
              >
                继续当前比赛
              </button>
              <button
                type="button"
                className="primary-action-btn"
                onClick={() => {
                  setShowResetConfirm(false);
                  game.resetMatch();
                }}
              >
                确认从打 2 重开
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 退出牌桌确认弹窗 */}
      {showExitConfirm && (
        <div className="modal-backdrop" onClick={() => setShowExitConfirm(false)}>
          <div className="exit-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="exit-modal-title">🚪 确定退出当前牌桌？</h3>
            <p className="exit-modal-desc">
              对局正在进行中。退出后将返回房间大厅，其他玩家将看到您的退出状态并可选择暂停等待或解散，系统不会托管给机器人。
            </p>
            <div className="exit-modal-actions">
              <button
                type="button"
                className="secondary-action-btn"
                onClick={() => setShowExitConfirm(false)}
              >
                继续打牌
              </button>
              <button
                type="button"
                className="primary-action-btn btn-danger-exit"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit?.();
                }}
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 快捷横竖屏切换悬浮按钮（右下角纯图标，不用文字） */}
      <button
        type="button"
        className="floating-orientation-btn"
        onClick={toggleOrientation}
        title={isLandscape ? '切换为竖屏' : '切换为横屏'}
        aria-label={isLandscape ? '切换为竖屏' : '切换为横屏'}
      >
        <svg
          className="orientation-rotate-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M21 21v-5h-5" />
          {isLandscape ? (
            <rect x="6.5" y="8.5" width="11" height="7" rx="1.5" strokeWidth="1.8" />
          ) : (
            <rect x="8.5" y="6.5" width="7" height="11" rx="1.5" strokeWidth="1.8" />
          )}
        </svg>
      </button>
    </div>
  );
}
