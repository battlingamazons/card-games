import type { GameEvent } from './game/engine';

const MUTE_KEY = 'ramp-muted';

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

  private noise(dur: number, vol: number, freq = 1200) {
    const c = this.ctx;
    if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination);
    s.start();
  }

  play(e: GameEvent) {
    if (this.muted || !this.ctx) return;
    switch (e) {
      case 'roll':
        return this.noise(0.5, 0.18, 220);
      case 'launch':
        this.noise(0.25, 0.2, 1500);
        return this.tone('sine', 200, 600, 0.25, 0.05);
      case 'land':
        this.noise(0.1, 0.25, 500);
        return this.tone('sine', 180, 90, 0.1, 0.1);
      case 'wall':
        return this.noise(0.06, 0.15, 900);
      case 'score10':
        return this.tone('square', 440, 440, 0.12, 0.05);
      case 'score20':
        this.tone('square', 523, 523, 0.1, 0.05);
        this.tone('square', 659, 659, 0.12, 0.05, 0.08);
        return;
      case 'score30':
        [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.1, 0.05, i * 0.08));
        return;
      case 'score40':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.1, 0.05, i * 0.07));
        return;
      case 'score50':
        [659, 784, 988, 1319].forEach((f, i) => this.tone('square', f, f, 0.12, 0.06, i * 0.07));
        return;
      case 'score100':
        [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone('square', f, f, 0.14, 0.06, i * 0.07));
        return;
      case 'gutter':
        return this.tone('sawtooth', 220, 80, 0.3, 0.07);
      case 'soft':
        return this.tone('sine', 300, 150, 0.25, 0.07);
      case 'over':
        [523, 392, 330, 262].forEach((f, i) => this.tone('square', f, f, 0.2, 0.05, i * 0.16));
        return;
      case 'start':
        return this.tone('sine', 440, 660, 0.12, 0.08);
      case 'tick':
        return this.tone('square', 900, 900, 0.02, 0.02);
    }
  }
}
