import { useEffect, useState } from 'react';

const FORCED_LANDSCAPE_KEY = 'guandan:forcedLandscape';

export function useOrientation() {
  const [isNaturalLandscape, setIsNaturalLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
  });

  const [isForcedLandscape, setIsForcedLandscape] = useState<boolean>(() => {
    try {
      return localStorage.getItem(FORCED_LANDSCAPE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const updateOrientation = () => {
      const isLandscapeView =
        window.innerWidth > window.innerHeight ||
        Boolean(window.matchMedia?.('(orientation: landscape)').matches);
      setIsNaturalLandscape(isLandscapeView);
    };

    updateOrientation();

    const mql = window.matchMedia?.('(orientation: landscape)');
    mql?.addEventListener?.('change', updateOrientation);

    screen.orientation?.addEventListener?.('change', updateOrientation);
    window.visualViewport?.addEventListener?.('resize', updateOrientation);
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      mql?.removeEventListener?.('change', updateOrientation);
      screen.orientation?.removeEventListener?.('change', updateOrientation);
      window.visualViewport?.removeEventListener?.('resize', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  // 当设备本身已经是自然横屏时，不需要强行通过 CSS rotate 90deg
  const needsForcedRotation = isForcedLandscape && !isNaturalLandscape;
  // 当前处于横屏显示状态（无论是自然横屏还是强制横屏）
  const isLandscape = isNaturalLandscape || isForcedLandscape;

  const toggleOrientation = () => {
    const nextForced = !isForcedLandscape;
    setIsForcedLandscape(nextForced);
    try {
      localStorage.setItem(FORCED_LANDSCAPE_KEY, String(nextForced));
    } catch {
      // ignore
    }

    // 尝试调用浏览器的 Screen Orientation API（在支持的移动端有效，不支持时静默捕获）
    try {
      if (nextForced) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (screen.orientation as any)?.lock?.('landscape').catch(() => {});
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (screen.orientation as any)?.unlock?.();
      }
    } catch {
      // ignore
    }
  };

  return {
    isLandscape,
    isNaturalLandscape,
    isForcedLandscape,
    needsForcedRotation,
    toggleOrientation
  };
}
