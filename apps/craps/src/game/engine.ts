export const START_CREDITS = 100;
export const REFILL_CREDITS = 25;
export const CHIPS = [1, 5, 10, 25];
/** Free odds can be backed up to this many times the line bet. */
export const MAX_ODDS = 3;

export type BetId =
  | 'pass'
  | 'dontPass'
  | 'passOdds'
  | 'dontPassOdds'
  | 'field'
  | 'place4'
  | 'place5'
  | 'place6'
  | 'place8'
  | 'place9'
  | 'place10'
  | 'any7'
  | 'anyCraps'
  | 'eleven';

export const ALL_BETS: BetId[] = ['pass', 'dontPass', 'passOdds', 'dontPassOdds', 'field', 'place4', 'place5', 'place6', 'place8', 'place9', 'place10', 'any7', 'anyCraps', 'eleven'];
export const POINTS = [4, 5, 6, 8, 9, 10];
/** Bets that are settled by a single roll and then come down. */
const ONE_ROLL: BetId[] = ['field', 'any7', 'anyCraps', 'eleven'];
const LINE: BetId[] = ['pass', 'dontPass'];

/** [numerator, denominator] payouts. */
export const PLACE_PAY: Record<number, [number, number]> = { 4: [9, 5], 5: [7, 5], 6: [7, 6], 8: [7, 6], 9: [7, 5], 10: [9, 5] };
/** True odds paid on pass-line odds. */
export const ODDS_PAY: Record<number, [number, number]> = { 4: [2, 1], 5: [3, 2], 6: [6, 5], 8: [6, 5], 9: [3, 2], 10: [2, 1] };
/** Lay odds paid on don't-pass odds (the reverse). */
export const LAY_PAY: Record<number, [number, number]> = { 4: [1, 2], 5: [2, 3], 6: [5, 6], 8: [5, 6], 9: [2, 3], 10: [1, 2] };

const mul = (amt: number, [n, d]: [number, number]) => Math.floor((amt * n) / d);

export type Bets = Partial<Record<BetId, number>>;

export interface Snapshot {
  credits: number;
  available: number;
  staked: number;
  bets: Bets;
  point: number | null;
  dice: [number, number] | null;
  history: number[];
  /** What happened on the last roll, one line per bet. */
  lines: string[];
  /** Net credits won (+) or lost (-) on the last roll. */
  net: number;
  chip: number;
  best: number;
  note: string;
}

const STORE_KEY = 'craps-v1';

interface Saved {
  credits: number;
  best: number;
  chip: number;
  point: number | null;
  bets: Bets;
  history: number[];
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.credits) && Number.isFinite(s.best)) {
      const bets: Bets = {};
      for (const id of ALL_BETS) {
        const v = s.bets?.[id];
        if (Number.isFinite(v) && v > 0) bets[id] = Math.floor(v);
      }
      const point = POINTS.includes(s.point) ? s.point : null;
      return {
        credits: s.credits,
        best: s.best,
        chip: CHIPS.includes(s.chip) ? s.chip : 5,
        point,
        bets: point === null ? withoutOdds(bets) : bets,
        history: Array.isArray(s.history) ? s.history.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 2 && (n as number) <= 12).slice(0, 12) : [],
      };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { credits: START_CREDITS, best: START_CREDITS, chip: 5, point: null, bets: {}, history: [] };
}

/** Odds only make sense once a point is set, so a saved state without a point can't carry them. */
function withoutOdds(b: Bets): Bets {
  const out = { ...b };
  delete out.passOdds;
  delete out.dontPassOdds;
  return out;
}

export class CrapsGame {
  private rng: () => number;
  private credits: number;
  private best: number;
  private chip: number;
  private point: number | null;
  private bets: Bets;
  private history: number[];
  private dice: [number, number] | null = null;
  private lines: string[] = [];
  private net = 0;
  private note = '';
  /** Bets placed since the last roll, for undo. */
  private order: { id: BetId; amt: number }[] = [];

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    const s = load();
    this.credits = s.credits;
    this.best = s.best;
    this.chip = s.chip;
    this.point = s.point;
    this.bets = s.bets;
    this.history = s.history;
    if (this.credits < 1 && this.staked() === 0) this.refill();
    this.fitChip();
  }

  private refill() {
    this.credits = REFILL_CREDITS;
    this.note = `The table pities you  +${REFILL_CREDITS}`;
  }

  staked(): number {
    return Object.values(this.bets).reduce((a, b) => a + (b ?? 0), 0);
  }

  private fitChip() {
    const avail = this.credits - this.staked();
    if (this.chip > avail) this.chip = [...CHIPS].reverse().find((c) => c <= avail) ?? 1;
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ credits: this.credits, best: this.best, chip: this.chip, point: this.point, bets: this.bets, history: this.history }));
    } catch {
      /* ignore */
    }
  }

  getSnapshot(): Snapshot {
    const staked = this.staked();
    return {
      credits: this.credits,
      available: this.credits - staked,
      staked,
      bets: { ...this.bets },
      point: this.point,
      dice: this.dice,
      history: this.history.slice(),
      lines: this.lines.slice(),
      net: this.net,
      chip: this.chip,
      best: this.best,
      note: this.note,
    };
  }

  setChip(c: number) {
    if (!CHIPS.includes(c)) return;
    this.chip = c;
    this.fitChip();
    this.save();
  }

  /** Why a bet can't be placed right now, or null if it can. */
  blocked(id: BetId): string | null {
    const b = this.bets;
    if (id === 'pass' || id === 'dontPass') {
      if (this.point !== null) return 'Line bets go down before the come-out roll';
      if (id === 'pass' && b.dontPass) return "You're already on Don't Pass";
      if (id === 'dontPass' && b.pass) return "You're already on Pass";
    }
    if (id === 'passOdds') {
      if (this.point === null) return 'Odds need a point first';
      if (!b.pass) return 'Odds back up a Pass Line bet';
      if ((b.passOdds ?? 0) >= b.pass * MAX_ODDS) return `Max odds is ${MAX_ODDS}× the line bet`;
    }
    if (id === 'dontPassOdds') {
      if (this.point === null) return 'Odds need a point first';
      if (!b.dontPass) return "Odds back up a Don't Pass bet";
      if ((b.dontPassOdds ?? 0) >= b.dontPass * MAX_ODDS) return `Max odds is ${MAX_ODDS}× the line bet`;
    }
    return null;
  }

  placeBet(id: BetId) {
    this.note = '';
    const why = this.blocked(id);
    if (why) {
      this.note = why;
      return;
    }
    let amt = this.chip;
    if (id === 'passOdds') amt = Math.min(amt, this.bets.pass! * MAX_ODDS - (this.bets.passOdds ?? 0));
    if (id === 'dontPassOdds') amt = Math.min(amt, this.bets.dontPass! * MAX_ODDS - (this.bets.dontPassOdds ?? 0));
    if (this.credits - this.staked() < amt) {
      this.note = 'Not enough credits';
      return;
    }
    this.bets[id] = (this.bets[id] ?? 0) + amt;
    this.order.push({ id, amt });
    this.lines = [];
    this.net = 0;
    this.fitChip();
    this.save();
  }

  /** Take back the last chip placed since the roll. */
  undo() {
    const last = this.order.pop();
    if (!last) return;
    this.bets[last.id] = (this.bets[last.id] ?? 0) - last.amt;
    if ((this.bets[last.id] ?? 0) <= 0) delete this.bets[last.id];
    this.note = '';
    this.save();
  }

  /** Take down everything that is allowed to come down (line bets stay once a point is set). */
  clearBets() {
    for (const id of ALL_BETS) {
      if (this.point !== null && LINE.includes(id)) continue;
      delete this.bets[id];
    }
    this.order = this.order.filter((o) => this.bets[o.id] !== undefined);
    this.note = '';
    this.save();
  }

  /** Roll the dice and settle everything. The dice and payouts are saved immediately; the UI animates toward them. */
  roll(): boolean {
    if (this.staked() === 0) {
      this.note = 'Place a bet first';
      return false;
    }
    this.note = '';
    const d: [number, number] = [1 + Math.floor(this.rng() * 6), 1 + Math.floor(this.rng() * 6)];
    this.dice = d;
    const t = d[0] + d[1];
    this.history.unshift(t);
    this.history = this.history.slice(0, 12);
    this.lines = [];
    this.net = 0;
    this.order = [];
    const b = this.bets;
    const win = (label: string, amt: number) => {
      this.net += amt;
      this.lines.push(`${label} +${amt}`);
    };
    const lose = (id: BetId, label: string) => {
      const amt = b[id]!;
      this.net -= amt;
      this.lines.push(`${label} −${amt}`);
      delete b[id];
    };
    const take = (id: BetId, label: string, profit: number) => {
      win(label, profit);
      delete b[id];
    };

    if (this.point === null) {
      // Come-out roll.
      if (b.pass) {
        if (t === 7 || t === 11) take('pass', 'Pass Line wins', b.pass);
        else if (t === 2 || t === 3 || t === 12) lose('pass', 'Pass Line loses');
      }
      if (b.dontPass) {
        if (t === 2 || t === 3) take('dontPass', "Don't Pass wins", b.dontPass);
        else if (t === 7 || t === 11) lose('dontPass', "Don't Pass loses");
        else if (t === 12) {
          this.lines.push("Don't Pass pushes (bar 12)");
          delete b.dontPass;
        }
      }
      if (t >= 4 && t <= 10 && t !== 7) this.point = t;
    } else {
      const p = this.point;
      // Place bets work while a point is on.
      for (const n of POINTS) {
        const id = `place${n}` as BetId;
        if (!b[id]) continue;
        if (t === n) win(`Place ${n} pays`, mul(b[id]!, PLACE_PAY[n]));
        else if (t === 7) lose(id, `Place ${n} loses`);
      }
      if (t === p) {
        if (b.pass) take('pass', 'Pass Line wins', b.pass);
        if (b.passOdds) take('passOdds', 'Pass odds win', mul(b.passOdds, ODDS_PAY[p]));
        if (b.dontPass) lose('dontPass', "Don't Pass loses");
        if (b.dontPassOdds) lose('dontPassOdds', "Don't Pass odds lose");
        this.point = null;
      } else if (t === 7) {
        if (b.pass) lose('pass', 'Pass Line loses');
        if (b.passOdds) lose('passOdds', 'Pass odds lose');
        if (b.dontPass) take('dontPass', "Don't Pass wins", b.dontPass);
        if (b.dontPassOdds) take('dontPassOdds', "Don't Pass odds win", mul(b.dontPassOdds, LAY_PAY[p]));
        this.point = null;
      }
    }

    // One-roll bets.
    if (b.field) {
      if (t === 2) take('field', 'Field pays 2:1', b.field * 2);
      else if (t === 12) take('field', 'Field pays 3:1', b.field * 3);
      else if ([3, 4, 9, 10, 11].includes(t)) take('field', 'Field wins', b.field);
      else lose('field', 'Field loses');
    }
    if (b.any7) {
      if (t === 7) take('any7', 'Any Seven wins', b.any7 * 4);
      else lose('any7', 'Any Seven loses');
    }
    if (b.anyCraps) {
      if (t === 2 || t === 3 || t === 12) take('anyCraps', 'Any Craps wins', b.anyCraps * 7);
      else lose('anyCraps', 'Any Craps loses');
    }
    if (b.eleven) {
      if (t === 11) take('eleven', 'Eleven wins', b.eleven * 15);
      else lose('eleven', 'Eleven loses');
    }
    for (const id of ONE_ROLL) delete b[id];

    this.credits += this.net;
    this.best = Math.max(this.best, this.credits);
    if (this.credits < 1 && this.staked() === 0) this.refill();
    this.fitChip();
    this.save();
    return true;
  }

  reset() {
    this.credits = START_CREDITS;
    this.best = START_CREDITS;
    this.chip = 5;
    this.point = null;
    this.bets = {};
    this.order = [];
    this.history = [];
    this.dice = null;
    this.lines = [];
    this.net = 0;
    this.note = '';
    this.save();
  }
}
