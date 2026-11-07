import { SHIELD_H, SHIELD_W, newShield } from './sprites';

/** Logical screen size in game pixels. */
export const W = 224;
export const H = 256;

export const COLS = 10;
export const ROWS = 5;
export const CELL_W = 16;
export const CELL_H = 14;
/** Odd rows sit half a cell to the right, so the fleet forms a honeycomb. */
export const STAGGER = 8;
export const INV_H = 8;
/** Widths of the three invader sprites, by kind (0 jelly, 1 moth, 2 skull). */
export const INV_WIDTHS = [10, 11, 12];
export const PLAYER_W = 13;
export const PLAYER_H = 8;
export const PLAYER_Y = 232;
export const UFO_W = 16;
export const UFO_H = 7;
export const UFO_Y = 30;
export const SHIELD_Y = 196;
export const SHIELD_XS = [22, 70, 118, 166];
export const GROUND_Y = 246;

const STEP = 1 / 120;
const PLAYER_SPEED = 100;
const BULLET_SPEED = 230;
const START_LIVES = 3;
const EXTRA_LIFE_AT = 1500;

export type Phase = 'title' | 'play' | 'dying' | 'clear' | 'over';

export type GameEvent =
  | 'shoot'
  | 'kill'
  | 'die'
  | 'ufo'
  | 'ufoHit'
  | 'extraLife'
  | 'clear'
  | 'over'
  | 'march0'
  | 'march1'
  | 'march2'
  | 'march3';

export interface Input {
  left: boolean;
  right: boolean;
  fire: boolean;
}

interface Bullet {
  x: number;
  y: number;
}

interface Blast {
  x: number;
  y: number;
  t: number;
  kind: 'invader' | 'player' | 'spark';
}

interface Popup {
  x: number;
  y: number;
  t: number;
  text: string;
}

/** Row of the grid (0 = top) -> invader kind and points. */
export function kindOfRow(row: number): number {
  return row === 0 ? 0 : row <= 2 ? 1 : 2;
}
export function pointsOfRow(row: number): number {
  return row === 0 ? 30 : row <= 2 ? 20 : 10;
}

const STORE_KEY = 'invaders-v1';

function loadHi(): number {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.hi)) return s.hi;
  } catch {
    /* ignore */
  }
  return 0;
}

export class InvadersGame {
  phase: Phase = 'title';
  score = 0;
  hi: number;
  lives = START_LIVES;
  wave = 1;
  newBest = false;

  playerX = (W - PLAYER_W) / 2;
  pBullet: Bullet | null = null;
  eBullets: Bullet[] = [];

  alive = new Uint8Array(COLS * ROWS);
  aliveCount = 0;
  ox = 28;
  oy = 56;
  dir = 1;
  frame = 0;
  shields: Uint8Array[] = [];
  ufo: { x: number; dir: number; value: number } | null = null;
  blasts: Blast[] = [];
  popups: Popup[] = [];
  /** Why the game ended. */
  overReason: 'lives' | 'invaded' | null = null;

  private rng: () => number;
  private acc = 0;
  private stepT = 0;
  private fireT = 1;
  private ufoT = 15;
  private march = 0;
  private phaseT = 0;
  private gotExtra = false;
  private ufoBeepT = 0;
  onEvent: (e: GameEvent) => void = () => {};

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.hi = loadHi();
    this.startWave();
  }

  start() {
    this.score = 0;
    this.lives = START_LIVES;
    this.wave = 1;
    this.newBest = false;
    this.gotExtra = false;
    this.overReason = null;
    this.playerX = (W - PLAYER_W) / 2;
    this.startWave();
    this.phase = 'play';
  }

  private startWave() {
    this.alive.fill(1);
    this.aliveCount = COLS * ROWS;
    this.ox = 28;
    this.oy = 56 + Math.min(this.wave - 1, 5) * 8;
    this.dir = 1;
    this.frame = 0;
    this.stepT = 0;
    this.shields = SHIELD_XS.map((_, i) => newShield(i + 1));
    this.pBullet = null;
    this.eBullets = [];
    this.ufo = null;
    this.ufoT = 12 + this.rng() * 8;
    this.fireT = 1.2;
    this.blasts = [];
    this.popups = [];
  }

  /** Advance the game by `dt` seconds using fixed internal steps. */
  update(dt: number, input: Input) {
    this.acc += dt;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.tick(STEP, input);
    }
  }

  private tick(dt: number, input: Input) {
    // Cosmetic effects always run.
    for (const b of this.blasts) b.t += dt;
    this.blasts = this.blasts.filter((b) => b.t < (b.kind === 'player' ? 1.5 : b.kind === 'spark' ? 0.25 : 0.3));
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 1);

    if (this.phase === 'dying') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.lives <= 0) this.gameOver('lives');
        else {
          this.phase = 'play';
          this.playerX = (W - PLAYER_W) / 2;
        }
      }
      return;
    }
    if (this.phase === 'clear') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.wave++;
        this.startWave();
        this.phase = 'play';
      }
      return;
    }
    if (this.phase !== 'play') return;

    this.movePlayer(dt, input);
    this.movePlayerBullet(dt);
    this.moveInvaders(dt);
    this.moveEnemyBullets(dt);
    this.moveUfo(dt);
    this.invaderFire(dt);
  }

  private movePlayer(dt: number, input: Input) {
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.playerX = Math.max(6, Math.min(W - 6 - PLAYER_W, this.playerX + dx * PLAYER_SPEED * dt));
    if (input.fire && !this.pBullet) {
      this.pBullet = { x: this.playerX + PLAYER_W / 2 - 1, y: PLAYER_Y - 6 };
      this.onEvent('shoot');
    }
  }

  private invRect(row: number, col: number) {
    const w = INV_WIDTHS[kindOfRow(row)];
    return { x: this.ox + col * CELL_W + (row % 2) * STAGGER + (CELL_W - w) / 2, y: this.oy + row * CELL_H, w, h: INV_H };
  }

  private movePlayerBullet(dt: number) {
    const b = this.pBullet;
    if (!b) return;
    b.y -= BULLET_SPEED * dt;
    if (b.y < 14) {
      this.blasts.push({ x: b.x - 4, y: 14, t: 0, kind: 'spark' });
      this.pBullet = null;
      return;
    }
    const bw = 2, bh = 6;
    // Mystery ship.
    const u = this.ufo;
    if (u && b.x + bw > u.x && b.x < u.x + UFO_W && b.y < UFO_Y + UFO_H && b.y + bh > UFO_Y) {
      this.addScore(u.value);
      this.popups.push({ x: u.x, y: UFO_Y, t: 0, text: String(u.value) });
      this.blasts.push({ x: u.x + 2, y: UFO_Y - 1, t: 0, kind: 'invader' });
      this.ufo = null;
      this.ufoT = 15 + this.rng() * 10;
      this.pBullet = null;
      this.onEvent('ufoHit');
      return;
    }
    // Invaders.
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!this.alive[row * COLS + col]) continue;
        const r = this.invRect(row, col);
        if (b.x + bw > r.x && b.x < r.x + r.w && b.y < r.y + r.h && b.y + bh > r.y) {
          this.alive[row * COLS + col] = 0;
          this.aliveCount--;
          this.addScore(pointsOfRow(row));
          this.blasts.push({ x: r.x + r.w / 2 - 6, y: r.y, t: 0, kind: 'invader' });
          this.pBullet = null;
          this.onEvent('kill');
          if (this.aliveCount === 0) {
            this.phase = 'clear';
            this.phaseT = 1.4;
            this.eBullets = [];
            this.ufo = null;
            this.onEvent('clear');
          }
          return;
        }
      }
    }
    // Bunkers.
    if (this.hitShields(b.x, b.y, bw, bh, 'up')) this.pBullet = null;
  }

  private stepInterval(): number {
    const base = 0.04 + 0.5 * (this.aliveCount / (COLS * ROWS));
    return base * Math.max(0.6, 1 - (this.wave - 1) * 0.07);
  }

  private moveInvaders(dt: number) {
    this.stepT += dt;
    if (this.stepT < this.stepInterval()) return;
    this.stepT = 0;

    let minX = Infinity, maxX = -Infinity, maxR = -1;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!this.alive[row * COLS + col]) continue;
        const r = this.invRect(row, col);
        minX = Math.min(minX, r.x);
        maxX = Math.max(maxX, r.x + r.w);
        maxR = Math.max(maxR, row);
      }
    }
    if (maxR < 0) return;
    const dx = 4;
    if ((this.dir > 0 && maxX + dx > W - 4) || (this.dir < 0 && minX - dx < 4)) {
      this.oy += 8;
      this.dir = -this.dir;
    } else {
      this.ox += this.dir * dx;
    }
    this.frame ^= 1;
    this.onEvent(`march${this.march++ % 4}` as GameEvent);
    this.erodeShieldsUnderInvaders();
    if (this.oy + maxR * CELL_H + INV_H >= PLAYER_Y) {
      this.gameOver('invaded');
    }
  }

  private erodeShieldsUnderInvaders() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!this.alive[row * COLS + col]) continue;
        const r = this.invRect(row, col);
        if (r.y + r.h < SHIELD_Y || r.y > SHIELD_Y + SHIELD_H) continue;
        SHIELD_XS.forEach((sx, i) => {
          const sh = this.shields[i];
          for (let y = Math.max(SHIELD_Y, Math.floor(r.y)); y < Math.min(SHIELD_Y + SHIELD_H, r.y + r.h); y++) {
            for (let x = Math.max(sx, Math.floor(r.x)); x < Math.min(sx + SHIELD_W, r.x + r.w); x++) {
              sh[(y - SHIELD_Y) * SHIELD_W + (x - sx)] = 0;
            }
          }
        });
      }
    }
  }

  private invaderFire(dt: number) {
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = Math.max(0.3, 1.1 - this.wave * 0.06 - ((COLS * ROWS - this.aliveCount) / (COLS * ROWS)) * 0.5) * (0.6 + this.rng() * 0.8);
    if (this.eBullets.length >= 3) return;
    // Pick a column; the lowest living invader in it shoots. One time in three, aim at the cannon.
    const cols: number[] = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (this.alive[r * COLS + c]) cols.push(c);
    const uniq = [...new Set(cols)];
    if (!uniq.length) return;
    let col = uniq[Math.floor(this.rng() * uniq.length)];
    if (this.rng() < 0.33) {
      const target = Math.floor((this.playerX + PLAYER_W / 2 - this.ox) / CELL_W);
      col = uniq.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best), uniq[0]);
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.alive[r * COLS + col]) {
        const rect = this.invRect(r, col);
        this.eBullets.push({ x: rect.x + rect.w / 2 - 1, y: rect.y + rect.h });
        return;
      }
    }
  }

  private moveEnemyBullets(dt: number) {
    const speed = 80 + this.wave * 4;
    const kept: Bullet[] = [];
    for (const b of this.eBullets) {
      b.y += speed * dt;
      const bw = 2, bh = 6;
      // Meets the cannon's shot: both vanish.
      const p = this.pBullet;
      if (p && p.x + 2 > b.x && p.x < b.x + bw && p.y < b.y + bh && p.y + 6 > b.y) {
        this.pBullet = null;
        this.blasts.push({ x: b.x - 4, y: b.y, t: 0, kind: 'spark' });
        continue;
      }
      if (b.x + bw > this.playerX && b.x < this.playerX + PLAYER_W && b.y + bh > PLAYER_Y && b.y < PLAYER_Y + PLAYER_H) {
        this.killPlayer();
        return;
      }
      if (this.hitShields(b.x, b.y, bw, bh, 'down')) continue;
      if (b.y + bh >= GROUND_Y) {
        this.blasts.push({ x: b.x - 4, y: GROUND_Y - 6, t: 0, kind: 'spark' });
        continue;
      }
      kept.push(b);
    }
    this.eBullets = kept;
  }

  private killPlayer() {
    this.lives--;
    this.phase = 'dying';
    this.phaseT = 1.6;
    this.eBullets = [];
    this.pBullet = null;
    this.blasts.push({ x: this.playerX, y: PLAYER_Y, t: 0, kind: 'player' });
    this.onEvent('die');
  }

  private moveUfo(dt: number) {
    if (this.ufo) {
      this.ufo.x += this.ufo.dir * 45 * dt;
      this.ufoBeepT -= dt;
      if (this.ufoBeepT <= 0) {
        this.ufoBeepT = 0.18;
        this.onEvent('ufo');
      }
      if (this.ufo.x < -UFO_W - 2 || this.ufo.x > W + 2) {
        this.ufo = null;
        this.ufoT = 15 + this.rng() * 10;
      }
      return;
    }
    this.ufoT -= dt;
    if (this.ufoT <= 0 && this.aliveCount >= 8) {
      const dir = this.rng() < 0.5 ? 1 : -1;
      const values = [50, 100, 150, 300];
      this.ufo = { x: dir > 0 ? -UFO_W : W, dir, value: values[Math.floor(this.rng() * values.length)] };
      this.ufoBeepT = 0;
    }
  }

  /**
   * Test a bullet rectangle against the bunkers. On contact, punch a ragged hole around the first
   * solid pixel the bullet reaches, and report the hit.
   */
  private hitShields(bx: number, by: number, bw: number, bh: number, going: 'up' | 'down'): boolean {
    for (let i = 0; i < SHIELD_XS.length; i++) {
      const sx = SHIELD_XS[i];
      if (bx + bw <= sx || bx >= sx + SHIELD_W || by + bh <= SHIELD_Y || by >= SHIELD_Y + SHIELD_H) continue;
      const sh = this.shields[i];
      const x0 = Math.max(sx, Math.floor(bx));
      const x1 = Math.min(sx + SHIELD_W, Math.ceil(bx + bw));
      const y0 = Math.max(SHIELD_Y, Math.floor(by));
      const y1 = Math.min(SHIELD_Y + SHIELD_H, Math.ceil(by + bh));
      // Scan from the leading edge back so the first contact is where the bullet really strikes.
      const ys: number[] = [];
      for (let y = y0; y < y1; y++) ys.push(y);
      if (going === 'up') ys.reverse();
      for (const y of ys) {
        for (let x = x0; x < x1; x++) {
          if (sh[(y - SHIELD_Y) * SHIELD_W + (x - sx)]) {
            this.punch(sh, x - sx, y - SHIELD_Y);
            return true;
          }
        }
      }
    }
    return false;
  }

  private punch(sh: Uint8Array, cx: number, cy: number) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 10) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= SHIELD_W || y >= SHIELD_H) continue;
        if ((dx === 0 && dy === 0) || this.rng() < 0.8) sh[y * SHIELD_W + x] = 0;
      }
    }
  }

  private addScore(n: number) {
    this.score += n;
    if (!this.gotExtra && this.score >= EXTRA_LIFE_AT) {
      this.gotExtra = true;
      this.lives++;
      this.onEvent('extraLife');
    }
  }

  private gameOver(reason: 'lives' | 'invaded') {
    this.phase = 'over';
    this.overReason = reason;
    this.eBullets = [];
    this.pBullet = null;
    if (this.score > this.hi) {
      this.hi = this.score;
      this.newBest = true;
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ hi: this.hi }));
      } catch {
        /* ignore */
      }
    }
    this.onEvent('over');
  }
}
