import type { GameEvent } from './game/engine';

const MUTE_KEY = 'hop-muted';

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
      case "flap":
        return this.tone("square", 340, 640, 0.09, 0.05);
      case "score":
        this.tone("square", 880, 880, 0.07, 0.05);
        this.tone("square", 1320, 1320, 0.1, 0.05, 0.07);
        return;
      case "hit":
        this.tone("sawtooth", 200, 50, 0.3, 0.09);
        return;
      case "start":
        return this.tone("sine", 440, 660, 0.12, 0.08);
    }
  }
}
