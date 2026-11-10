export const W = 180;
export const H = 320;
export const CEIL = 24; // top of the play area (HUD sits above)
export const PADDLE_Y = 292;
export const PADDLE_H = 6;
export const BALL_R = 3.2;
export const COLS = 9;
export const BRICK_W = W / COLS;
export const BRICK_H = 9;
export const BRICK_TOP = 44;
const PADDLE_W = 34;
const PADDLE_W_WIDE = 54;
export const STEP = 1 / 240;
const KEY = 'bricks-best';

export type Phase = 'title' | 'serve' | 'play' | 'clear' | 'over';
export type GameEvent = 'paddle' | 'wall' | 'brick' | 'smash' | 'power' | 'lose' | 'clear' | 'over' | 'launch' | 'start';
export type PowerKind = 'wide' | 'slow' | 'multi' | 'life';

export interface Ball { x: number; y: number; vx: number; vy: number }
export interface Brick { x: number; y: number; hp: number; maxHp: number; row: number }
export interface Drop { x: number; y: number; kind: PowerKind }
export interface Burst { x: number; y: number; row: number; t: number }

export const POWER_KINDS: PowerKind[] = ['wide', 'slow', 'multi', 'life'];

export class BrickGame {
  phase: Phase = 'title';
  paddleX = W / 2;
  balls: Ball[] = [];
  stuck = true; // single ball resting on the paddle
  bricks: Brick[] = [];
  drops: Drop[] = [];
  bursts: Burst[] = [];
  lives = 3;
  score = 0;
  level = 1;
  best = 0;
  newBest = false;
  wideT = 0;
  slowT = 0;
  phaseT = 0;
  t = 0;
  shake = 0;
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

  get paddleW() {
    return this.wideT > 0 ? PADDLE_W_WIDE : PADDLE_W;
  }

  private saveBest() {
    try {
      localStorage.setItem(KEY, String(this.best));
    } catch {
      /* ignore */
    }
  }

  newGame() {
    this.lives = 3;
    this.score = 0;
    this.level = 1;
    this.newBest = false;
    this.buildLevel();
    this.serve();
  }

  /** Lay out the bricks for the current level. */
  buildLevel() {
    const lvl = this.level;
    const rows = Math.min(8, 4 + Math.floor((lvl + 1) / 2));
    const pattern = (lvl - 1) % 4;
    this.bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        let keep = true;
        if (pattern === 1) keep = (r + c) % 2 === 0; // checkerboard
        else if (pattern === 2) keep = c >= r % 5 && c < COLS - (r % 5); // inverted steps
        else if (pattern === 3) keep = c % 3 !== 1; // gaps for columns
        if (!keep) continue;
        let hp = 1;
        if (lvl >= 2 && r < 2) hp = 2;
        if (lvl >= 4 && r < 1) hp = 3;
        if (lvl >= 6 && r < 3) hp = Math.max(hp, 2);
        this.bricks.push({ x: c * BRICK_W, y: BRICK_TOP + r * BRICK_H, hp, maxHp: hp, row: r });
      }
    }
  }

  private serve() {
    this.phase = 'serve';
    this.phaseT = 0;
    this.drops = [];
    this.wideT = 0;
    this.slowT = 0;
    this.stuck = true;
    this.balls = [{ x: this.paddleX, y: PADDLE_Y - BALL_R - 0.5, vx: 0, vy: 0 }];
  }

  baseSpeed() {
    return Math.min(300, 170 + (this.level - 1) * 12);
  }

  /** Current ball speed target, slowed by the slow power-up. */
  speed() {
    return this.baseSpeed() * (this.slowT > 0 ? 0.68 : 1);
  }

  /** Move the paddle by a relative amount (dragging). */
  move(dx: number) {
    this.setPaddle(this.paddleX + dx);
  }

  setPaddle(x: number) {
    const half = this.paddleW / 2;
    this.paddleX = Math.max(half, Math.min(W - half, x));
  }

  /** Any tap: start, launch or continue. */
  tap() {
    if (this.phase === 'title') {
      this.newGame();
      this.onEvent('start');
    } else if (this.phase === 'serve') {
      this.launch();
    } else if (this.phase === 'clear' && this.phaseT > 0.7) {
      this.level++;
      this.buildLevel();
      this.serve();
    } else if (this.phase === 'over' && this.phaseT > 0.7) {
      this.newGame();
      this.onEvent('start');
    }
  }

  private launch() {
    if (!this.stuck) return;
    const b = this.balls[0];
    const a = (this.rng() - 0.5) * 0.5;
    const s = this.speed();
    b.vx = Math.sin(a) * s;
    b.vy = -Math.cos(a) * s;
    this.stuck = false;
    this.phase = 'play';
    this.onEvent('launch');
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
    this.phaseT += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 4);
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter((b) => b.t < 0.4);
    if (this.wideT > 0) {
      this.wideT = Math.max(0, this.wideT - dt);
      if (this.wideT === 0) this.setPaddle(this.paddleX);
    }
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);

    if (this.phase === 'title' || this.phase === 'over' || this.phase === 'clear') return;

    if (this.stuck) {
      const b = this.balls[0];
      b.x = this.paddleX;
      b.y = PADDLE_Y - BALL_R - 0.5;
      return;
    }

    for (const ball of this.balls) this.stepBall(ball, dt);
    this.balls = this.balls.filter((b) => b.y - BALL_R < H);

    // power-ups
    const half = this.paddleW / 2;
    for (const d of this.drops) d.y += 70 * dt;
    this.drops = this.drops.filter((d) => {
      if (d.y > PADDLE_Y - 4 && d.y < PADDLE_Y + PADDLE_H + 6 && Math.abs(d.x - this.paddleX) < half + 6) {
        this.collect(d.kind);
        return false;
      }
      return d.y < H + 10;
    });

    if (this.balls.length === 0) {
      this.lives--;
      this.shake = 1;
      this.onEvent('lose');
      if (this.lives <= 0) this.gameOver();
      else this.serve();
      return;
    }
    if (this.bricks.length === 0) {
      this.score += 100 * this.level;
      this.phase = 'clear';
      this.phaseT = 0;
      this.drops = [];
      this.onEvent('clear');
      this.checkBest();
    }
  }

  private stepBall(b: Ball, dt: number) {
    // keep the speed steady (it changes with level and the slow power-up)
    const target = this.speed();
    const sp = Math.hypot(b.vx, b.vy) || 1;
    if (Math.abs(sp - target) > 0.5) {
      const k = target / sp;
      b.vx *= k;
      b.vy *= k;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); this.onEvent('wall'); }
    else if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); this.onEvent('wall'); }
    if (b.y < CEIL + BALL_R) { b.y = CEIL + BALL_R; b.vy = Math.abs(b.vy); this.onEvent('wall'); }

    // paddle
    const half = this.paddleW / 2;
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + PADDLE_H + 3 && Math.abs(b.x - this.paddleX) <= half + BALL_R) {
      const rel = Math.max(-1, Math.min(1, (b.x - this.paddleX) / half));
      const a = rel * 1.05; // up to ~60 degrees
      const s = this.speed();
      b.vx = Math.sin(a) * s;
      b.vy = -Math.cos(a) * s;
      b.y = PADDLE_Y - BALL_R;
      this.onEvent('paddle');
    }

    // bricks (one hit per step is plenty at this step size)
    for (let i = 0; i < this.bricks.length; i++) {
      const br = this.bricks[i];
      const cx = Math.max(br.x, Math.min(b.x, br.x + BRICK_W));
      const cy = Math.max(br.y, Math.min(b.y, br.y + BRICK_H));
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy >= BALL_R * BALL_R) continue;
      if (dx === 0 && dy === 0) {
        b.vy = -b.vy; // centre inside the brick: just bounce vertically
      } else if (Math.abs(dx) > Math.abs(dy)) {
        b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
        b.x = cx + Math.sign(dx) * BALL_R;
      } else {
        b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
        b.y = cy + Math.sign(dy) * BALL_R;
      }
      this.hitBrick(i);
      break;
    }

    // never let the ball go nearly flat
    const s = Math.hypot(b.vx, b.vy) || 1;
    const minVy = s * 0.28;
    if (Math.abs(b.vy) < minVy) {
      b.vy = (b.vy < 0 ? -1 : 1) * minVy;
      const vx = Math.sqrt(Math.max(0, s * s - b.vy * b.vy));
      b.vx = (b.vx < 0 ? -1 : 1) * vx;
    }
  }

  private hitBrick(i: number) {
    const br = this.bricks[i];
    br.hp--;
    this.score += 10;
    if (br.hp > 0) {
      this.onEvent('brick');
      return;
    }
    this.score += 10 * br.maxHp;
    this.bricks.splice(i, 1);
    this.bursts.push({ x: br.x + BRICK_W / 2, y: br.y + BRICK_H / 2, row: br.row, t: 0 });
    this.onEvent('smash');
    if (this.rng() < 0.14) {
      const kind = POWER_KINDS[Math.floor(this.rng() * POWER_KINDS.length)];
      this.drops.push({ x: br.x + BRICK_W / 2, y: br.y + BRICK_H, kind });
    }
  }

  private collect(kind: PowerKind) {
    this.score += 25;
    this.onEvent('power');
    if (kind === 'wide') {
      this.wideT = 14;
      this.setPaddle(this.paddleX);
    } else if (kind === 'slow') this.slowT = 10;
    else if (kind === 'life') this.lives = Math.min(5, this.lives + 1);
    else if (kind === 'multi') {
      const src = this.balls[0];
      if (!src) return;
      const s = Math.hypot(src.vx, src.vy) || this.speed();
      const ang = Math.atan2(src.vx, -src.vy);
      for (const d of [-0.45, 0.45]) {
        if (this.balls.length >= 6) break;
        this.balls.push({ x: src.x, y: src.y, vx: Math.sin(ang + d) * s, vy: -Math.cos(ang + d) * s });
      }
    }
  }

  private checkBest() {
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      this.saveBest();
    }
  }

  private gameOver() {
    this.phase = 'over';
    this.phaseT = 0;
    this.balls = [];
    this.drops = [];
    this.checkBest();
    this.onEvent('over');
  }
}
