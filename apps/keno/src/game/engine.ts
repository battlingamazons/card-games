import { shuffle } from '@card-games/shared';

export const START_CREDITS = 100;
export const REFILL_CREDITS = 25;
export const BETS = [1, 2, 5, 10];
export const POOL = 80;
export const DRAWN = 20;
export const MAX_PICKS = 10;

/** PAY[picks][hits] = multiplier on the bet; missing means no win. */
export const PAY: Record<number, Record<number, number>> = {
  1: { 1: 3 },
  2: { 2: 12 },
  3: { 3: 42, 2: 2 },
  4: { 4: 100, 3: 5, 2: 1 },
  5: { 5: 400, 4: 15, 3: 2 },
  6: { 6: 1500, 5: 50, 4: 5, 3: 1 },
  7: { 7: 5000, 6: 100, 5: 11, 4: 2, 3: 1 },
  8: { 8: 10000, 7: 300, 6: 50, 5: 10, 4: 2 },
  9: { 9: 25000, 8: 2000, 7: 100, 6: 20, 5: 5, 4: 2 },
  10: { 10: 100000, 9: 2500, 8: 300, 7: 50, 6: 10, 5: 3 },
};

export function payoutFor(picks: number, hits: number): number {
  return PAY[picks]?.[hits] ?? 0;
}

export interface Snapshot {
  phase: 'pick' | 'result';
  credits: number;
  bet: number;
  picks: number[];
  /** The 20 numbers drawn on the last play, in draw order (empty before the first play). */
  drawn: number[];
  hits: number;
  win: number;
  best: number;
  note: string;
}

const STORE_KEY = 'keno-v1';

interface Saved {
  credits: number;
  bet: number;
  best: number;
  picks: number[];
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.credits) && Number.isFinite(s.best)) {
      const picks = Array.isArray(s.picks)
        ? [...new Set<number>(s.picks.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= POOL))].slice(0, MAX_PICKS)
        : [];
      return { credits: s.credits, bet: BETS.includes(s.bet) ? s.bet : 2, best: s.best, picks };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { credits: START_CREDITS, bet: 2, best: START_CREDITS, picks: [] };
}

export class KenoGame {
  private rng: () => number;
  private credits: number;
  private bet: number;
  private best: number;
  private picks: Set<number>;
  private drawn: number[] = [];
  private hits = 0;
  private win = 0;
  private note = '';

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    const s = load();
    this.credits = s.credits;
    this.bet = s.bet;
    this.best = s.best;
    this.picks = new Set(s.picks);
    if (this.credits < 1) {
      this.credits = REFILL_CREDITS;
      this.note = `The machine pities you  +${REFILL_CREDITS}`;
    }
    this.fitBet();
  }

  private fitBet() {
    if (this.bet > this.credits) this.bet = [...BETS].reverse().find((b) => b <= this.credits) ?? 1;
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ credits: this.credits, bet: this.bet, best: this.best, picks: [...this.picks] }));
    } catch {
      /* ignore */
    }
  }

  getSnapshot(): Snapshot {
    return {
      phase: this.drawn.length ? 'result' : 'pick',
      credits: this.credits,
      bet: this.bet,
      picks: [...this.picks].sort((a, b) => a - b),
      drawn: this.drawn.slice(),
      hits: this.hits,
      win: this.win,
      best: this.best,
      note: this.note,
    };
  }

  private clearDraw() {
    this.drawn = [];
    this.hits = 0;
    this.win = 0;
    this.note = '';
  }

  toggle(n: number) {
    if (n < 1 || n > POOL) return;
    this.clearDraw();
    if (this.picks.has(n)) this.picks.delete(n);
    else if (this.picks.size < MAX_PICKS) this.picks.add(n);
    else this.note = `Max ${MAX_PICKS} numbers`;
    this.save();
  }

  clearPicks() {
    this.clearDraw();
    this.picks.clear();
    this.save();
  }

  setBet(b: number) {
    if (!BETS.includes(b)) return;
    this.bet = b;
    this.fitBet();
    this.save();
  }

  /**
   * Play a round: the 20 drawn numbers and the payout are decided and saved right away; the UI
   * reveals the draw one ball at a time.
   */
  play(): boolean {
    this.note = '';
    if (!this.picks.size) {
      this.note = 'Pick some numbers first';
      return false;
    }
    if (this.credits < this.bet) {
      this.note = 'Not enough credits';
      return false;
    }
    const pool = Array.from({ length: POOL }, (_, i) => i + 1);
    this.drawn = shuffle(pool, this.rng).slice(0, DRAWN);
    this.hits = this.drawn.filter((n) => this.picks.has(n)).length;
    this.win = payoutFor(this.picks.size, this.hits) * this.bet;
    this.credits += this.win - this.bet;
    this.best = Math.max(this.best, this.credits);
    this.save();
    return true;
  }

  /** Called once the UI has revealed the whole draw. */
  finish() {
    if (this.credits < 1) {
      this.credits = REFILL_CREDITS;
      this.note = `The machine pities you  +${REFILL_CREDITS}`;
    }
    this.fitBet();
    this.save();
  }

  reset() {
    this.credits = START_CREDITS;
    this.bet = 2;
    this.best = START_CREDITS;
    this.picks.clear();
    this.clearDraw();
    this.save();
  }
}
