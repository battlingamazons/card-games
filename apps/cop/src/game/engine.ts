export const W = 180;
export const H = 320;
export const SCENE_BOTTOM = 262;
export const MAG = 6;

const KEY = 'cop-best';
const STEP = 1 / 120;
const STAGE_LEN = 28; // seconds of crooks before the boss shows up

export type Phase = 'title' | 'card' | 'play' | 'clear' | 'over';
export type Kind = 'thug' | 'sharp' | 'boss' | 'tourist' | 'mayor' | 'granny' | 'donut';
export type GameEvent = 'shot' | 'click' | 'reload' | 'hit' | 'head' | 'hurt' | 'oops' | 'donut' | 'bossIn' | 'bossHit' | 'clear' | 'over' | 'start' | 'warn';

export const COLS = [32, 90, 148];
/** Y of the cover's top edge (or window sill) for each row. */
export const ROW_Y = [100, 158, 222];

export interface StageDef {
  name: string;
  blurb: string;
  boss: string;
}
export const STAGES: StageDef[] = [
  { name: 'DOWNTOWN', blurb: "The donut shop got robbed. Again. This time it's personal.", boss: 'BIG MIKE' },
  { name: 'THE DOCKS', blurb: 'Smugglers. Crates. Seagulls. Nobody warned you about the seagulls.', boss: 'THE BARON' },
  { name: 'DISCO INFERNO', blurb: 'Grand opening night. The mob brought a fog machine.', boss: 'DISCO DAN' },
];

export interface Target {
  slot: number; // row * 3 + col
  kind: Kind;
  state: 'rise' | 'hold' | 'fall' | 'dead';
  pop: number; // 0 hidden .. 1 fully up
  hold: number; // seconds left in hold
  hp: number;
  maxHp: number;
  dieT: number;
  warned: boolean;
  age: number;
  flash: number; // white hit flash
}
export interface Shot {
  x: number;
  y: number;
  t: number;
}
export interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  size: number;
}

const ENEMY: Kind[] = ['thug', 'sharp', 'boss'];
export const isEnemy = (k: Kind) => ENEMY.includes(k);
export const CIVILIAN_NAME: Record<string, string> = { tourist: 'THE TOURIST', mayor: 'THE MAYOR', granny: 'SWEET GRANNY' };
const KILL_LINES = ['BUSTED!', 'FREEZE, PUNK!', "YOU'RE NICKED!", 'CASE CLOSED!', 'BOOK HIM!', 'SLEEP TIGHT!', 'TOO EASY!'];

export class CopGame {
  phase: Phase = 'title';
  stage = 0; // 0-based, grows without limit
  stageT = 0;
  cardT = 0;
  score = 0;
  best = 0;
  newBest = false;
  lives = 3;
  streak = 0;
  ammo = MAG;
  reloadT = 0;
  kills = 0;
  bossOut = false;
  bossDown = false;
  targets: Target[] = [];
  shots: Shot[] = [];
  pops: Pop[] = [];
  banner = '';
  bannerT = 0;
  hurtT = 0;
  shake = 0;
  recoil = 0;
  aim = { x: 90, y: 150 };
  t = 0;
  deadFor = 0;
  clearBonus = 0;
  onEvent: (e: GameEvent) => void = () => {};
  private acc = 0;
  private spawnT = 0;
  private bossT = 0;

  constructor() {
    try {
      this.best = Number(localStorage.getItem(KEY)) || 0;
    } catch {
      /* ignore */
    }
  }

  get def() {
    return STAGES[this.stage % STAGES.length];
  }
  get stageName() {
    const loop = Math.floor(this.stage / STAGES.length);
    return loop > 0 ? `${this.def.name} ${'I'.repeat(loop + 1)}` : this.def.name;
  }
  get mult() {
    return Math.min(5, 1 + Math.floor(this.streak / 5));
  }
  get diff() {
    return Math.min(4, this.stage * 0.7 + this.stageT / STAGE_LEN);
  }

  start() {
    this.score = 0;
    this.lives = 3;
    this.streak = 0;
    this.kills = 0;
    this.stage = 0;
    this.newBest = false;
    this.deadFor = 0;
    this.beginStage();
    this.onEvent('start');
  }

  private beginStage() {
    this.phase = 'card';
    this.cardT = 0;
    this.stageT = 0;
    this.targets = [];
    this.shots = [];
    this.ammo = MAG;
    this.reloadT = 0;
    this.bossOut = false;
    this.bossDown = false;
    this.spawnT = 0.8;
    this.bossT = 0;
  }

  tap() {
    if (this.phase === 'title') this.start();
    else if (this.phase === 'over' && this.deadFor > 0.8) this.start();
    else if (this.phase === 'card' && this.cardT > 0.5) this.phase = 'play';
    else if (this.phase === 'clear' && this.cardT > 1.2) {
      this.stage++;
      this.beginStage();
    }
  }

  reload() {
    if (this.phase !== 'play' || this.reloadT > 0 || this.ammo === MAG) return;
    this.reloadT = 0.7;
    this.onEvent('reload');
  }

  private say(t: string, secs = 1.4) {
    this.banner = t;
    this.bannerT = secs;
  }

  private pop(x: number, y: number, text: string, color: string, size = 10) {
    this.pops.push({ x, y, text, color, life: 0.9, size });
  }

  slotX(slot: number) {
    return COLS[slot % 3];
  }
  slotRow(slot: number) {
    return Math.floor(slot / 3);
  }

  /** Visible rect of a target (feet y, scale) used for drawing and hit testing. */
  rect(t: Target) {
    const row = this.slotRow(t.slot);
    const s = t.kind === 'boss' ? 1.15 : 1;
    const base = ROW_Y[row] + 4;
    const feet = base + (1 - t.pop) * 40 * s;
    const top = feet - 36 * s;
    const bottom = Math.min(feet, ROW_Y[row]);
    return { cx: this.slotX(t.slot), feet, top, bottom, s };
  }

  shoot(x: number, y: number) {
    if (this.phase !== 'play' || y > SCENE_BOTTOM) return;
    this.aim = { x, y };
    if (this.reloadT > 0) return;
    if (this.ammo <= 0) {
      this.onEvent('click');
      this.reload();
      return;
    }
    this.ammo--;
    this.recoil = 1;
    this.shots.push({ x, y, t: 0 });
    this.onEvent('shot');
    // front rows first
    const order = [...this.targets].filter((t) => t.state === 'rise' || t.state === 'hold').sort((a, b) => b.slot - a.slot);
    for (const t of order) {
      const r = this.rect(t);
      if (r.bottom - r.top < 8) continue;
      const pad = 5;
      if (x >= r.cx - 15 * r.s - pad && x <= r.cx + 15 * r.s + pad && y >= r.top - pad && y <= r.bottom + pad) {
        this.hitTarget(t, x, y, y < r.top + 14 * r.s);
        return;
      }
    }
    if (this.ammo === 0) this.say('RELOAD!', 0.9);
  }

  private hitTarget(t: Target, x: number, y: number, head: boolean) {
    if (t.kind === 'donut') {
      t.state = 'dead';
      t.dieT = 0;
      if (this.lives < 5) {
        this.lives++;
        this.pop(x, y, '+1 LIFE', '#7fe0c4', 11);
      } else {
        this.score += 500;
        this.pop(x, y, '+500', '#ffe08a', 11);
      }
      this.say('DONUT BREAK!', 1);
      this.onEvent('donut');
      return;
    }
    if (!isEnemy(t.kind)) {
      t.state = 'dead';
      t.dieT = 0;
      this.streak = 0;
      this.say(`DON'T SHOOT ${CIVILIAN_NAME[t.kind]}!`, 1.6);
      this.hurt();
      this.onEvent('oops');
      return;
    }
    t.hp--;
    t.flash = 0.12;
    if (t.hp > 0) {
      this.onEvent('bossHit');
      this.pop(x, y - 6, 'HIT!', '#fff', 9);
      t.hold += 0.35; // a little breathing room
      return;
    }
    t.state = 'dead';
    t.dieT = 0;
    this.kills++;
    this.streak++;
    const base = t.kind === 'boss' ? 1000 : head ? 250 : 100;
    const pts = base * this.mult;
    this.score += pts;
    this.pop(x, y - 8, `+${pts}`, head ? '#ffe08a' : '#fff', head ? 12 : 10);
    if (head && t.kind !== 'boss') this.pop(x, y - 22, 'HEADSHOT!', '#ff9a8a', 8);
    this.onEvent(head ? 'head' : 'hit');
    if (t.kind === 'boss') {
      this.bossDown = true;
      this.say(`${this.def.boss} IS BUSTED!`, 2);
    } else if (this.kills % 4 === 0) this.say(KILL_LINES[Math.floor(Math.random() * KILL_LINES.length)], 1);
  }

  private hurt() {
    this.lives--;
    this.hurtT = 0.5;
    this.shake = 1;
    this.streak = 0;
    this.onEvent('hurt');
    if (this.lives <= 0) {
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

  update(dt: number) {
    this.t += dt;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(STEP);
    }
  }

  private step(dt: number) {
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.bannerT = Math.max(0, this.bannerT - dt);
    for (const s of this.shots) s.t += dt;
    this.shots = this.shots.filter((s) => s.t < 3);
    for (const p of this.pops) {
      p.y -= 18 * dt;
      p.life -= dt;
    }
    this.pops = this.pops.filter((p) => p.life > 0);

    if (this.phase === 'card' || this.phase === 'clear') {
      this.cardT += dt;
      return;
    }
    if (this.phase === 'over') {
      this.deadFor += dt;
    }
    if (this.phase !== 'play' && this.phase !== 'over') return;

    if (this.phase === 'play') {
      this.stageT += dt;
      if (this.reloadT > 0) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) this.ammo = MAG;
      }
      this.spawnLogic(dt);
    }

    for (const t of this.targets) this.stepTarget(t, dt);
    this.targets = this.targets.filter((t) => !(t.state === 'fall' && t.pop <= 0) && !(t.state === 'dead' && t.dieT > 0.5));

    if (this.phase === 'play' && this.bossDown && !this.targets.some((t) => t.state === 'dead' && t.kind === 'boss')) {
      this.phase = 'clear';
      this.cardT = 0;
      this.clearBonus = 500 + this.lives * 250;
      this.score += this.clearBonus;
      if (this.score > this.best) {
        this.best = this.score;
        try {
          localStorage.setItem(KEY, String(this.best));
        } catch {
          /* ignore */
        }
      }
      this.onEvent('clear');
    }
  }

  private stepTarget(t: Target, dt: number) {
    t.age += dt;
    t.flash = Math.max(0, t.flash - dt);
    if (t.state === 'rise') {
      t.pop = Math.min(1, t.pop + dt / 0.16);
      if (t.pop >= 1) t.state = 'hold';
    } else if (t.state === 'hold') {
      t.hold -= dt;
      if (isEnemy(t.kind) && !t.warned && t.hold < 0.38) {
        t.warned = true;
        this.onEvent('warn');
      }
      if (t.hold <= 0) {
        if (isEnemy(t.kind) && this.phase === 'play') {
          this.pop(this.slotX(t.slot), this.rect(t).top, 'BANG!', '#ff6a5a', 12);
          this.hurt();
        }
        t.state = 'fall';
      }
    } else if (t.state === 'fall') {
      t.pop = Math.max(0, t.pop - dt / 0.16);
    } else {
      t.dieT += dt;
      t.pop = Math.max(0, t.pop - dt * 1.4);
    }
  }

  private freeSlots() {
    const used = new Set(this.targets.map((t) => t.slot));
    const out: number[] = [];
    for (let i = 0; i < 9; i++) if (!used.has(i)) out.push(i);
    return out;
  }

  private spawnLogic(dt: number) {
    const live = this.targets.filter((t) => isEnemy(t.kind) && t.state !== 'dead').length;
    // the boss arrives after the stage timer, and comes back until beaten
    if (this.stageT > STAGE_LEN && !this.bossDown) {
      const boss = this.targets.find((t) => t.kind === 'boss');
      if (!boss) {
        this.bossT -= dt;
        if (this.bossT <= 0) {
          this.bossT = 1.4;
          const free = this.freeSlots();
          if (free.length) {
            if (!this.bossOut) {
              this.say(`${this.def.boss} APPROACHES!`, 1.8);
              this.onEvent('bossIn');
            }
            this.bossOut = true;
            const hp = 3 + Math.floor(this.stage / 2);
            this.targets.push(this.make(free[Math.floor(Math.random() * free.length)], 'boss', 2.4, hp));
          }
        }
      }
    }
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const d = this.diff;
    const bossFight = this.bossOut && !this.bossDown;
    this.spawnT = Math.max(0.3, 1.0 - d * 0.14) * (bossFight ? 1.8 : 1) * (0.8 + Math.random() * 0.4);
    if (live >= 3 + Math.floor(d / 2)) return;
    const free = this.freeSlots();
    if (!free.length) return;
    const slot = free[Math.floor(Math.random() * free.length)];
    const r = Math.random();
    const speed = Math.max(0.55, 1 - d * 0.08);
    let kind: Kind;
    if (r < 0.025 && this.lives < 3) kind = 'donut';
    else if (r < 0.2) kind = (['tourist', 'mayor', 'granny'] as const)[Math.floor(Math.random() * 3)];
    else if (r < 0.2 + 0.1 + this.stage * 0.05 + d * 0.04) kind = 'sharp';
    else kind = 'thug';
    const base = kind === 'sharp' ? 0.95 : kind === 'thug' ? 1.45 : 1.6;
    this.targets.push(this.make(slot, kind, base * speed * (0.85 + Math.random() * 0.3), 1));
  }

  private make(slot: number, kind: Kind, hold: number, hp: number): Target {
    return { slot, kind, state: 'rise', pop: 0, hold, hp, maxHp: hp, dieT: 0, warned: false, age: 0, flash: 0 };
  }
}
