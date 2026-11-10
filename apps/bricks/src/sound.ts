import type { GameEvent } from './game/engine';

const MUTE_KEY = 'bricks-muted';

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

  private last = 0;

  play(e: GameEvent) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if ((e === "wall" || e === "paddle" || e === "brick" || e === "smash") && now - this.last < 0.03) return;
    if (e === "wall" || e === "paddle" || e === "brick" || e === "smash") this.last = now;
    switch (e) {
      case "paddle":
        return this.tone("triangle", 420, 300, 0.08, 0.12);
      case "wall":
        return this.tone("sine", 260, 200, 0.05, 0.07);
      case "brick":
        return this.tone("square", 700, 560, 0.06, 0.05);
      case "smash":
        this.tone("square", 900, 1300, 0.08, 0.05);
        return;
      case "power":
        [523, 659, 880].forEach((f, i) => this.tone("triangle", f, f, 0.09, 0.09, i * 0.06));
        return;
      case "lose":
        return this.tone("sawtooth", 260, 70, 0.4, 0.08);
      case "clear":
        [523, 659, 784, 1047].forEach((f, i) => this.tone("square", f, f, 0.14, 0.05, i * 0.1));
        return;
      case "over":
        [330, 262, 196].forEach((f, i) => this.tone("sawtooth", f, f * 0.9, 0.3, 0.06, i * 0.25));
        return;
      case "launch":
      case "start":
        return this.tone("sine", 440, 660, 0.1, 0.08);
    }
  }
}
