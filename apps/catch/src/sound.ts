import type { GameEvent } from './game/engine';

const MUTE_KEY = 'catch-muted';

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
      case 'catch':
        return this.tone('square', 660, 880, 0.07, 0.05);
      case 'golden':
        [880, 1109, 1319, 1760].forEach((f, i) => this.tone('square', f, f, 0.08, 0.05, i * 0.05));
        return;
      case 'combo':
        return this.tone('triangle', 1000, 1500, 0.14, 0.06);
      case 'miss':
        return this.tone('sine', 260, 110, 0.18, 0.09);
      case 'hurt':
        return this.tone('sawtooth', 200, 50, 0.3, 0.09);
      case 'life':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.1, 0.05, i * 0.07));
        return;
      case 'over':
        [330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.9, 0.25, 0.06, i * 0.2));
        return;
      case 'start':
        return this.tone('sine', 440, 660, 0.12, 0.08);
    }
  }
}
