import type { GameEvent } from './game/engine';

const MUTE_KEY = 'farm-muted';

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
      case 'plant':
        this.tone('sine', 220, 330, 0.08, 0.07);
        this.tone('sine', 330, 440, 0.08, 0.05, 0.06);
        return;
      case 'harvest':
        [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.08, 0.05, i * 0.06));
        return;
      case 'bumper':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.09, 0.05, i * 0.06));
        return;
      case 'sell':
        this.tone('square', 988, 988, 0.06, 0.04);
        this.tone('square', 1319, 1319, 0.12, 0.04, 0.06);
        return;
      case 'buy':
        return this.tone('triangle', 520, 700, 0.1, 0.06);
      case 'unlock':
        [392, 523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.06, i * 0.08));
        return;
      case 'ready':
        this.tone('sine', 1319, 1319, 0.12, 0.05);
        this.tone('sine', 1760, 1760, 0.18, 0.05, 0.1);
        return;
      case 'no':
        return this.tone('square', 200, 150, 0.14, 0.05);
      case 'tap':
        return this.tone('square', 600, 560, 0.04, 0.03);
    }
  }
}
