export const W = 180;
export const H = 320;
export const GROUND = 30;
export const BASKET_Y = H - GROUND - 34; // top rim of the basket
export const BASKET_W = 40;
export const STEP = 1 / 120;
const KEY = 'catch-best';

export type Phase = 'title' | 'play' | 'over';
export type GameEvent = 'catch' | 'golden' | 'combo' | 'miss' | 'hurt' | 'life' | 'over' | 'start';
export type Kind = 'apple' | 'pear' | 'orange' | 'cherry' | 'golden' | 'rock' | 'heart';

export interface Item {
  kind: Kind;
  x: number;
  y: number;
  vy: number;
  rot: number;
  vr: number;
}
export interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}
export interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export const RADIUS: Record<Kind, number> = { apple: 8, pear: 8, orange: 8, cherry: 6, golden: 8, rock: 8, heart: 7 };
const FRUITS: Kind[] = ['apple', 'pear', 'orange', 'cherry'];

export class CatchGame {
  phase: Phase = 'title';
  x = W / 2; // basket centre
  target = W / 2;
  vx = 0;
  items: Item[] = [];
  pops: Pop[] = [];
  bits: Bit[] = [];
  lives = 3;
  score = 0;
  streak = 0;
  caught = 0;
  best = 0;
  newBest = false;
  t = 0;
  playT = 0;
  deadFor = 0;
  hurtT = 0;
  bump = 0; // basket squash when catching
  onEvent: (e: GameEvent) => void = () => {};
  private acc = 0;
  private spawnT = 0;

  constructor() {
    try {
      this.best = Number(localStorage.getItem(KEY)) || 0;
    } catch {
      /* ignore */
    }
  }

  get mult() {
    return this.streak >= 20 ? 4 : this.streak >= 10 ? 3 : this.streak >= 5 ? 2 : 1;
  }

  tap() {
    if (this.phase === 'title' || (this.phase === 'over' && this.deadFor > 0.7)) this.start();
  }

  start() {
    this.phase = 'play';
    this.items = [];
    this.pops = [];
    this.bits = [];
    this.lives = 3;
    this.score = 0;
    this.streak = 0;
    this.caught = 0;
    this.newBest = false;
    this.playT = 0;
    this.deadFor = 0;
    this.hurtT = 0;
    this.spawnT = 0.5;
    this.x = this.target = W / 2;
    this.onEvent('start');
  }

  update(dt: number) {
    this.t += dt;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(STEP);
    }
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 25 + Math.random() * 55;
      this.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 25, life: 0.35 + Math.random() * 0.25, color });
    }
  }

  private step(dt: number) {
    for (const b of this.bits) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 300 * dt;
      b.life -= dt;
    }
    this.bits = this.bits.filter((b) => b.life > 0);
    for (const p of this.pops) {
      p.y -= 22 * dt;
      p.life -= dt;
    }
    this.pops = this.pops.filter((p) => p.life > 0);
    this.bump = Math.max(0, this.bump - dt * 6);
    this.hurtT = Math.max(0, this.hurtT - dt);

    // basket follows the target with a speed cap (keeps it from teleporting)
    const half = BASKET_W / 2;
    const tx = Math.max(half, Math.min(W - half, this.target));
    const d = tx - this.x;
    const max = 900 * dt;
    const mv = Math.max(-max, Math.min(max, d));
    this.x += mv;
    this.vx = mv / dt;

    if (this.phase === 'title') {
      for (const it of this.items) this.fall(it, dt);
      return;
    }
    if (this.phase === 'over') {
      this.deadFor += dt;
      for (const it of this.items) this.fall(it, dt);
      this.items = this.items.filter((i) => i.y < H);
      return;
    }

    this.playT += dt;
    const prog = Math.min(1, this.playT / 120);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.95 - prog * 0.6 + Math.random() * 0.25;
      this.spawn(prog);
    }

    for (const it of this.items) {
      const prevBottom = it.y + RADIUS[it.kind];
      this.fall(it, dt);
      const bottom = it.y + RADIUS[it.kind];
      const inMouth = Math.abs(it.x - this.x) < half - 1;
      if (prevBottom <= BASKET_Y + 6 && bottom >= BASKET_Y && inMouth) {
        this.collect(it);
        it.y = H + 99;
      } else if (bottom >= H - GROUND) {
        this.land(it);
        it.y = H + 99;
      }
    }
    this.items = this.items.filter((i) => i.y < H + 50);
  }

  private fall(it: Item, dt: number) {
    it.y += it.vy * dt;
    it.rot += it.vr * dt;
  }

  private spawn(prog: number) {
    const r = Math.random();
    let kind: Kind;
    if (r < 0.04 + prog * 0.04 && this.lives < 5 && this.playT > 20) kind = 'heart';
    else if (r < 0.1 + prog * 0.02) kind = 'golden';
    else if (r < 0.24 + prog * 0.2 && this.playT > 6) kind = 'rock';
    else kind = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const vy = (62 + prog * 90) * (0.85 + Math.random() * 0.4) * (kind === 'golden' ? 1.25 : 1);
    this.items.push({ kind, x: 14 + Math.random() * (W - 28), y: -12, vy, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 4 });
  }

  private collect(it: Item) {
    this.bump = 1;
    if (it.kind === 'rock') {
      this.hurt();
      this.burst(it.x, BASKET_Y, '#8a8498', 8);
      return;
    }
    if (it.kind === 'heart') {
      this.lives = Math.min(5, this.lives + 1);
      this.pops.push({ x: it.x, y: BASKET_Y - 8, text: '+1 ♥', color: '#ff7a9a', life: 0.8 });
      this.onEvent('life');
      return;
    }
    const before = this.mult;
    this.streak++;
    this.caught++;
    const base = it.kind === 'golden' ? 5 : it.kind === 'cherry' ? 2 : 1;
    const pts = base * this.mult;
    this.score += pts;
    this.pops.push({ x: it.x, y: BASKET_Y - 8, text: `+${pts}`, color: it.kind === 'golden' ? '#ffe08a' : '#fff', life: 0.7 });
    this.burst(it.x, BASKET_Y, it.kind === 'golden' ? '#ffd34a' : '#ffffff', 4);
    if (this.mult > before) {
      this.pops.push({ x: W / 2, y: 110, text: `x${this.mult} COMBO!`, color: '#7fe0c4', life: 1 });
      this.onEvent('combo');
    } else this.onEvent(it.kind === 'golden' ? 'golden' : 'catch');
  }

  private land(it: Item) {
    const colors: Record<Kind, string> = { apple: '#e0453b', pear: '#9ac83a', orange: '#ff9a2a', cherry: '#c0204a', golden: '#ffd34a', rock: '#8a8498', heart: '#ff7a9a' };
    this.burst(it.x, H - GROUND, colors[it.kind], 6);
    if (it.kind === 'rock' || it.kind === 'golden' || it.kind === 'heart') return; // free passes
    this.streak = 0;
    this.pops.push({ x: it.x, y: H - GROUND - 10, text: 'miss', color: '#ff9a8a', life: 0.7 });
    this.onEvent('miss');
    this.loseLife();
  }

  private hurt() {
    this.streak = 0;
    this.hurtT = 0.5;
    this.onEvent('hurt');
    this.loseLife();
  }

  private loseLife() {
    this.lives--;
    if (this.lives > 0) return;
    this.phase = 'over';
    this.deadFor = 0;
    this.newBest = this.score > this.best;
    if (this.newBest) {
      this.best = this.score;
      try {
        localStorage.setItem(KEY, String(this.best));
      } catch {
        /* ignore */
      }
    }
    this.onEvent('over');
  }
}
