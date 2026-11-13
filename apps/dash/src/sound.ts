import type { GameEvent } from './game/engine';

const MUTE_KEY = 'dash-muted';

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
      case 'jump':
        return this.tone('square', 300, 620, 0.12, 0.05);
      case 'slide':
        return this.tone('sawtooth', 420, 140, 0.16, 0.04);
      case 'coin':
        this.tone('square', 988, 988, 0.06, 0.04);
        this.tone('square', 1319, 1319, 0.1, 0.04, 0.06);
        return;
      case 'hit':
        return this.tone('sawtooth', 220, 50, 0.3, 0.09);
      case 'fall':
        return this.tone('sine', 520, 60, 0.6, 0.1);
      case 'mile':
        [660, 880, 1100].forEach((f, i) => this.tone('square', f, f, 0.09, 0.04, i * 0.07));
        return;
      case 'start':
        return this.tone('sine', 440, 660, 0.12, 0.08);
    }
  }
}
