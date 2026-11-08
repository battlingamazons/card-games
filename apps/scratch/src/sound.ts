const MUTE_KEY = 'scratch-muted';

export type Sfx = 'scratch' | 'reveal' | 'buy' | 'win' | 'bigwin' | 'lose';

/** Tiny WebAudio synth. Created lazily on the first tap (iOS needs a gesture). */
export class Sound {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastScratch = 0;
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

  /** A short rasp of high-passed noise, like a coin on the coating. Throttled so a drag stays a steady scratch. */
  private rasp(vol: number) {
    const c = this.ctx;
    if (!c) return;
    if (!this.noiseBuf) {
      const n = Math.floor(c.sampleRate * 0.08);
      this.noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2500 + Math.random() * 1500;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  play(e: Sfx) {
    if (this.muted || !this.ctx) return;
    switch (e) {
      case 'scratch': {
        const now = this.ctx.currentTime;
        if (now - this.lastScratch < 0.055) return;
        this.lastScratch = now;
        return this.rasp(0.09);
      }
      case 'reveal':
        return this.tone('sine', 700, 1100, 0.1, 0.07);
      case 'buy':
        return this.tone('triangle', 400, 600, 0.1, 0.1);
      case 'win':
        [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.12, 0.05, i * 0.09));
        return;
      case 'bigwin':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone('square', f, f, 0.16, 0.05, i * 0.1));
        return;
      case 'lose':
        return this.tone('sawtooth', 260, 140, 0.3, 0.05);
    }
  }
}
