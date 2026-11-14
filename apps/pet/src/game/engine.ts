export const W = 180;
export const H = 320;
const KEY = 'pet-save-v1';
const HOUR = 3600;
const MAX_OFFLINE = 24 * HOUR;

export type Phase = 'egg' | 'live';
export type Action = 'idle' | 'eat' | 'play' | 'hatch';
export type GameEvent = 'eat' | 'play' | 'bounce' | 'pet' | 'sleep' | 'wake' | 'no' | 'hatch' | 'tap' | 'sad';
export type Mood = 'sleeping' | 'hungry' | 'sad' | 'tired' | 'happy' | 'content';

export interface Floaty {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  glyph: string;
}

interface Save {
  v: 1;
  phase: Phase;
  eggTaps: number;
  name: string;
  hue: number;
  born: number;
  fullness: number;
  happy: number;
  energy: number;
  asleep: boolean;
  last: number;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export class PetGame {
  phase: Phase = 'egg';
  eggTaps = 0;
  name = 'Pip';
  hue = 160;
  born = Date.now();
  fullness = 80;
  happy = 80;
  energy = 90;
  asleep = false;
  action: Action = 'idle';
  actT = 0;
  t = 0;
  petX = W / 2;
  wanderTo = W / 2;
  floaties: Floaty[] = [];
  note = ''; // short speech bubble text
  noteT = 0;
  wobble = 0;
  jump = 0; // pet's hop height this frame
  onEvent: (e: GameEvent) => void = () => {};
  welcome = ''; // message shown after being away
  private ballBounce = 0;
  private saveT = 0;
  private wanderT = 2;
  private sadSent = false;

  constructor() {
    this.load();
  }

  get ageDays() {
    return Math.floor((Date.now() - this.born) / 86400000);
  }
  get mood(): Mood {
    if (this.asleep) return 'sleeping';
    if (this.fullness < 25) return 'hungry';
    if (this.happy < 30) return 'sad';
    if (this.energy < 20) return 'tired';
    if (this.happy > 70 && this.fullness > 40) return 'happy';
    return 'content';
  }

  // ---- persistence ----

  private load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Save;
      if (s.v !== 1) return;
      this.phase = s.phase;
      this.eggTaps = s.eggTaps;
      this.name = s.name;
      this.hue = s.hue;
      this.born = s.born;
      this.fullness = s.fullness;
      this.happy = s.happy;
      this.energy = s.energy;
      this.asleep = s.asleep;
      this.catchUp(s.last);
    } catch {
      /* ignore */
    }
  }

  save() {
    const s: Save = {
      v: 1,
      phase: this.phase,
      eggTaps: this.eggTaps,
      name: this.name,
      hue: this.hue,
      born: this.born,
      fullness: this.fullness,
      happy: this.happy,
      energy: this.energy,
      asleep: this.asleep,
      last: Date.now(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  /** Apply the time that passed while the app was closed. */
  catchUp(last: number) {
    const secs = Math.max(0, Math.min((Date.now() - last) / 1000, MAX_OFFLINE));
    if (this.phase !== 'live' || secs < 1) return;
    const f0 = this.fullness;
    const h0 = this.happy;
    const wasAsleep = this.asleep;
    this.advance(secs);
    if (secs > 600) {
      const mins = Math.round(secs / 60);
      const away = mins >= 120 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`;
      const bits: string[] = [];
      if (wasAsleep && !this.asleep) bits.push('woke up rested');
      if (this.fullness < f0 - 15) bits.push('got hungry');
      if (this.happy < h0 - 15) bits.push('missed you');
      this.welcome = `You were away ${away}. ${this.name} ${bits.length ? bits.join(' and ') : 'kept busy'}.`;
    }
  }

  /** Advance the simulation by `secs` of real time, in coarse steps. */
  advance(secs: number) {
    let left = secs;
    while (left > 0) {
      const d = Math.min(left, 60);
      this.decay(d);
      left -= d;
    }
  }

  private decay(d: number) {
    if (this.phase !== 'live') return;
    const h = d / HOUR;
    if (this.asleep) {
      this.fullness = clamp(this.fullness - 3 * h);
      this.energy = clamp(this.energy + 28 * h);
      this.happy = clamp(this.happy - (this.fullness < 20 ? 4 : 1) * h);
      if (this.energy >= 100) {
        this.asleep = false;
        this.happy = clamp(this.happy + 4);
      }
    } else {
      this.fullness = clamp(this.fullness - 10 * h);
      this.energy = clamp(this.energy - 6 * h);
      this.happy = clamp(this.happy - (5 + (this.fullness < 25 ? 8 : 0) + (this.energy < 20 ? 4 : 0)) * h);
    }
  }

  // ---- actions ----

  private say(t: string, secs = 2) {
    this.note = t;
    this.noteT = secs;
  }

  private busy() {
    return this.action !== 'idle';
  }

  private hearts(n: number, glyph = '♥') {
    for (let i = 0; i < n; i++) this.floaties.push({ x: this.petX + (Math.random() - 0.5) * 40, y: 190 - Math.random() * 10, vx: (Math.random() - 0.5) * 12, vy: -22 - Math.random() * 14, life: 1.2 + Math.random() * 0.4, glyph });
  }

  tapEgg() {
    if (this.phase !== 'egg' || this.action === 'hatch') return;
    this.eggTaps++;
    this.wobble = 1;
    this.onEvent('tap');
    if (this.eggTaps >= 3) {
      this.action = 'hatch';
      this.actT = 0;
      this.hue = [160, 20, 270, 200, 335, 90][Math.floor(Math.random() * 6)];
      this.onEvent('hatch');
    }
    this.save();
  }

  feed() {
    if (this.phase !== 'live' || this.busy()) return;
    if (this.asleep) return this.say('zzz...', 1.5);
    if (this.fullness > 92) {
      this.say('I am full!');
      this.happy = clamp(this.happy - 2);
      return this.onEvent('no');
    }
    this.action = 'eat';
    this.actT = 0;
    this.fullness = clamp(this.fullness + 26);
    this.happy = clamp(this.happy + 3);
    this.onEvent('eat');
    this.save();
  }

  play() {
    if (this.phase !== 'live' || this.busy()) return;
    if (this.asleep) return this.say('zzz...', 1.5);
    if (this.energy < 15) {
      this.say('too sleepy...');
      return this.onEvent('no');
    }
    if (this.fullness < 15) {
      this.say('too hungry...');
      return this.onEvent('no');
    }
    this.action = 'play';
    this.actT = 0;
    this.ballBounce = 0;
    this.happy = clamp(this.happy + 22);
    this.energy = clamp(this.energy - 12);
    this.fullness = clamp(this.fullness - 6);
    this.onEvent('play');
    this.save();
  }

  toggleSleep() {
    if (this.phase !== 'live' || this.busy()) return;
    this.asleep = !this.asleep;
    this.onEvent(this.asleep ? 'sleep' : 'wake');
    if (!this.asleep) this.say('good morning!');
    this.save();
  }

  pet() {
    if (this.phase !== 'live' || this.action === 'hatch') return;
    if (this.asleep) return this.say('zzz...', 1.2);
    this.happy = clamp(this.happy + 2);
    this.wobble = 1;
    this.hearts(2);
    this.onEvent('pet');
  }

  rename(n: string) {
    const t = n.trim().slice(0, 12);
    if (t) {
      this.name = t;
      this.save();
    }
  }

  newEgg() {
    this.phase = 'egg';
    this.eggTaps = 0;
    this.action = 'idle';
    this.asleep = false;
    this.fullness = 80;
    this.happy = 80;
    this.energy = 90;
    this.name = 'Pip';
    this.born = Date.now();
    this.save();
  }

  // ---- frame update ----

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.wobble = Math.max(0, this.wobble - dt * 3);
    this.noteT = Math.max(0, this.noteT - dt);
    for (const f of this.floaties) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
    }
    this.floaties = this.floaties.filter((f) => f.life > 0);
    this.jump = 0;

    if (this.action === 'hatch') {
      this.actT += dt;
      if (this.actT > 1.6) {
        this.phase = 'live';
        this.action = 'idle';
        this.born = Date.now();
        this.fullness = 80;
        this.happy = 90;
        this.energy = 90;
        this.hearts(6);
        this.say(`Hi! I'm ${this.name}!`, 3);
        this.save();
      }
      return;
    }
    if (this.phase !== 'live') return;

    this.decay(dt);
    this.saveT += dt;
    if (this.saveT > 2) {
      this.saveT = 0;
      this.save();
    }

    if (this.action === 'eat') {
      this.actT += dt;
      if (this.actT > 1.7) {
        this.action = 'idle';
        this.hearts(3);
        this.say('yum!');
      }
    } else if (this.action === 'play') {
      this.actT += dt;
      const cycle = 0.6;
      const k = Math.floor(this.actT / cycle);
      if (k > this.ballBounce) {
        this.ballBounce = k;
        this.onEvent('bounce');
      }
      const ph = (this.actT % cycle) / cycle;
      this.jump = Math.abs(Math.sin(ph * Math.PI)) * 22;
      if (this.actT > 3.0) {
        this.action = 'idle';
        this.hearts(5);
        this.say('that was fun!');
      }
    } else if (!this.asleep) {
      // wander about the room
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 4;
        this.wanderTo = 40 + Math.random() * 100;
      }
      const d = this.wanderTo - this.petX;
      this.petX += Math.sign(d) * Math.min(Math.abs(d), 14 * dt);
      const m = this.mood;
      if (m === 'sad' || m === 'hungry') {
        if (!this.sadSent && this.noteT <= 0) {
          this.sadSent = true;
          this.say(m === 'hungry' ? "I'm hungry..." : 'play with me?', 3);
          this.onEvent('sad');
        }
      } else this.sadSent = false;
    } else {
      this.petX += (W / 2 - this.petX) * Math.min(1, dt * 2);
    }
  }
}
