export const W = 180;
export const H = 320;
export const COLS = 4;
export const ROWS = 4;
const KEY = 'farm-save-v1';

export type CropId = 'radish' | 'carrot' | 'tomato' | 'pumpkin' | 'sunflower';
export type GameEvent = 'plant' | 'harvest' | 'bumper' | 'sell' | 'buy' | 'unlock' | 'ready' | 'no' | 'tap';

export interface CropDef {
  id: CropId;
  name: string;
  seedCost: number;
  sell: number;
  growMs: number;
}
const MIN = 60 * 1000;
export const CROPS: CropDef[] = [
  { id: 'radish', name: 'Radish', seedCost: 5, sell: 9, growMs: 1 * MIN },
  { id: 'carrot', name: 'Carrot', seedCost: 12, sell: 25, growMs: 5 * MIN },
  { id: 'tomato', name: 'Tomato', seedCost: 30, sell: 70, growMs: 20 * MIN },
  { id: 'pumpkin', name: 'Pumpkin', seedCost: 80, sell: 200, growMs: 60 * MIN },
  { id: 'sunflower', name: 'Sunflower', seedCost: 250, sell: 700, growMs: 240 * MIN },
];
export const CROP_BY_ID: Record<CropId, CropDef> = Object.fromEntries(CROPS.map((c) => [c.id, c])) as Record<CropId, CropDef>;

export interface Plot {
  unlocked: boolean;
  crop: CropId | null;
  at: number; // planted timestamp (ms)
  wasReady: boolean; // not saved; used to chime when a crop finishes while the game is open
}
export interface Floaty {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface Save {
  v: 1;
  coins: number;
  seeds: Record<CropId, number>;
  crops: Record<CropId, number>;
  plots: { unlocked: boolean; crop: CropId | null; at: number }[];
  selected: CropId;
  lastSeen: number;
  harvested: number;
  earned: number;
}

const zero = (): Record<CropId, number> => ({ radish: 0, carrot: 0, tomato: 0, pumpkin: 0, sunflower: 0 });
const START_UNLOCKED = [5, 6, 9, 10]; // the middle 2x2

export class FarmGame {
  coins = 25;
  seeds = zero();
  crops = zero();
  plots: Plot[] = [];
  selected: CropId = 'radish';
  harvested = 0;
  earned = 0;
  t = 0;
  floaties: Floaty[] = [];
  note = '';
  noteT = 0;
  welcome = '';
  focus = -1; // plot whose info is shown
  skew = 0; // test helper: shifts the clock
  onEvent: (e: GameEvent) => void = () => {};
  private saveT = 0;

  constructor() {
    for (let i = 0; i < COLS * ROWS; i++) this.plots.push({ unlocked: START_UNLOCKED.includes(i), crop: null, at: 0, wasReady: false });
    this.seeds.radish = 4;
    this.load();
  }

  now() {
    return Date.now() + this.skew;
  }

  // ---- crop state ----

  /** 0..1 growth progress of a plot (0 if empty). */
  progress(p: Plot) {
    if (!p.crop) return 0;
    const d = CROP_BY_ID[p.crop];
    const el = this.now() - p.at;
    if (el < 0) return 0; // clock set back: treat as just planted
    return Math.min(1, el / d.growMs);
  }
  ready(p: Plot) {
    return !!p.crop && this.progress(p) >= 1;
  }
  remainingMs(p: Plot) {
    if (!p.crop) return 0;
    const d = CROP_BY_ID[p.crop];
    return Math.max(0, d.growMs - Math.max(0, this.now() - p.at));
  }
  readyCount() {
    return this.plots.filter((p) => this.ready(p)).length;
  }
  unlockedCount() {
    return this.plots.filter((p) => p.unlocked).length;
  }
  nextUnlockCost() {
    const n = this.unlockedCount() - START_UNLOCKED.length;
    return Math.round(25 * Math.pow(1.45, n));
  }

  // ---- persistence ----

  private load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Save;
      if (s.v !== 1) return;
      this.coins = s.coins;
      this.seeds = { ...zero(), ...s.seeds };
      this.crops = { ...zero(), ...s.crops };
      this.selected = s.selected;
      this.harvested = s.harvested ?? 0;
      this.earned = s.earned ?? 0;
      s.plots.forEach((sp, i) => {
        if (this.plots[i]) Object.assign(this.plots[i], { unlocked: sp.unlocked, crop: sp.crop, at: sp.at });
      });
      this.welcomeBack(s.lastSeen);
    } catch {
      /* ignore */
    }
  }

  save() {
    const s: Save = {
      v: 1,
      coins: this.coins,
      seeds: this.seeds,
      crops: this.crops,
      plots: this.plots.map((p) => ({ unlocked: p.unlocked, crop: p.crop, at: p.at })),
      selected: this.selected,
      lastSeen: Date.now(),
      harvested: this.harvested,
      earned: this.earned,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  /** Called on load and when the app comes back to the foreground. */
  welcomeBack(lastSeen: number) {
    const now = this.now();
    if (now - lastSeen < 60 * 1000) {
      this.markReady();
      return;
    }
    let done = 0;
    for (const p of this.plots) {
      if (!p.crop) continue;
      const doneAt = p.at + CROP_BY_ID[p.crop].growMs;
      if (doneAt > lastSeen && doneAt <= now) done++;
    }
    const mins = Math.round((now - lastSeen) / 60000);
    const away = mins >= 120 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`;
    if (done > 0) this.welcome = `You were away ${away}. ${done} crop${done > 1 ? 's' : ''} finished growing!`;
    else if (this.plots.some((p) => p.crop)) this.welcome = `You were away ${away}. Your crops are still growing.`;
    this.markReady();
  }

  private markReady() {
    for (const p of this.plots) p.wasReady = this.ready(p);
  }

  // ---- actions ----

  private say(text: string, secs = 1.6) {
    this.note = text;
    this.noteT = secs;
  }
  private float(x: number, y: number, text: string, color: string) {
    this.floaties.push({ x, y, text, color, life: 1 });
  }

  select(id: CropId) {
    this.selected = id;
    this.onEvent('tap');
    this.save();
  }

  /** Tap on a plot; (x, y) is where to show floating text. */
  tapPlot(i: number, x: number, y: number) {
    const p = this.plots[i];
    if (!p.unlocked) {
      const cost = this.nextUnlockCost();
      if (this.coins < cost) {
        this.say(`Unlock costs ${cost} coins`);
        this.onEvent('no');
        return;
      }
      this.coins -= cost;
      p.unlocked = true;
      this.float(x, y, `-${cost}`, '#ffb0a0');
      this.say('New plot unlocked!');
      this.onEvent('unlock');
      this.save();
      return;
    }
    if (!p.crop) {
      this.focus = -1;
      if (this.seeds[this.selected] <= 0) {
        this.say(`No ${CROP_BY_ID[this.selected].name.toLowerCase()} seeds - visit the shop`);
        this.onEvent('no');
        return;
      }
      this.seeds[this.selected]--;
      p.crop = this.selected;
      p.at = this.now();
      p.wasReady = false;
      this.onEvent('plant');
      this.save();
      return;
    }
    if (this.ready(p)) {
      this.harvestPlot(p, x, y);
      this.save();
      return;
    }
    this.focus = i;
    this.onEvent('tap');
  }

  private harvestPlot(p: Plot, x: number, y: number) {
    const id = p.crop!;
    const bumper = Math.random() < 0.12;
    const n = bumper ? 2 : 1;
    this.crops[id] += n;
    this.harvested += n;
    p.crop = null;
    p.wasReady = false;
    this.float(x, y, bumper ? 'BUMPER! x2' : `+1 ${CROP_BY_ID[id].name}`, bumper ? '#ffe08a' : '#ffffff');
    this.onEvent(bumper ? 'bumper' : 'harvest');
    this.focus = -1;
  }

  harvestAll() {
    let any = false;
    this.plots.forEach((p, i) => {
      if (this.ready(p)) {
        const x = 7 + (i % COLS) * 42 + 20;
        const y = 48 + Math.floor(i / COLS) * 42 + 14;
        this.harvestPlot(p, x, y);
        any = true;
      }
    });
    if (!any) {
      this.say('Nothing is ready yet');
      this.onEvent('no');
    } else this.save();
  }

  buy(id: CropId, qty: number) {
    const d = CROP_BY_ID[id];
    const can = Math.floor(this.coins / d.seedCost);
    const n = Math.min(qty, can);
    if (n <= 0) {
      this.onEvent('no');
      return;
    }
    this.coins -= n * d.seedCost;
    this.seeds[id] += n;
    this.selected = id;
    this.onEvent('buy');
    this.save();
  }

  sell(id: CropId, qty: number) {
    const n = Math.min(qty, this.crops[id]);
    if (n <= 0) {
      this.onEvent('no');
      return;
    }
    const gain = n * CROP_BY_ID[id].sell;
    this.crops[id] -= n;
    this.coins += gain;
    this.earned += gain;
    this.onEvent('sell');
    this.save();
  }

  sellAll() {
    let gain = 0;
    for (const c of CROPS) {
      gain += this.crops[c.id] * c.sell;
      this.crops[c.id] = 0;
    }
    if (gain <= 0) {
      this.onEvent('no');
      return;
    }
    this.coins += gain;
    this.earned += gain;
    this.onEvent('sell');
    this.save();
  }

  cropValue() {
    return CROPS.reduce((a, c) => a + this.crops[c.id] * c.sell, 0);
  }

  // ---- frame update ----

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    for (const f of this.floaties) {
      f.y -= 20 * dt;
      f.life -= dt;
    }
    this.floaties = this.floaties.filter((f) => f.life > 0);
    for (const p of this.plots) {
      const r = this.ready(p);
      if (r && !p.wasReady) this.onEvent('ready');
      p.wasReady = r;
    }
    // never get stuck with no money, seeds or crops
    const growing = this.plots.some((p) => p.crop);
    const haveSeeds = CROPS.some((c) => this.seeds[c.id] > 0);
    const haveCrops = CROPS.some((c) => this.crops[c.id] > 0);
    if (!growing && !haveSeeds && !haveCrops && this.coins < CROP_BY_ID.radish.seedCost) {
      this.seeds.radish += 3;
      this.say('A neighbor gave you 3 radish seeds!', 3);
      this.save();
    }
    this.saveT += dt;
    if (this.saveT > 5) {
      this.saveT = 0;
      this.save();
    }
  }
}

export function fmtTime(ms: number) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}
