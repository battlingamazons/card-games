export type Phase = 'bet' | 'spin';

export const START_CREDITS = 100;
export const REFILL_CREDITS = 25;
export const CHIPS = [1, 5, 10, 25];

/** European wheel order, clockwise from the zero. */
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type Color = 'red' | 'black' | 'green';
export function colorOf(n: number): Color {
  return n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
}

export interface Cell {
  id: number;
  label: string;
  /** Numbers this bet covers. */
  nums: number[];
  /** Pays this many times the stake (the stake itself is also returned). */
  pay: number;
  /** Table position, 1-based CSS grid lines of the 14-column board. */
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  tone: Color | 'plain';
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Every place you can put a chip, laid out like a real table (zero, 12x3 numbers, columns, dozens, even-money). */
export const CELLS: Cell[] = (() => {
  const cells: Cell[] = [];
  const add = (c: Omit<Cell, 'id'>) => cells.push({ ...c, id: cells.length });
  add({ label: '0', nums: [0], pay: 35, row: 1, col: 1, rowSpan: 3, colSpan: 1, tone: 'green' });
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 3; row++) {
      const n = col * 3 + (3 - row);
      add({ label: String(n), nums: [n], pay: 35, row: row + 1, col: col + 2, rowSpan: 1, colSpan: 1, tone: colorOf(n) });
    }
  }
  for (let row = 0; row < 3; row++) {
    add({ label: '2:1', nums: range(1, 36).filter((n) => n % 3 === (3 - row) % 3), pay: 2, row: row + 1, col: 14, rowSpan: 1, colSpan: 1, tone: 'plain' });
  }
  ['1st 12', '2nd 12', '3rd 12'].forEach((label, i) =>
    add({ label, nums: range(i * 12 + 1, i * 12 + 12), pay: 2, row: 4, col: 2 + i * 4, rowSpan: 1, colSpan: 4, tone: 'plain' }),
  );
  const outside: [string, (n: number) => boolean, Cell['tone']][] = [
    ['1–18', (n) => n <= 18, 'plain'],
    ['Even', (n) => n % 2 === 0, 'plain'],
    ['Red', (n) => RED.has(n), 'red'],
    ['Black', (n) => !RED.has(n), 'black'],
    ['Odd', (n) => n % 2 === 1, 'plain'],
    ['19–36', (n) => n >= 19, 'plain'],
  ];
  outside.forEach(([label, f, tone], i) =>
    add({ label, nums: range(1, 36).filter(f), pay: 1, row: 5, col: 2 + i * 2, rowSpan: 1, colSpan: 2, tone }),
  );
  return cells;
})();

export interface Snapshot {
  phase: Phase;
  /** Credits not currently sitting on the table. */
  available: number;
  bets: Record<number, number>;
  staked: number;
  chip: number;
  history: number[];
  /** Winning number of the spin in progress / just finished, or -1. */
  result: number;
  /** Net credits won on the last spin (positive), 0 if break-even/lost. */
  win: number;
  /** Total credits returned by the last spin, stakes included. */
  payout: number;
  lastStake: number;
  best: number;
  note: string;
}

const STORE_KEY = 'roulette-v1';

function load(): { credits: number; chip: number; best: number; history: number[] } {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.credits) && Number.isFinite(s.best)) {
      return {
        credits: s.credits,
        chip: CHIPS.includes(s.chip) ? s.chip : 5,
        best: s.best,
        history: Array.isArray(s.history) ? s.history.filter((n: unknown) => Number.isInteger(n)).slice(0, 8) : [],
      };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { credits: START_CREDITS, chip: 5, best: START_CREDITS, history: [] };
}

export class RouletteGame {
  private rng: () => number;
  private phase: Phase = 'bet';
  private credits: number;
  private chip: number;
  private best: number;
  private history: number[];
  private bets: Record<number, number> = {};
  /** Order chips were placed in, for undo. */
  private order: { id: number; amt: number }[] = [];
  private result = -1;
  private win = 0;
  private payout = 0;
  private lastStake = 0;
  private note = '';

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    const s = load();
    this.credits = s.credits;
    this.chip = s.chip;
    this.best = s.best;
    this.history = s.history;
    if (this.credits < 1) {
      this.credits = REFILL_CREDITS;
      this.note = `The table pities you  +${REFILL_CREDITS}`;
    }
    this.fitChip();
  }

  private staked(): number {
    return Object.values(this.bets).reduce((a, b) => a + b, 0);
  }

  /** The chip in hand can't be bigger than what's left to bet. */
  private fitChip() {
    const avail = this.credits - this.staked();
    if (this.chip > avail) this.chip = [...CHIPS].reverse().find((c) => c <= avail) ?? 1;
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ credits: this.credits, chip: this.chip, best: this.best, history: this.history }));
    } catch {
      /* ignore */
    }
  }

  getSnapshot(): Snapshot {
    const staked = this.staked();
    return {
      phase: this.phase,
      available: this.credits - staked,
      bets: { ...this.bets },
      staked,
      chip: this.chip,
      history: this.history.slice(),
      result: this.result,
      win: this.win,
      payout: this.payout,
      lastStake: this.lastStake,
      best: this.best,
      note: this.note,
    };
  }

  setChip(c: number) {
    if (this.phase === 'spin' || !CHIPS.includes(c)) return;
    this.chip = c;
    this.fitChip();
    this.save();
  }

  placeBet(cellId: number) {
    if (this.phase === 'spin' || !CELLS[cellId]) return;
    this.clearResult();
    if (this.credits - this.staked() < this.chip) {
      this.note = 'Not enough credits';
      return;
    }
    this.bets[cellId] = (this.bets[cellId] ?? 0) + this.chip;
    this.order.push({ id: cellId, amt: this.chip });
    this.fitChip();
  }

  /** Take back the most recently placed chip. */
  undo() {
    if (this.phase === 'spin') return;
    const last = this.order.pop();
    if (!last) return;
    this.bets[last.id] -= last.amt;
    if (this.bets[last.id] <= 0) delete this.bets[last.id];
    this.note = '';
  }

  clearBets() {
    if (this.phase === 'spin') return;
    this.bets = {};
    this.order = [];
    this.note = '';
  }

  private clearResult() {
    if (this.result !== -1) {
      this.result = -1;
      this.win = 0;
    }
    this.note = '';
  }

  /** Spin the wheel. The result and payouts are decided and saved right away; the UI animates toward `result`. */
  spin() {
    if (this.phase === 'spin') return;
    const staked = this.staked();
    if (staked < 1) {
      this.note = 'Place a bet first';
      return;
    }
    this.note = '';
    this.result = Math.floor(this.rng() * 37);
    let pay = 0;
    for (const [id, amt] of Object.entries(this.bets)) {
      if (CELLS[Number(id)].nums.includes(this.result)) pay += amt * (CELLS[Number(id)].pay + 1);
    }
    this.credits += pay - staked;
    this.win = Math.max(0, pay - staked);
    this.payout = pay;
    this.lastStake = staked;
    this.best = Math.max(this.best, this.credits);
    this.history.unshift(this.result);
    this.history = this.history.slice(0, 8);
    this.bets = {};
    this.order = [];
    this.phase = 'spin';
    this.save();
  }

  /** Called by the UI once the ball has settled. */
  finish() {
    if (this.phase !== 'spin') return;
    this.phase = 'bet';
    if (this.credits < 1) {
      this.credits = REFILL_CREDITS;
      this.note = `The table pities you  +${REFILL_CREDITS}`;
    }
    this.fitChip();
    this.save();
  }

  reset() {
    this.credits = START_CREDITS;
    this.chip = 5;
    this.best = START_CREDITS;
    this.history = [];
    this.bets = {};
    this.order = [];
    this.result = -1;
    this.win = 0;
    this.payout = 0;
    this.lastStake = 0;
    this.note = '';
    this.phase = 'bet';
    this.save();
  }
}
