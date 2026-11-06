export type Phase = 'idle' | 'spin';

export const START_CREDITS = 100;
export const REFILL_CREDITS = 25;
export const MAX_BET = 5;
export const STRIP_LEN = 20;

export interface Symbol {
  name: string;
  /** How many of the 20 positions on every reel show this symbol. */
  weight: number;
  /** Payout multiplier (x bet) for three in a row. */
  pay: number;
}

/** Symbol 0..5; cheap and common first, the sevens are the jackpot. */
export const SYMBOLS: Symbol[] = [
  { name: 'Cherries', weight: 5, pay: 5 },
  { name: 'Lemons', weight: 5, pay: 8 },
  { name: 'Bells', weight: 4, pay: 15 },
  { name: 'Bars', weight: 3, pay: 30 },
  { name: 'Diamonds', weight: 2, pay: 60 },
  { name: 'Sevens', weight: 1, pay: 150 },
];
export const TWO_CHERRIES_PAY = 2;

/** The fixed 20-position strip every reel shares, shuffled once with a seeded generator. */
export const STRIP: number[] = (() => {
  const strip: number[] = [];
  SYMBOLS.forEach((s, id) => {
    for (let i = 0; i < s.weight; i++) strip.push(id);
  });
  let seed = 77;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  return strip;
})();

/** Credits won for three reel symbols, with the name of the winning combo (or null). */
export function evalSpin(res: number[], bet: number): { win: number; name: string | null } {
  if (res[0] === res[1] && res[1] === res[2]) {
    return { win: SYMBOLS[res[0]].pay * bet, name: `Three ${SYMBOLS[res[0]].name}` };
  }
  if (res.filter((v) => v === 0).length === 2) return { win: TWO_CHERRIES_PAY * bet, name: 'Two Cherries' };
  return { win: 0, name: null };
}

export interface Snapshot {
  phase: Phase;
  credits: number;
  bet: number;
  /** Strip position under the payline for each reel. */
  pos: number[];
  /** Strip position each reel was at before the current spin. */
  from: number[];
  win: number;
  winName: string | null;
  best: number;
  refilled: boolean;
  spun: boolean;
}

const STORE_KEY = 'slots-v1';

function load(): { credits: number; bet: number; best: number } {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.credits) && Number.isFinite(s.best)) {
      return { credits: s.credits, bet: Number.isFinite(s.bet) ? s.bet : 3, best: s.best };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { credits: START_CREDITS, bet: 3, best: START_CREDITS };
}

export class SlotGame {
  private rng: () => number;
  private phase: Phase = 'idle';
  private credits: number;
  private bet: number;
  private best: number;
  private pos = [3, 9, 15];
  private from = [3, 9, 15];
  private win = 0;
  private winName: string | null = null;
  private refilled = false;
  private spun = false;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    const s = load();
    this.credits = s.credits;
    this.best = s.best;
    this.bet = s.bet;
    if (this.credits < 1) this.refill();
    this.clampBet();
  }

  private refill() {
    this.credits = REFILL_CREDITS;
    this.refilled = true;
  }

  private clampBet() {
    this.bet = Math.max(1, Math.min(MAX_BET, Math.max(1, this.credits), this.bet));
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ credits: this.credits, bet: this.bet, best: this.best }));
    } catch {
      /* ignore */
    }
  }

  getSnapshot(): Snapshot {
    return {
      phase: this.phase,
      credits: this.credits,
      bet: this.bet,
      pos: this.pos.slice(),
      from: this.from.slice(),
      win: this.win,
      winName: this.winName,
      best: this.best,
      refilled: this.refilled,
      spun: this.spun,
    };
  }

  /** Bet one more credit, wrapping from the max back to 1. */
  betOne() {
    if (this.phase === 'spin') return;
    this.bet = this.bet >= Math.min(MAX_BET, this.credits) ? 1 : this.bet + 1;
    this.save();
  }

  /** Pick a symbol by its weight, so symbol odds match their share of the strip. */
  private pickSymbol(): number {
    let t = this.rng() * STRIP_LEN;
    for (let id = 0; id < SYMBOLS.length; id++) {
      t -= SYMBOLS[id].weight;
      if (t < 0) return id;
    }
    return 0;
  }

  /**
   * Start a spin. The result and payout are decided and saved right away; the UI plays the
   * reel animation toward `pos` and calls `finish()` when the last reel stops.
   */
  spin() {
    if (this.phase === 'spin') return;
    this.refilled = false;
    if (this.credits < 1) this.refill();
    this.clampBet();
    this.credits -= this.bet;
    this.from = this.pos.slice();
    const res = [this.pickSymbol(), this.pickSymbol(), this.pickSymbol()];
    this.pos = res.map((id) => {
      const spots = STRIP.flatMap((s, k) => (s === id ? [k] : []));
      return spots[Math.floor(this.rng() * spots.length)];
    });
    const { win, name } = evalSpin(res, this.bet);
    this.win = win;
    this.winName = name;
    this.credits += win;
    this.best = Math.max(this.best, this.credits);
    this.phase = 'spin';
    this.spun = true;
    this.save();
  }

  /** Called by the UI once the reels have stopped. */
  finish() {
    if (this.phase !== 'spin') return;
    this.phase = 'idle';
    this.clampBet();
    this.save();
  }

  reset() {
    this.credits = START_CREDITS;
    this.bet = 3;
    this.best = START_CREDITS;
    this.phase = 'idle';
    this.pos = [3, 9, 15];
    this.from = [3, 9, 15];
    this.win = 0;
    this.winName = null;
    this.refilled = false;
    this.spun = false;
    this.save();
  }
}
