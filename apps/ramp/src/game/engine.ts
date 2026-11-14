export const W = 180;
export const H = 320;
export const BALLS = 9;
const KEY = 'ramp-save-v1';

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

// ---- lane geometry (screen coordinates of the ball's centre) ----
export const LANE_BOTTOM = 304; // resting spot
export const LANE_MIN_Y = 190; // can't be dragged past the ramp lip
export const RAMP_Y = 187; // crossing this launches the ball
/** Half-width of the lane at a given screen y. */
export const laneHalf = (y: number) => 70 - 22 * (LANE_BOTTOM - y) / 120;
/** 0 at the bottom of the lane, 1 at the ramp. */
export const laneS = (y: number) => (LANE_BOTTOM - y) / 120;

/** Flick speed (game px/s, upward) that maps to the softest and hardest throw. */
export const FLICK_MIN = 260;
export const FLICK_MAX = 1500;
/** Slower than this is a push, not a throw: the ball just rolls to a stop. */
export const FLICK_NONE = 150;
const MAX_SPEED = 2600;
const FRICTION = 160; // px/s^2 on the lane
const MIN_LAND = 0.02;

/** Landing depth on the board for a ball crossing the ramp at this upward speed (px/s). */
function depthFor(up: number) {
  const p = Math.max(0, Math.min(1, (up - FLICK_MIN) / (FLICK_MAX - FLICK_MIN)));
  return Math.max(MIN_LAND, Math.min(1.35, 0.07 + 1.2 * p));
}

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

  // ball on the lane (screen coordinates)
  px = 90;
  py = LANE_BOTTOM;
  pvx = 0;
  pvy = 0;
  dragging = false;
  private tx = 90; // where the finger is
  private ty = LANE_BOTTOM;
  // flight
  airT = 0;
  airDur = 0.4;
  fromX = 90; // screen x where the ball leaves the ramp
  toX = 0; // board x (-1..1)
  toY = 0; // board depth
  // board ball
  bx = 0;
  by = 0;
  bvx = 0;
  bvy = 0;
  settleT = 0;
  hit: Hole | null = null;
  hitT = 0;
  pops: Pop[] = [];
  note = '';
  noteT = 0;
  onEvent: (e: GameEvent) => void = () => {};

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
    this.resetBall();
    this.pops = [];
    this.hit = null;
    this.deadFor = 0;
    this.onEvent('start');
  }

  private resetBall() {
    this.px = this.tx = 90;
    this.py = this.ty = LANE_BOTTOM;
    this.pvx = this.pvy = 0;
    this.dragging = false;
  }

  private clampToLane(x: number, y: number): [number, number] {
    const cy = Math.max(LANE_MIN_Y, Math.min(LANE_BOTTOM + 4, y));
    const hw = laneHalf(cy) - 6;
    return [Math.max(90 - hw, Math.min(90 + hw, x)), cy];
  }

  /** Finger touched down: the ball glides to it and then follows it exactly. */
  grab(x: number, y: number) {
    if (this.phase !== 'aim') return;
    this.dragging = true;
    this.pvx = this.pvy = 0;
    [this.tx, this.ty] = this.clampToLane(x, y);
  }
  dragTo(x: number, y: number) {
    if (this.phase !== 'aim' || !this.dragging) return;
    [this.tx, this.ty] = this.clampToLane(x, y);
  }
  cancelDrag() {
    this.dragging = false;
  }

  /** Finger lifted with this velocity (game px/s). A fast enough upward flick throws the ball. */
  release(vx: number, vy: number) {
    if (this.phase !== 'aim' || !this.dragging) return;
    this.dragging = false;
    // the ball ends up exactly under the finger
    this.px = this.tx;
    this.py = this.ty;
    const up = -vy;
    if (up < FLICK_NONE) {
      this.pvx = this.pvy = 0;
      return; // not a flick: the ball just stays where you left it
    }
    const sp = Math.hypot(vx, vy);
    const k = sp > MAX_SPEED ? MAX_SPEED / sp : 1;
    this.pvx = vx * k;
    this.pvy = vy * k;
    this.phase = 'roll';
    this.onEvent('roll');
  }

  /** Where a ball released now with this velocity would land, or null if it would not clear the ramp. */
  predict(vx: number, vy: number): { x: number; y: number } | 'soft' | null {
    const up = -vy;
    if (up < FLICK_NONE) return null;
    const sp = Math.hypot(vx, vy);
    const k = sp > MAX_SPEED ? MAX_SPEED / sp : 1;
    let x = this.tx;
    let y = this.ty;
    let bvx = vx * k;
    let bvy = vy * k;
    const dt = 1 / 240;
    for (let i = 0; i < 2400; i++) {
      const sp2 = Math.hypot(bvx, bvy);
      if (sp2 < 1) return 'soft';
      const f = Math.max(0, sp2 - FRICTION * dt) / sp2;
      bvx *= f;
      bvy *= f;
      x += bvx * dt;
      y += bvy * dt;
      const hw = laneHalf(y) - 6;
      if (Math.abs(x - 90) > hw) {
        x = 90 + Math.sign(x - 90) * hw;
        bvx = -bvx * 0.6;
      }
      if (y <= RAMP_Y) {
        if (-bvy < FLICK_MIN * 0.75) return 'soft';
        const xl = Math.max(-0.97, Math.min(0.97, (x - 90) / laneHalf(RAMP_Y)));
        return { x: xl, y: depthFor(-bvy) };
      }
      if (bvy > 0) return 'soft';
    }
    return 'soft';
  }

  private say(text: string, secs = 1.2) {
    this.note = text;
    this.noteT = secs;
  }

  /** Advance by real elapsed time, split into small equal sub-steps so motion stays smooth. */
  update(dt: number) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.step(h);
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
      case 'aim':
        if (this.dragging) {
          // follow the finger (a very short ease so a 60 Hz finger path doesn't look steppy)
          const a = 1 - Math.exp(-dt / 0.012);
          this.px += (this.tx - this.px) * a;
          this.py += (this.ty - this.py) * a;
        }
        break;
      case 'roll':
        this.stepRoll(dt);
        break;
      case 'air':
        this.airT += dt;
        if (this.airT >= this.airDur) this.land();
        break;
      case 'board':
        this.stepBoard(dt);
        break;
      case 'settle':
        this.settleT -= dt;
        if (this.settleT <= 0) this.nextBall();
        break;
    }
  }

  private stepRoll(dt: number) {
    const sp = Math.hypot(this.pvx, this.pvy);
    if (sp < 8) {
      // came to rest on the lane: pick it up again, no ball used
      this.pvx = this.pvy = 0;
      this.phase = 'aim';
      return;
    }
    const f = Math.max(0, sp - FRICTION * dt) / sp;
    this.pvx *= f;
    this.pvy *= f;
    this.px += this.pvx * dt;
    this.py += this.pvy * dt;
    const hw = laneHalf(this.py) - 6;
    if (Math.abs(this.px - 90) > hw) {
      // bounces off the lane rail
      this.px = 90 + Math.sign(this.px - 90) * hw;
      this.pvx = -this.pvx * 0.6;
      this.pvy *= 0.94;
      this.onEvent('wall');
    }
    if (this.py > LANE_BOTTOM + 4) {
      // rolled back down toward the player
      this.py = LANE_BOTTOM + 4;
      this.pvy = 0;
    }
    if (this.py <= RAMP_Y) this.launch();
  }

  private launch() {
    const up = -this.pvy;
    this.ballsLeft--;
    if (up < FLICK_MIN * 0.75) {
      this.say('TOO SOFT!');
      this.onEvent('soft');
      this.bx = 0;
      this.by = 0;
      this.finishBall(0, null, 'soft');
      return;
    }
    this.fromX = this.px;
    const xl = Math.max(-0.97, Math.min(0.97, (this.px - 90) / laneHalf(RAMP_Y)));
    this.toX = Math.max(-0.97, Math.min(0.97, xl + (Math.random() - 0.5) * 0.05));
    this.toY = Math.min(1.35, depthFor(up) + (Math.random() - 0.5) * 0.04);
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
      this.resetBall();
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
