import type { GameEvent } from './game/engine';

const MUTE_KEY = 'invaders-muted';

/** Tiny WebAudio synth for the arcade sounds. Created lazily on the first tap (iOS needs a gesture). */
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

  private noise(dur: number, vol: number, f0 = 3000, f1 = 300) {
    const c = this.ctx;
    if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    const t = c.currentTime;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t);
  }

  play(e: GameEvent) {
    if (this.muted || !this.ctx) return;
    switch (e) {
      case 'shoot':
        return this.tone('square', 1000, 250, 0.12, 0.05);
      case 'kill':
        this.noise(0.12, 0.12, 4000, 400);
        return this.tone('square', 260, 70, 0.12, 0.05);
      case 'die':
        return this.noise(0.9, 0.2, 2500, 120);
      case 'ufo':
        return this.tone('sine', 620, 820, 0.16, 0.05);
      case 'ufoHit':
        this.noise(0.25, 0.12, 5000, 500);
        return this.tone('square', 900, 120, 0.35, 0.06);
      case 'extraLife':
        [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.12, 0.05, i * 0.1));
        return;
      case 'clear':
        [392, 523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.14, 0.05, i * 0.12));
        return;
      case 'over':
        [330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.9, 0.3, 0.06, i * 0.28));
        return;
      default: {
        const notes = [65, 58, 52, 49];
        const f = notes[Number(e.slice(5))] ?? 60;
        return this.tone('square', f, f, 0.09, 0.07);
      }
    }
  }
}
