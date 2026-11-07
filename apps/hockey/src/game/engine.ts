/** Table size in game pixels (the playing surface; the rim is drawn outside this). */
export const TW = 184;
export const TH = 352;
export const GOAL = 60;
export const GX0 = (TW - GOAL) / 2;
export const GX1 = GX0 + GOAL;
export const RP = 15; // paddle radius
export const RK = 8; // puck radius
export const WIN_SCORE = 7;
const MAX_LEVEL = 5;
const STEP = 1 / 240;
const MID = TH / 2;
const STORE_KEY = 'hockey-v1';

export type Phase = 'title' | 'ready' | 'play' | 'over';
export type GameEvent = 'paddle' | 'wall' | 'goalYou' | 'goalRival' | 'win' | 'lose' | 'start';

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  color: string;
}

export interface Controls {
  /** Absolute target for your paddle (finger position), or null when not touching. */
  tx: number | null;
  ty: number | null;
  /** Keyboard direction, each -1..1. */
  kx: number;
  ky: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function load(): { streak: number; best: number } {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.streak) && Number.isFinite(s.best)) return { streak: s.streak, best: s.best };
  } catch {
    /* ignore */
  }
  return { streak: 0, best: 0 };
}

export class HockeyGame {
  phase: Phase = 'title';
  /** [you, rival] */
  score: [number, number] = [0, 0];
  streak: number;
  best: number;
  level = 0;
  won = false;
  puck: Body = { x: TW / 2, y: MID + 60, vx: 0, vy: 0 };
  me: Body = { x: TW / 2, y: TH - 34, vx: 0, vy: 0 };
  ai: Body = { x: TW / 2, y: 34, vx: 0, vy: 0 };
  trail: { x: number; y: number }[] = [];
  fx: Particle[] = [];
  shake = 0;
  msg = '';
  msgT = 0;
  t = 0;
  onEvent: (e: GameEvent) => void = () => {};

  private acc = 0;
  private ticks = 0;
  private wait = 0;
  private ctrl: Controls = { tx: null, ty: null, kx: 0, ky: 0 };

  constructor() {
    const s = load();
    this.streak = s.streak;
    this.best = s.best;
    this.serve(1);
  }

  start() {
    this.score = [0, 0];
    this.level = Math.min(MAX_LEVEL, this.streak);
    this.won = false;
    this.phase = 'ready';
    this.t = 0;
    this.msg = '';
    this.msgT = 0;
    this.fx = [];
    this.serve(1);
    this.onEvent('start');
  }

  /** Put the puck on one half: 1 = yours, 0 = the rival's. Paddles go home. */
  private serve(side: number) {
    this.puck = { x: TW / 2, y: side ? TH - 120 : 120, vx: 0, vy: 0 };
    this.me = { x: TW / 2, y: TH - 34, vx: 0, vy: 0 };
    this.ai = { x: TW / 2, y: 34, vx: 0, vy: 0 };
    this.wait = 1.1;
    this.trail = [];
  }

  update(dt: number, ctrl: Controls) {
    this.ctrl = ctrl;
    this.acc += Math.min(dt, 0.05);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.tick(STEP);
    }
  }

  private movePaddle(pd: Body, h: number, tx: number, ty: number, speed: number, minX: number, maxX: number, minY: number, maxY: number) {
    const dx = tx - pd.x;
    const dy = ty - pd.y;
    const d = Math.hypot(dx, dy) || 1;
    const mv = Math.min(d, speed * h);
    const nx = clamp(pd.x + (dx / d) * mv, minX, maxX);
    const ny = clamp(pd.y + (dy / d) * mv, minY, maxY);
    pd.vx = (nx - pd.x) / h;
    pd.vy = (ny - pd.y) / h;
    pd.x = nx;
    pd.y = ny;
  }

  private collide(pd: Body): boolean {
    const p = this.puck;
    const dx = p.x - pd.x;
    const dy = p.y - pd.y;
    const d = Math.hypot(dx, dy);
    const min = RP + RK;
    if (d >= min || d === 0) return false;
    const nx = dx / d;
    const ny = dy / d;
    p.x = pd.x + nx * min;
    p.y = pd.y + ny * min;
    const vn = (p.vx - pd.vx) * nx + (p.vy - pd.vy) * ny;
    if (vn < 0) {
      p.vx -= 2 * vn * nx * 0.92;
      p.vy -= 2 * vn * ny * 0.92;
    }
    if (Math.hypot(p.vx, p.vy) < 90) {
      p.vx += nx * 120;
      p.vy += ny * 120;
    }
    return true;
  }

  private burst(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++) {
      this.fx.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: 0, color });
    }
  }

  private tick(h: number) {
    this.t += h;
    this.shake = Math.max(0, this.shake - h);
    this.msgT -= h;
    for (const f of this.fx) {
      f.t += h;
      f.x += f.vx * h;
      f.y += f.vy * h;
    }
    this.fx = this.fx.filter((f) => f.t < 0.5);
    if (this.phase === 'ready' && this.t > 1.2) {
      this.phase = 'play';
      this.msg = '';
    }
    if (this.phase === 'title' || this.phase === 'over') return;
    if (this.wait > 0) this.wait -= h;

    this.moveMe(h);
    this.moveAi(h);

    const p = this.puck;
    p.x += p.vx * h;
    p.y += p.vy * h;
    p.vx *= 1 - 0.22 * h;
    p.vy *= 1 - 0.22 * h;

    if (p.x < RK) {
      p.x = RK;
      p.vx = Math.abs(p.vx) * 0.95;
      this.onEvent('wall');
    } else if (p.x > TW - RK) {
      p.x = TW - RK;
      p.vx = -Math.abs(p.vx) * 0.95;
      this.onEvent('wall');
    }
    const inGoal = p.x > GX0 && p.x < GX1;
    if (p.y < RK && !inGoal) {
      p.y = RK;
      p.vy = Math.abs(p.vy) * 0.95;
      this.onEvent('wall');
    } else if (p.y > TH - RK && !inGoal) {
      p.y = TH - RK;
      p.vy = -Math.abs(p.vy) * 0.95;
      this.onEvent('wall');
    }
    if (p.y < -RK * 2 || p.y > TH + RK * 2) {
      this.goal(p.y < 0);
      return;
    }
    if (this.collide(this.me)) {
      this.onEvent('paddle');
      this.burst(p.x, p.y, '#9ad0ff');
    }
    if (this.collide(this.ai)) {
      this.onEvent('paddle');
      this.burst(p.x, p.y, '#ff9a9a');
    }
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 520) {
      p.vx *= 520 / sp;
      p.vy *= 520 / sp;
    }
    if (++this.ticks % 12 === 0) {
      this.trail.push({ x: p.x, y: p.y });
      if (this.trail.length > 6) this.trail.shift();
    }
  }

  private moveMe(h: number) {
    const c = this.ctrl;
    const minX = RP, maxX = TW - RP, minY = MID + RP, maxY = TH - RP;
    if (c.tx !== null && c.ty !== null) {
      this.movePaddle(this.me, h, c.tx, c.ty, 900, minX, maxX, minY, maxY);
    } else {
      const L = Math.hypot(c.kx, c.ky) || 1;
      this.movePaddle(this.me, h, this.me.x + (c.kx / L) * 400, this.me.y + (c.ky / L) * 400, 250, minX, maxX, minY, maxY);
    }
  }

  /** The rival: attacks a slow puck on its half, otherwise guards its goal. Level 0-5 sets its speed and accuracy. */
  private moveAi(h: number) {
    const p = this.puck;
    const lv = this.level;
    const speed = 135 + lv * 22;
    let tx: number, ty: number;
    if (this.wait > 0) {
      tx = TW / 2;
      ty = 34;
    } else if (p.y < MID + 10 && Math.hypot(p.vx, p.vy) < 170 + lv * 20) {
      // Line up behind the puck and shove it toward your goal.
      const gx = TW / 2, gy = TH + 20;
      const ex = gx - p.x, ey = gy - p.y;
      const el = Math.hypot(ex, ey) || 1;
      tx = p.x - (ex / el) * (RP + RK - 4);
      ty = p.y - (ey / el) * (RP + RK - 4);
      if (this.ai.y > p.y - 6) {
        ty = Math.max(20, p.y - 26);
        tx = p.x + (this.ai.x > p.x ? 18 : -18);
      }
    } else {
      ty = 38;
      tx = clamp(p.vy < 0 ? p.x : TW / 2 + (p.x - TW / 2) * 0.55, GX0 - 8, GX1 + 8);
    }
    this.movePaddle(this.ai, h, tx + Math.sin(this.t * 3) * (5 - lv), ty, speed, RP, TW - RP, RP, MID - RP);
  }

  /** `topGoal` true when the puck went into the rival's goal (you scored). */
  private goal(topGoal: boolean) {
    const p = this.puck;
    this.score[topGoal ? 0 : 1]++;
    this.shake = 0.25;
    this.burst(p.x, clamp(p.y, 0, TH), '#ffe08a');
    this.onEvent(topGoal ? 'goalYou' : 'goalRival');
    this.msg = topGoal ? 'GOAL!' : 'THEY SCORE';
    this.msgT = 1.2;
    if (this.score[0] >= WIN_SCORE || this.score[1] >= WIN_SCORE) {
      this.phase = 'over';
      this.won = this.score[0] >= WIN_SCORE;
      if (this.won) {
        this.streak++;
        this.best = Math.max(this.best, this.streak);
      } else this.streak = 0;
      this.save();
      this.msg = this.won ? 'YOU WIN!' : 'YOU LOSE';
      this.msgT = 99;
      this.onEvent(this.won ? 'win' : 'lose');
      return;
    }
    this.serve(topGoal ? 0 : 1);
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ streak: this.streak, best: this.best }));
    } catch {
      /* ignore */
    }
  }
}
