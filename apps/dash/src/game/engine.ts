export const W = 180;
export const H = 320;
export const GY = 252; // ground surface
export const PX = 46; // runner's fixed screen x
export const STEP = 1 / 120;

const GRAVITY = 1500;
const JUMP_V = 470;
const SLIDE_T = 0.6;
const KEY = 'dash-best';

export type Phase = 'title' | 'play' | 'over';
export type GameEvent = 'jump' | 'slide' | 'coin' | 'hit' | 'fall' | 'start' | 'mile';
export type OKind = 'rock' | 'cactus' | 'cactus2' | 'bird' | 'pit';

export interface Obs {
  kind: OKind;
  x: number; // left edge
  w: number;
  top: number; // top y (pits ignore)
  h: number;
}
export interface Coin {
  x: number;
  y: number;
  got: boolean;
  ph: number;
}
export interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class DashGame {
  phase: Phase = 'title';
  y = GY; // feet
  vy = 0;
  grounded = true;
  slideT = 0;
  jumping = false;
  jumpBuf = 0;
  slideBuf = 0;
  coyote = 0;
  dist = 0; // px travelled
  speed = 105;
  coins = 0;
  best = 0;
  newBest = false;
  obs: Obs[] = [];
  coinList: Coin[] = [];
  dust: Dust[] = [];
  t = 0;
  playT = 0;
  deadFor = 0;
  flash = 0;
  shake = 0;
  spin = 0; // tumble angle when dead
  fell = false;
  onEvent: (e: GameEvent) => void = () => {};
  private acc = 0;
  private toNext = 0;
  private lastMile = 0;
  private dustT = 0;

  constructor() {
    try {
      this.best = Number(localStorage.getItem(KEY)) || 0;
    } catch {
      /* ignore */
    }
  }

  get meters() {
    return Math.floor(this.dist / 10);
  }
  get score() {
    return this.meters + this.coins * 10;
  }
  get sliding() {
    return this.slideT > 0;
  }

  /** Called on any tap while not playing. */
  start() {
    this.phase = 'play';
    this.y = GY;
    this.vy = 0;
    this.grounded = true;
    this.slideT = 0;
    this.jumping = false;
    this.jumpBuf = this.slideBuf = this.coyote = 0;
    this.dist = 0;
    this.speed = 105;
    this.coins = 0;
    this.newBest = false;
    this.obs = [];
    this.coinList = [];
    this.dust = [];
    this.playT = 0;
    this.deadFor = 0;
    this.flash = 0;
    this.shake = 0;
    this.spin = 0;
    this.fell = false;
    this.toNext = 150;
    this.lastMile = 0;
    this.onEvent('start');
  }

  press() {
    if (this.phase === 'title') return this.start();
    if (this.phase === 'over') {
      if (this.deadFor > 0.6) this.start();
      return;
    }
    if (this.grounded || this.coyote > 0) {
      this.vy = -JUMP_V;
      this.grounded = false;
      this.coyote = 0;
      this.slideT = 0;
      this.jumping = true;
      this.puff(4);
      this.onEvent('jump');
    } else this.jumpBuf = 0.12;
  }

  release() {
    this.jumpBuf = 0;
    if (this.jumping && this.vy < -170) this.vy *= 0.45;
    this.jumping = false;
  }

  slide() {
    if (this.phase === 'title') return this.start();
    if (this.phase === 'over') {
      if (this.deadFor > 0.6) this.start();
      return;
    }
    if (this.grounded) {
      if (this.slideT <= 0) this.onEvent('slide');
      this.slideT = SLIDE_T;
    } else {
      this.vy = Math.max(this.vy, 520); // fast fall
      this.slideBuf = 0.2;
    }
  }

  update(dt: number) {
    this.t += dt;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(STEP);
    }
  }

  private supported() {
    for (const o of this.obs) if (o.kind === 'pit' && PX - 4 > o.x && PX + 4 < o.x + o.w) return false;
    return true;
  }

  private puff(n: number) {
    for (let i = 0; i < n; i++) {
      this.dust.push({ x: PX - 3 + Math.random() * 6, y: Math.min(this.y, GY), vx: -20 - Math.random() * 40, vy: -10 - Math.random() * 25, life: 0.35 + Math.random() * 0.2 });
    }
  }

  private step(dt: number) {
    for (const d of this.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
    }
    this.dust = this.dust.filter((d) => d.life > 0);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.shake = Math.max(0, this.shake - dt * 3);

    if (this.phase === 'title') return;
    if (this.phase === 'over') {
      this.deadFor += dt;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (!this.fell && this.y > GY) {
        this.y = GY;
        this.vy = 0;
      }
      if (!this.fell) this.spin += dt * 9 * Math.max(0, 1 - this.deadFor * 2.2);
      return;
    }

    this.playT += dt;
    this.speed = Math.min(280, 105 + this.meters * 0.17);
    const dx = this.speed * dt;
    this.dist += dx;

    // world scrolls
    for (const o of this.obs) o.x -= dx;
    for (const c of this.coinList) c.x -= dx;
    this.obs = this.obs.filter((o) => o.x + o.w > -30);
    this.coinList = this.coinList.filter((c) => c.x > -20 && !c.got);

    // spawn
    this.toNext -= dx;
    if (this.toNext <= 0) this.spawn();

    // timers
    this.slideT = Math.max(0, this.slideT - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.slideBuf = Math.max(0, this.slideBuf - dt);
    this.coyote = Math.max(0, this.coyote - dt);

    // physics
    const sup = this.supported();
    if (this.grounded && !sup) {
      this.grounded = false;
      this.coyote = 0.07;
    }
    const prevY = this.y;
    if (!this.grounded) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= GY && this.vy >= 0 && prevY <= GY && sup) {
        this.y = GY;
        this.vy = 0;
        this.grounded = true;
        this.jumping = false;
        this.puff(5);
        if (this.slideBuf > 0) {
          this.slideT = SLIDE_T;
          this.slideBuf = 0;
          this.onEvent('slide');
        }
        if (this.jumpBuf > 0) {
          this.jumpBuf = 0;
          this.press();
        }
      }
      if (this.y > GY + 44) return this.die(true);
    } else {
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = this.sliding ? 0.03 : 0.09;
        this.puff(1);
      }
    }

    // coins
    const top = this.sliding ? this.y - 11 : this.y - 26;
    const hw = this.sliding ? 9 : 6;
    for (const c of this.coinList) {
      if (!c.got && Math.abs(c.x - PX) < hw + 6 && c.y > top - 6 && c.y < this.y + 6) {
        c.got = true;
        this.coins++;
        this.onEvent('coin');
      }
    }

    // obstacles
    for (const o of this.obs) {
      if (o.kind === 'pit') continue;
      if (PX + hw - 1 > o.x + 2 && PX - hw + 1 < o.x + o.w - 2 && this.y - 1 > o.top + 1 && top + 1 < o.top + o.h - 1) return this.die(false);
    }

    const mile = Math.floor(this.meters / 100);
    if (mile > this.lastMile) {
      this.lastMile = mile;
      this.onEvent('mile');
    }
  }

  private spawn() {
    const m = this.meters;
    const v = this.speed;
    const r = Math.random();
    const x = W + 24;
    let width = 16;
    let kind: OKind;
    if (m > 150 && r < 0.2) kind = 'bird';
    else if (r < 0.42) kind = 'rock';
    else if (r < 0.64) kind = 'cactus';
    else if (r < 0.8) kind = 'cactus2';
    else kind = 'pit';
    if (kind === 'bird' && m < 150) kind = 'rock';
    let o: Obs;
    switch (kind) {
      case 'rock':
        width = 18;
        o = { kind, x, w: 18, top: GY - 14, h: 14 };
        break;
      case 'cactus':
        width = 13;
        o = { kind, x, w: 13, top: GY - 30, h: 30 };
        break;
      case 'cactus2':
        width = 28;
        o = { kind, x, w: 28, top: GY - 26, h: 26 };
        break;
      case 'bird':
        width = 20;
        o = { kind, x, w: 20, top: GY - 30, h: 13 };
        break;
      default: {
        width = Math.min(30 + m * 0.03, 58);
        o = { kind, x, w: width, top: GY, h: 0 };
      }
    }
    this.obs.push(o);
    // coins: an arc over the obstacle (a reward for jumping), or a low row in the gap before it
    if (Math.random() < 0.55) {
      const n = 5;
      const gap = 11;
      const cx = x + width / 2 - ((n - 1) * gap) / 2;
      for (let i = 0; i < n; i++) {
        const k = Math.sin((Math.PI * i) / (n - 1));
        this.coinList.push({ x: cx + i * gap, y: GY - 14 - k * 46, got: false, ph: Math.random() * 6 });
      }
    }
    const air = 0.627 * v;
    this.toNext = width + air + 0.3 * v + Math.random() * 0.55 * v;
    // a row of coins in the open stretch before the next obstacle
    if (Math.random() < 0.4) {
      for (let i = 0; i < 4; i++) this.coinList.push({ x: x + width + air * 0.5 + 14 + i * 12, y: GY - 12, got: false, ph: i });
    }
  }

  private die(fell: boolean) {
    this.phase = 'over';
    this.deadFor = 0;
    this.fell = fell;
    this.flash = 1;
    this.shake = 1;
    if (!fell) this.vy = -230;
    const s = this.score;
    this.newBest = s > this.best;
    if (this.newBest) {
      this.best = s;
      try {
        localStorage.setItem(KEY, String(this.best));
      } catch {
        /* ignore */
      }
    }
    this.onEvent(fell ? 'fall' : 'hit');
  }
}
