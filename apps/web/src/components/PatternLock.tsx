import { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../sound.js';

export interface PatternLockProps {
  value: string;
  onChange: (pattern: string) => void;
  disabled?: boolean;
  error?: boolean;
  size?: number;
}

interface Point {
  x: number;
  y: number;
}

const GRID_SIZE = 3;

export function PatternLock({
  value,
  onChange,
  disabled = false,
  error = false,
  size = 260
}: PatternLockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);
  const [visitedNodes, setVisitedNodes] = useState<number[]>(() =>
    value ? value.split('').map(Number) : []
  );

  // 同步外部传入的 value
  useEffect(() => {
    if (!isDrawing) {
      setVisitedNodes(value ? value.split('').map(Number) : []);
    }
  }, [value, isDrawing]);

  // 计算九宫格中各节点在组件内的绝对坐标
  const getNodeCenter = useCallback(
    (index: number): Point => {
      const row = Math.floor(index / GRID_SIZE);
      const col = index % GRID_SIZE;
      const step = size / GRID_SIZE;
      return {
        x: col * step + step / 2,
        y: row * step + step / 2
      };
    },
    [size]
  );

  // 根据触控/鼠标的视口坐标，判断落在哪个节点内（命中半径为节点间距的 38%）
  const getHitNode = useCallback(
    (clientX: number, clientY: number): number | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const hitRadius = (size / GRID_SIZE) * 0.42;

      for (let i = 0; i < 9; i++) {
        const center = getNodeCenter(i);
        const dist = Math.hypot(x - center.x, y - center.y);
        if (dist <= hitRadius) {
          return i;
        }
      }
      return null;
    },
    [getNodeCenter, size]
  );

  const getContainerRelativePos = useCallback((clientX: number, clientY: number): Point | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    if (disabled) return;
    setIsDrawing(true);
    const hit = getHitNode(clientX, clientY);
    if (hit !== null) {
      setVisitedNodes([hit]);
      sound.haptic('light');
    } else {
      setVisitedNodes([]);
    }
    setCurrentPos(getContainerRelativePos(clientX, clientY));
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing || disabled) return;
    setCurrentPos(getContainerRelativePos(clientX, clientY));

    const hit = getHitNode(clientX, clientY);
    if (hit !== null && !visitedNodes.includes(hit)) {
      sound.haptic('light');
      setVisitedNodes((prev) => [...prev, hit]);
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentPos(null);

    const patternString = visitedNodes.join('');
    onChange(patternString);
  };

  return (
    <div className="pattern-lock-container" style={{ width: size, margin: '0 auto' }}>
      <div
        ref={containerRef}
        className={`pattern-lock-board ${error ? 'pattern-error' : ''} ${disabled ? 'pattern-disabled' : ''}`}
        style={{ width: size, height: size, position: 'relative', touchAction: 'none' }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleStart(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          handleMove(e.clientX, e.clientY);
        }}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (touch) handleStart(touch.clientX, touch.clientY);
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          if (touch) handleMove(touch.clientX, touch.clientY);
        }}
        onTouchEnd={handleEnd}
      >
        {/* SVG 连接线 */}
        <svg
          className="pattern-svg"
          width={size}
          height={size}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {/* 已连接节点之间的线 */}
          {visitedNodes.map((nodeIdx, i) => {
            if (i === 0) return null;
            const prev = getNodeCenter(visitedNodes[i - 1]!);
            const curr = getNodeCenter(nodeIdx);
            return (
              <line
                key={`line-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={curr.x}
                y2={curr.y}
                stroke={error ? '#ef4444' : '#f59e0b'}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.85}
              />
            );
          })}

          {/* 最后一节点与手指/光标当前位置的实时游标线 */}
          {isDrawing && currentPos && visitedNodes.length > 0 && (
            <line
              x1={getNodeCenter(visitedNodes[visitedNodes.length - 1]!).x}
              y1={getNodeCenter(visitedNodes[visitedNodes.length - 1]!).y}
              x2={currentPos.x}
              y2={currentPos.y}
              stroke={error ? '#ef4444' : '#f59e0b'}
              strokeWidth={4}
              strokeDasharray="4 4"
              strokeLinecap="round"
              opacity={0.65}
            />
          )}
        </svg>

        {/* 九宫格点位 */}
        {Array.from({ length: 9 }).map((_, idx) => {
          const center = getNodeCenter(idx);
          const isVisited = visitedNodes.includes(idx);
          const visitOrder = visitedNodes.indexOf(idx);

          return (
            <div
              key={idx}
              className={`pattern-node ${isVisited ? 'node-active' : ''} ${error && isVisited ? 'node-error' : ''}`}
              style={{
                position: 'absolute',
                left: center.x,
                top: center.y,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none'
              }}
            >
              <div className="node-outer-ring" />
              <div className="node-center-dot" />
              {isVisited && (
                <span className="node-order-num">{visitOrder + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 提示与清空操作 */}
      <div className="pattern-status-bar">
        <span className={`pattern-hint ${error ? 'hint-error' : ''}`}>
          {visitedNodes.length === 0
            ? '按住并滑动连接点位'
            : visitedNodes.length < 4
              ? `已连接 ${visitedNodes.length} 点（需至少 4 点）`
              : `已连接 ${visitedNodes.length} 点 ✓`}
        </span>
        {visitedNodes.length > 0 && !disabled && (
          <button
            type="button"
            className="pattern-clear-btn"
            onClick={() => {
              setVisitedNodes([]);
              onChange('');
            }}
          >
            清空
          </button>
        )}
      </div>
    </div>
  );
}
