export const W = 180;
export const H = 320;
export const GROUND = 36; // height of the ground strip
export const BIRD_X = 52;
export const BIRD_R = 7.5;
export const PIPE_W = 28;
export const GAP = 76;
export const SPACING = 104;

const GRAVITY = 980;
const FLAP_V = -290;
const SPEED = 72;
const MAX_FALL = 420;
export const STEP = 1 / 120;
const KEY = 'hop-best';

export type Phase = 'title' | 'ready' | 'play' | 'over';
export type GameEvent = 'flap' | 'score' | 'hit' | 'start';

export interface Pipe {
  x: number; // left edge
  gapY: number; // centre of the gap
  passed: boolean;
}

export class HopGame {
  phase: Phase = 'title';
  y = H / 2 - 20;
  vy = 0;
  pipes: Pipe[] = [];
  score = 0;
  best = 0;
  newBest = false;
  scroll = 0; // ground/background scroll distance
  t = 0; // time, for idle bob and animation
  tilt = 0;
  deadFor = 0;
  flash = 0;
  onEvent: (e: GameEvent) => void = () => {};
  private acc = 0;
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    try {
      this.best = Number(localStorage.getItem(KEY)) || 0;
    } catch {
      /* ignore */
    }
  }

  private saveBest() {
    try {
      localStorage.setItem(KEY, String(this.best));
    } catch {
      /* ignore */
    }
  }

  /** Tap / click / space. Starts, flaps or restarts depending on the phase. */
  tap() {
    if (this.phase === 'title') {
      this.reset();
      this.onEvent('start');
    } else if (this.phase === 'ready') {
      this.phase = 'play';
      this.flap();
    } else if (this.phase === 'play') {
      this.flap();
    } else if (this.phase === 'over' && this.deadFor > 0.6) {
      this.reset();
      this.onEvent('start');
    }
  }

  private flap() {
    this.vy = FLAP_V;
    this.onEvent('flap');
  }

  reset() {
    this.phase = 'ready';
    this.y = H / 2 - 20;
    this.vy = 0;
    this.pipes = [];
    this.score = 0;
    this.newBest = false;
    this.tilt = 0;
    this.deadFor = 0;
    this.flash = 0;
    this.nextX = W + 40;
  }

  private nextX = W + 40;

  private spawn() {
    const margin = 28;
    const top = margin + GAP / 2;
    const bottom = H - GROUND - margin - GAP / 2;
    const last = this.pipes[this.pipes.length - 1];
    let gapY = top + this.rng() * (bottom - top);
    // Keep consecutive gaps within what a flap rhythm can reach.
    if (last) gapY = Math.max(last.gapY - 90, Math.min(last.gapY + 90, gapY));
    gapY = Math.max(top, Math.min(bottom, gapY));
    this.pipes.push({ x: this.nextX, gapY, passed: false });
    this.nextX += SPACING + PIPE_W;
  }

  update(dt: number) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(STEP);
    }
  }

  private step(dt: number) {
    this.t += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.phase === 'title' || this.phase === 'ready') {
      this.scroll += SPEED * dt;
      this.y = H / 2 - 20 + Math.sin(this.t * 5) * 5;
      return;
    }
    if (this.phase === 'over') {
      this.deadFor += dt;
      if (this.y + BIRD_R < H - GROUND) {
        this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
        this.y += this.vy * dt;
        this.tilt = Math.min(1.5, this.tilt + dt * 6);
        if (this.y + BIRD_R > H - GROUND) this.y = H - GROUND - BIRD_R;
      }
      return;
    }

    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;
    this.tilt = Math.max(-0.45, Math.min(1.3, this.vy / 320));
    this.scroll += SPEED * dt;

    for (const p of this.pipes) p.x -= SPEED * dt;
    this.nextX -= SPEED * dt;
    while (this.nextX < W + 40) this.spawn();
    while (this.pipes.length && this.pipes[0].x + PIPE_W < -4) this.pipes.shift();

    for (const p of this.pipes) {
      if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
        p.passed = true;
        this.score++;
        this.onEvent('score');
      }
    }

    if (this.collides()) this.die();
  }

  private collides(): boolean {
    if (this.y + BIRD_R >= H - GROUND) return true;
    if (this.y - BIRD_R <= -40) return true;
    for (const p of this.pipes) {
      const nx = Math.max(p.x, Math.min(BIRD_X, p.x + PIPE_W));
      if (Math.abs(nx - BIRD_X) > BIRD_R - 1) continue;
      const dy = this.y - p.gapY;
      if (Math.abs(dy) > GAP / 2 - BIRD_R + 1) return true;
    }
    return false;
  }

  private die() {
    this.phase = 'over';
    this.deadFor = 0;
    this.flash = 1;
    this.vy = Math.max(this.vy, 0);
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = this.score > 0;
      this.saveBest();
    }
    this.onEvent('hit');
  }
}
