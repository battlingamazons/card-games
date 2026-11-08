export const START_CREDITS = 100;
export const REFILL_CREDITS = 25;
export const SPOTS = 6;

export interface Tier {
  name: string;
  price: number;
  /** Ticket colours: [top, bottom, accent]. */
  theme: [string, string, string];
}

export const TIERS: Tier[] = [
  { name: 'Lucky Clover', price: 1, theme: ['#2fa84f', '#176a32', '#ffe08a'] },
  { name: 'Gold Rush', price: 5, theme: ['#e0a92a', '#8a5a0a', '#fff2c0'] },
  { name: 'Diamond Deluxe', price: 10, theme: ['#5a4ad0', '#2a1f7a', '#bfe6ff'] },
];

export interface Symbol {
  ch: string;
  name: string;
  /** Prize for matching three, as a multiple of the ticket price. */
  mult: number;
  /** Chance a ticket wins with this symbol. */
  p: number;
}

/** Matching three of a kind pays that symbol's prize. Tickets win about one time in five. */
export const SYMBOLS: Symbol[] = [
  { ch: '🍒', name: 'Cherries', mult: 1, p: 0.09 },
  { ch: '🍋', name: 'Lemons', mult: 2, p: 0.06 },
  { ch: '🔔', name: 'Bells', mult: 5, p: 0.035 },
  { ch: '⭐', name: 'Stars', mult: 10, p: 0.015 },
  { ch: '💎', name: 'Diamonds', mult: 25, p: 0.006 },
  { ch: '7️⃣', name: 'Sevens', mult: 100, p: 0.0008 },
];

export interface Ticket {
  tier: number;
  /** Symbol index (into SYMBOLS) hidden under each of the six spots. */
  symbols: number[];
  revealed: boolean[];
  /** Credits this ticket pays once finished. */
  prize: number;
  /** True once every spot is revealed and the prize has been paid. */
  settled: boolean;
}

/** The prize a set of six symbols pays at a given ticket price (0 if no symbol appears three times). */
export function evalSymbols(symbols: number[], price: number): number {
  const counts = new Array(SYMBOLS.length).fill(0);
  for (const s of symbols) counts[s]++;
  let best = 0;
  counts.forEach((n, id) => {
    if (n >= 3) best = Math.max(best, SYMBOLS[id].mult * price);
  });
  return best;
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Decide the outcome first, then lay out symbols that show it: a winner has exactly three of the prize
 * symbol and no other triple; a loser never shows a symbol three times (but is full of near misses).
 */
export function makeSymbols(rng: () => number): number[] {
  let r = rng();
  let win = -1;
  for (let id = 0; id < SYMBOLS.length; id++) {
    r -= SYMBOLS[id].p;
    if (r < 0) {
      win = id;
      break;
    }
  }
  const counts = new Array(SYMBOLS.length).fill(0);
  const out: number[] = [];
  if (win >= 0) {
    for (let i = 0; i < 3; i++) out.push(win);
    counts[win] = 3;
  }
  while (out.length < SPOTS) {
    const id = Math.floor(rng() * SYMBOLS.length);
    if (counts[id] >= 2) continue;
    counts[id]++;
    out.push(id);
  }
  return shuffled(out, rng);
}

export interface Snapshot {
  credits: number;
  best: number;
  tier: number;
  ticket: Ticket | null;
  /** The prize just paid when the last ticket finished, else 0. */
  lastWin: number;
  refilled: boolean;
}

const STORE_KEY = 'scratch-v1';

interface Saved {
  credits: number;
  best: number;
  tier: number;
  ticket: Ticket | null;
}

function validTicket(t: unknown): t is Ticket {
  if (!t || typeof t !== 'object') return false;
  const k = t as Ticket;
  return (
    Number.isInteger(k.tier) &&
    k.tier >= 0 &&
    k.tier < TIERS.length &&
    Array.isArray(k.symbols) &&
    k.symbols.length === SPOTS &&
    k.symbols.every((s) => Number.isInteger(s) && s >= 0 && s < SYMBOLS.length) &&
    Array.isArray(k.revealed) &&
    k.revealed.length === SPOTS &&
    Number.isFinite(k.prize) &&
    typeof k.settled === 'boolean'
  );
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.credits) && Number.isFinite(s.best)) {
      return { credits: s.credits, best: s.best, tier: Number.isInteger(s.tier) && s.tier >= 0 && s.tier < TIERS.length ? s.tier : 0, ticket: validTicket(s.ticket) ? s.ticket : null };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { credits: START_CREDITS, best: START_CREDITS, tier: 0, ticket: null };
}

export class ScratchGame {
  private rng: () => number;
  private credits: number;
  private best: number;
  private tier: number;
  private ticket: Ticket | null;
  private lastWin = 0;
  private refilled = false;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    const s = load();
    this.credits = s.credits;
    this.best = s.best;
    this.tier = s.tier;
    this.ticket = s.ticket;
    if (this.credits < 1 && (!this.ticket || this.ticket.settled)) this.refill();
    this.fitTier();
  }

  private refill() {
    this.credits = REFILL_CREDITS;
    this.refilled = true;
  }

  /** Can't pick a ticket you can't afford. */
  private fitTier() {
    if (TIERS[this.tier].price > this.credits) {
      const affordable = TIERS.map((t, i) => ({ t, i })).filter(({ t }) => t.price <= this.credits);
      this.tier = affordable.length ? affordable[affordable.length - 1].i : 0;
    }
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ credits: this.credits, best: this.best, tier: this.tier, ticket: this.ticket }));
    } catch {
      /* ignore */
    }
  }

  getSnapshot(): Snapshot {
    return {
      credits: this.credits,
      best: this.best,
      tier: this.tier,
      ticket: this.ticket ? { ...this.ticket, symbols: this.ticket.symbols.slice(), revealed: this.ticket.revealed.slice() } : null,
      lastWin: this.lastWin,
      refilled: this.refilled,
    };
  }

  /** True while there is a bought ticket that still has spots left to scratch. */
  get active(): boolean {
    return !!this.ticket && !this.ticket.settled;
  }

  setTier(i: number) {
    if (this.active || i < 0 || i >= TIERS.length) return;
    this.tier = i;
    this.fitTier();
    this.save();
  }

  /** Buy a ticket at the selected price. The layout is decided now and saved, so it survives closing the app. */
  buy(): boolean {
    if (this.active) return false;
    this.refilled = false;
    this.lastWin = 0;
    if (this.credits < 1) this.refill();
    this.fitTier();
    const price = TIERS[this.tier].price;
    if (this.credits < price) return false;
    this.credits -= price;
    const symbols = makeSymbols(this.rng);
    this.ticket = { tier: this.tier, symbols, revealed: new Array(SPOTS).fill(false), prize: evalSymbols(symbols, price), settled: false };
    this.save();
    return true;
  }

  /** Mark one spot as scratched. When the last spot goes, the prize is paid. Returns true if the ticket just finished. */
  reveal(i: number): boolean {
    const t = this.ticket;
    if (!t || t.settled || i < 0 || i >= SPOTS || t.revealed[i]) return false;
    t.revealed[i] = true;
    if (t.revealed.every(Boolean)) return this.settle();
    this.save();
    return false;
  }

  revealAll(): boolean {
    const t = this.ticket;
    if (!t || t.settled) return false;
    t.revealed.fill(true);
    return this.settle();
  }

  private settle(): boolean {
    const t = this.ticket!;
    t.settled = true;
    this.credits += t.prize;
    this.lastWin = t.prize;
    this.best = Math.max(this.best, this.credits);
    if (this.credits < 1) this.refill();
    this.fitTier();
    this.save();
    return true;
  }

  reset() {
    this.credits = START_CREDITS;
    this.best = START_CREDITS;
    this.tier = 0;
    this.ticket = null;
    this.lastWin = 0;
    this.refilled = false;
    this.save();
  }
}
