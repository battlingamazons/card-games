const MUTE_KEY = 'craps-muted';

export type Sfx = 'chip' | 'rattle' | 'land' | 'point' | 'win' | 'lose' | 'sevenOut';

/** Tiny WebAudio synth. Created lazily on the first tap (iOS needs a gesture). */
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

  private click(delay: number, vol: number) {
    const c = this.ctx;
    if (!c) return;
    const n = Math.floor(c.sampleRate * 0.03);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200 + Math.random() * 1800;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start(c.currentTime + delay);
  }

  play(e: Sfx) {
    if (this.muted || !this.ctx) return;
    switch (e) {
      case 'chip':
        return this.tone('triangle', 900, 500, 0.06, 0.1);
      case 'rattle':
        for (let i = 0; i < 14; i++) this.click(i * 0.07, 0.35);
        return;
      case 'land':
        this.click(0, 0.6);
        return this.click(0.09, 0.45);
      case 'point':
        return this.tone('sine', 520, 780, 0.15, 0.1);
      case 'win':
        [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.12, 0.05, i * 0.09));
        return;
      case 'lose':
        return this.tone('sawtooth', 260, 140, 0.3, 0.05);
      case 'sevenOut':
        [330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.9, 0.25, 0.06, i * 0.2));
        return;
    }
  }
}
