import type { GameEvent } from './game/engine';

const MUTE_KEY = 'pet-muted';

/** Tiny WebAudio synth for the table sounds. Created lazily on the first tap (iOS needs a gesture). */
export class Sound {
  private ctx: AudioContext | null = null;
  muted: boolean;

  constructor() {
    let m = false;
    try {
      m = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* ignore */
    }
    this.muted = m;
  }

  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggle() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(e: GameEvent) {
    if (this.muted || !this.ctx) return;
    switch (e) {
      case 'eat':
        [0, 0.18, 0.36].forEach((d) => this.tone('square', 300, 160, 0.09, 0.05, d));
        return;
      case 'play':
        return this.tone('sine', 220, 620, 0.2, 0.08);
      case 'bounce':
        return this.tone('sine', 260, 520, 0.12, 0.06);
      case 'pet':
        this.tone('triangle', 700, 900, 0.08, 0.05);
        this.tone('triangle', 900, 1200, 0.1, 0.05, 0.08);
        return;
      case 'sleep':
        [523, 440, 349].forEach((f, i) => this.tone('sine', f, f, 0.35, 0.05, i * 0.3));
        return;
      case 'wake':
        [349, 440, 523].forEach((f, i) => this.tone('sine', f, f, 0.2, 0.05, i * 0.12));
        return;
      case 'no':
        return this.tone('square', 200, 150, 0.15, 0.05);
      case 'hatch':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.12, 0.05, i * 0.1));
        return;
      case 'tap':
        return this.tone('square', 420, 380, 0.05, 0.04);
      case 'sad':
        return this.tone('sine', 400, 250, 0.4, 0.05);
    }
  }
}
