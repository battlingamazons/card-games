import type { GameEvent } from './game/engine';

const MUTE_KEY = 'cop16-muted';
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Song { bpm: number; lead: (number | null)[]; bass: (number | null)[]; wave: OscillatorType }

// 16-step synthwave loops. MIDI notes, null is a rest.
const SONGS: Song[] = [
  { bpm: 118, wave: 'sawtooth', // downtown: A minor chase
    lead: [69, null, 72, null, 76, null, 72, null, 67, null, 71, null, 74, null, 71, null],
    bass: [33, 33, 45, 33, 33, 33, 45, 33, 31, 31, 43, 31, 31, 31, 43, 31] },
  { bpm: 126, wave: 'square', // docks: D minor
    lead: [62, 65, 69, 65, 62, 65, 69, 74, 60, 64, 67, 64, 60, 64, 67, 72],
    bass: [38, null, 38, 50, 38, null, 38, 50, 36, null, 36, 48, 36, null, 36, 48] },
  { bpm: 134, wave: 'sawtooth', // disco: F# minor boogie
    lead: [66, null, 69, 66, 73, null, 69, null, 64, null, 68, 64, 71, null, 68, null],
    bass: [30, 42, 30, 42, 30, 42, 30, 42, 28, 40, 28, 40, 28, 40, 28, 40] },
];

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted: boolean;
  private song = -1;
  private fast = false;
  private step = 0;
  private nextT = 0;
  private timer: number | null = null;

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
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq = 1200) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }


  play(e: GameEvent) {
    if (this.muted || !this.ctx) return;
    switch (e) {
      case 'shot': this.noise(0.12, 0.35, 1400); return this.tone('square', 520, 90, 0.1, 0.08);
      case 'click': return this.tone('square', 1200, 1000, 0.03, 0.05);
      case 'reload': this.tone('square', 600, 500, 0.04, 0.05); this.tone('square', 900, 800, 0.05, 0.05, 0.3); return this.tone('square', 500, 400, 0.05, 0.05, 0.55);
      case 'hit': this.noise(0.1, 0.25, 500); return this.tone('square', 330, 140, 0.1, 0.07);
      case 'head': this.noise(0.1, 0.25, 800); this.tone('square', 1175, 1175, 0.06, 0.06); return this.tone('square', 1568, 1568, 0.1, 0.06, 0.06);
      case 'bossHit': return this.tone('sawtooth', 200, 120, 0.12, 0.08);
      case 'hurt': this.noise(0.3, 0.4, 300); return this.tone('sawtooth', 180, 45, 0.3, 0.12);
      case 'oops': [392, 370, 349, 330].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, 0.22, 0.07, i * 0.2)); return;
      case 'donut': [660, 880, 1320, 1760].forEach((f, i) => this.tone('square', f, f, 0.08, 0.05, i * 0.06)); return;
      case 'warn': return this.tone('square', 1500, 1500, 0.06, 0.04);
      case 'bossIn': [196, 196, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f, 0.18, 0.08, i * 0.2)); return;
      case 'clear': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.14, 0.06, i * 0.1)); return;
      case 'over': [330, 262, 196, 147].forEach((f, i) => this.tone('sawtooth', f, f * 0.9, 0.3, 0.07, i * 0.25)); return;
      case 'start': return this.tone('sine', 440, 660, 0.12, 0.08);
    }
  }

  /** Start (or switch) the background music. Pass -1 to stop. */
  music(song: number, fast = false) {
    if (song === this.song && fast === this.fast) return;
    this.song = song;
    this.fast = fast;
    this.step = 0;
    if (this.ctx) this.nextT = this.ctx.currentTime + 0.05;
    if (this.timer === null) this.timer = window.setInterval(() => this.pump(), 60);
  }

  private pump() {
    const c = this.ctx;
    if (!c || this.song < 0 || this.muted || c.state !== 'running') {
      if (c) this.nextT = Math.max(this.nextT, c.currentTime);
      return;
    }
    const s = SONGS[this.song];
    const stepDur = 60 / (s.bpm * (this.fast ? 1.12 : 1)) / 2;
    while (this.nextT < c.currentTime + 0.25) {
      const i = this.step % 16;
      const l = s.lead[i];
      const b = s.bass[i];
      const d = this.nextT - c.currentTime;
      if (l !== null) this.tone(s.wave, mtof(l), mtof(l), stepDur * 0.9, 0.024, d);
      if (b !== null) this.tone('triangle', mtof(b), mtof(b), stepDur * 0.9, 0.06, d);
      this.nextT += stepDur;
      this.step++;
    }
  }
}
