export const W = 180;
export const H = 320;
export const BALLS = 9;
const KEY = 'ramp-save-v1';
const STEP = 1 / 120;

export type Phase = 'title' | 'aim' | 'roll' | 'air' | 'board' | 'settle' | 'over';
export type GameEvent =
  | 'roll' | 'launch' | 'land' | 'wall' | 'gutter' | 'soft' | 'over' | 'start' | 'tick'
  | 'score10' | 'score20' | 'score30' | 'score40' | 'score50' | 'score100';

export interface Hole {
  x: number; // -1..1 across the board
  y: number; // 0 (near) .. 1 (far)
  r: number;
  value: number;
}
// Hole layout, loosely like the classic arcade board: big low holes, small high-value ones far away.
export const HOLES: Hole[] = [
  { x: 0, y: 0.07, r: 0.2, value: 10 },
  { x: -0.62, y: 0.27, r: 0.15, value: 20 },
  { x: 0.62, y: 0.27, r: 0.15, value: 20 },
  { x: 0, y: 0.42, r: 0.15, value: 30 },
  { x: -0.5, y: 0.6, r: 0.13, value: 40 },
  { x: 0.5, y: 0.6, r: 0.13, value: 40 },
  { x: 0, y: 0.78, r: 0.12, value: 50 },
  { x: -0.82, y: 0.9, r: 0.095, value: 100 },
  { x: 0.82, y: 0.9, r: 0.095, value: 100 },
];

export interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const MIN_SPEED = 0.67;
/** Flick speed (game px/s, upward) that maps to the softest and hardest roll. */
export const FLICK_MIN = 260;
export const FLICK_MAX = 1500;
/** Slower than this is not a flick; the ball stays where it is. */
export const FLICK_NONE = 180;

export class SkeeGame {
  phase: Phase = 'title';
  ballsLeft = BALLS;
  score = 0;
  best = 0;
  newBest = false;
  tickets = 0; // lifetime, saved
  earned = 0; // this game
  t = 0;
  deadFor = 0;

  // aiming / lane
  laneX = 0; // -1..1
  dragging = false; // finger is on the ball
  lat = 0; // sideways drift per unit of forward travel
  s = 0; // lane progress 0..1
  v = 0; // lane speed
  // air
  airT = 0;
  airDur = 0.4;
  fromX = 0;
  toX = 0;
  toY = 0;
  // board ball
  bx = 0;
  by = 0;
  bvx = 0;
  bvy = 0;
  settleT = 0;
  hit: Hole | null = null; // last hole scored (for flash)
  hitT = 0;
  pops: Pop[] = [];
  note = '';
  noteT = 0;
  onEvent: (e: GameEvent) => void = () => {};
  private acc = 0;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as { best?: number; tickets?: number };
        this.best = s.best ?? 0;
        this.tickets = s.tickets ?? 0;
      }
    } catch {
      /* ignore */
    }
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ best: this.best, tickets: this.tickets }));
    } catch {
      /* ignore */
    }
  }

  tap() {
    if (this.phase === 'title') this.start();
    else if (this.phase === 'over' && this.deadFor > 0.8) this.start();
  }

  start() {
    this.phase = 'aim';
    this.ballsLeft = BALLS;
    this.score = 0;
    this.earned = 0;
    this.newBest = false;
    this.laneX = 0;
    this.s = 0;
    this.dragging = false;
    this.pops = [];
    this.hit = null;
    this.deadFor = 0;
    this.onEvent('start');
  }

  /** Finger is on the ball: it follows the finger (x across the lane, and a little way up). */
  grab(x: number, s0: number) {
    if (this.phase !== 'aim') return;
    this.dragging = true;
    this.drag(x, s0);
  }
  drag(x: number, s0: number) {
    if (this.phase !== 'aim' || !this.dragging) return;
    this.laneX = Math.max(-0.88, Math.min(0.88, x));
    this.s = Math.max(0, Math.min(0.3, s0));
  }
  cancelDrag() {
    this.dragging = false;
    if (this.phase === 'aim') this.s = 0;
  }

  /** Where a flick at this speed would land the ball, or null if it would not clear the ramp. */
  predict(up: number, vx: number): { x: number; y: number } | null {
    if (up < FLICK_NONE) return null;
    const p = Math.max(0, Math.min(1, (up - FLICK_MIN) / (FLICK_MAX - FLICK_MIN)));
    let v = 0.75 + p * 1.35;
    const lat = Math.max(-0.7, Math.min(0.7, vx / up)) * 2;
    let x = this.laneX;
    let s = this.s;
    for (let i = 0; i < 2400 && s < 1; i++) {
      s += v * STEP;
      v = Math.max(0.1, v - 0.1 * STEP);
      x += lat * v * STEP;
      if (Math.abs(x) > 0.95) {
        x = Math.sign(x) * 0.95;
        break; // keep the preview simple: a wall hit changes the path
      }
    }
    if (v < MIN_SPEED + 0.02) return null;
    return { x, y: Math.max(0.02, Math.min(1.35, (v - MIN_SPEED) * 0.889)) };
  }

  /** Finger lifted: up is the upward speed in game px/s, vx the sideways speed. */
  flick(up: number, vx: number) {
    if (this.phase !== 'aim' || !this.dragging) return;
    this.dragging = false;
    if (up < FLICK_NONE) {
      this.s = 0;
      this.say('FLICK IT!', 0.9);
      return;
    }
    const p = Math.max(0, Math.min(1, (up - FLICK_MIN) / (FLICK_MAX - FLICK_MIN)));
    this.v = 0.75 + p * 1.35;
    this.lat = Math.max(-0.7, Math.min(0.7, vx / up)) * 2;
    this.phase = 'roll';
    this.ballsLeft--;
    this.onEvent('roll');
  }

  private say(text: string, secs = 1.2) {
    this.note = text;
    this.noteT = secs;
  }

  update(dt: number) {
    this.t += dt;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(STEP);
    }
  }

  private step(dt: number) {
    this.noteT = Math.max(0, this.noteT - dt);
    this.hitT = Math.max(0, this.hitT - dt);
    for (const p of this.pops) {
      p.y -= 14 * dt;
      p.life -= dt;
    }
    this.pops = this.pops.filter((p) => p.life > 0);

    switch (this.phase) {
      case 'over':
        this.deadFor += dt;
        break;
      case 'roll': {
        this.s += this.v * dt;
        this.laneX += this.lat * this.v * dt;
        if (Math.abs(this.laneX) > 0.95) {
          // bounces off the lane rail and loses a little speed
          this.laneX = Math.sign(this.laneX) * 0.95;
          this.lat = -this.lat * 0.6;
          this.v *= 0.92;
          this.onEvent('wall');
        }
        this.v = Math.max(0.1, this.v - 0.1 * dt);
        if (this.s >= 1) this.launch();
        break;
      }
      case 'air': {
        this.airT += dt;
        if (this.airT >= this.airDur) this.land();
        break;
      }
      case 'board':
        this.stepBoard(dt);
        break;
      case 'settle':
        this.settleT -= dt;
        if (this.settleT <= 0) this.nextBall();
        break;
    }
  }

  private launch() {
    const va = this.v;
    if (va < MIN_SPEED + 0.02) {
      // too soft to clear the ramp: it rolls back
      this.say('TOO SOFT!');
      this.onEvent('soft');
      this.finishBall(0, null, 'soft');
      return;
    }
    let yL = (va - MIN_SPEED) * 0.889;
    yL += (Math.random() - 0.5) * 0.04;
    this.toY = Math.max(0.02, Math.min(1.35, yL));
    this.fromX = this.laneX;
    this.toX = Math.max(-0.97, Math.min(0.97, this.laneX + (Math.random() - 0.5) * 0.05));
    this.airDur = 0.3 + 0.28 * Math.min(1, this.toY);
    this.airT = 0;
    this.phase = 'air';
    this.onEvent('launch');
  }

  private land() {
    this.bx = this.toX;
    this.onEvent('land');
    if (this.toY > 1) {
      // overshoot: slams the back wall and drops back
      this.by = 0.98;
      this.bvy = -0.7;
      this.onEvent('wall');
    } else {
      this.by = this.toY;
      this.bvy = 0.45;
      // a ball that lands right in a hole drops straight in
      for (const h of HOLES) {
        if (Math.hypot(this.bx - h.x, this.by - h.y) < h.r * 1.05) {
          this.bx = h.x;
          this.by = h.y;
          this.phase = 'board';
          this.finishBall(h.value, h, 'hole');
          return;
        }
      }
    }
    this.bvx = (Math.random() - 0.5) * 0.9;
    this.phase = 'board';
  }

  private stepBoard(dt: number) {
    // the board is inclined: the ball is pulled back toward the player
    this.bvy -= 0.9 * dt;
    const damp = Math.max(0, 1 - 0.35 * dt);
    this.bvx *= damp;
    this.bvy *= damp;
    this.bx += this.bvx * dt;
    this.by += this.bvy * dt;
    if (this.bx > 0.97) {
      this.bx = 0.97;
      this.bvx = -Math.abs(this.bvx) * 0.5;
      if (Math.abs(this.bvx) > 0.1) this.onEvent('wall');
    }
    if (this.bx < -0.97) {
      this.bx = -0.97;
      this.bvx = Math.abs(this.bvx) * 0.5;
      if (Math.abs(this.bvx) > 0.1) this.onEvent('wall');
    }
    if (this.by > 0.99) {
      this.by = 0.99;
      this.bvy = -Math.abs(this.bvy) * 0.4;
    }
    const sp = Math.hypot(this.bvx, this.bvy);
    for (const h of HOLES) {
      const d = Math.hypot(this.bx - h.x, this.by - h.y);
      if (d < h.r * 0.5 || (d < h.r * 0.85 && sp < 0.3)) {
        this.bx = h.x;
        this.by = h.y;
        this.finishBall(h.value, h, 'hole');
        return;
      }
    }
    if (this.by < 0.0) {
      // rolled all the way back: the middle drops into the lowest ring, the sides are gutters
      if (Math.abs(this.bx) < 0.28) this.finishBall(10, HOLES[0], 'hole');
      else {
        this.say('GUTTER');
        this.onEvent('gutter');
        this.finishBall(0, null, 'gutter');
      }
    }
  }

  private finishBall(value: number, hole: Hole | null, why: 'hole' | 'gutter' | 'soft') {
    this.phase = 'settle';
    this.settleT = why === 'hole' ? 1.0 : 0.9;
    this.score += value;
    this.earned = Math.floor(this.score / 10);
    if (hole) {
      this.hit = hole;
      this.hitT = 1;
      this.onEvent(`score${value}` as GameEvent);
      this.pops.push({ x: hole.x, y: hole.y, text: `+${value}`, color: value >= 50 ? '#ffe08a' : '#ffffff', life: 1 });
    } else this.pops.push({ x: this.bx, y: Math.max(0.05, this.by), text: why === 'soft' ? 'MISS' : '0', color: '#ff9a8a', life: 0.9 });
  }

  private nextBall() {
    this.hit = null;
    if (this.ballsLeft > 0) {
      this.phase = 'aim';
      this.laneX = this.laneX * 0.5;
      this.s = 0;
      return;
    }
    this.phase = 'over';
    this.deadFor = 0;
    this.newBest = this.score > this.best;
    if (this.newBest) this.best = this.score;
    this.tickets += Math.floor(this.score / 10);
    this.save();
    this.onEvent('over');
  }
}
