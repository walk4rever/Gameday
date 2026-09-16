// 轻量级 Web Audio 纯程序合成音效，零外链、零资源加载、即开即用。

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    try {
      const stored = localStorage.getItem('guandan:soundEnabled');
      this.enabled = stored !== null ? stored === 'true' : true;
    } catch {
      this.enabled = true;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      localStorage.setItem('guandan:soundEnabled', String(enabled));
    } catch {
      // ignore
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  private initCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** 点击/选中扑克牌的清脆切牌声 */
  public cardSelect(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** 取消选中的较轻回弹声 */
  public cardDeselect(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /** 出牌落桌时的清脆拍桌声 */
  public cardPlay(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.09);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** "不要 / 过" 的微风掠过音效 */
  public pass(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** 炸弹/天王炸出的震慑音效 */
  public bomb(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(140, now);
    osc1.frequency.exponentialRampToValueAtTime(35, now + 0.45);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(480, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.25);

    gain2.gain.setValueAtTime(0.25, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.25);
  }

  /** 轮到自己出牌的柔和提示音：清脆上扬的三音微和弦 */
  public yourTurn(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, vol = 0.12) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(523.25, now, 0.14, 0.12);        // C5
    playTone(659.25, now + 0.08, 0.16, 0.14);  // E5
    playTone(783.99, now + 0.16, 0.24, 0.16);  // G5
  }

  /** 一局胜利结算华丽小和弦 */
  public victory(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  /** 报单/报双紧迫警示音 (哔-哔 双重音) */
  public alertWarning(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.12].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now + offset);
      gain.gain.setValueAtTime(0.12, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }

  /** 互动短语与表情气泡弹出音 (清脆啵音) */
  public popBubble(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** 移动端触感反馈（轻/中/重/成功/错误） */
  public haptic(type: 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'): void {
    triggerHaptic(type);
  }
}

/** 移动端触感反馈独立工具函数 */
export function triggerHaptic(type: 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'selection':
      case 'light':
        navigator.vibrate(8);
        break;
      case 'medium':
        navigator.vibrate(16);
        break;
      case 'heavy':
        navigator.vibrate([25, 35, 25]);
        break;
      case 'success':
        navigator.vibrate([15, 60, 25]);
        break;
      case 'error':
        navigator.vibrate([40, 40, 40]);
        break;
    }
  } catch {
    // ignore
  }
}

export const sound = new SoundManager();

