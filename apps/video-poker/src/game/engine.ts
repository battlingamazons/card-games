import { type Card, freshDeck, shuffle } from '@card-games/shared';

export type Phase = 'bet' | 'hold' | 'result';

export interface PayRow {
  name: string;
  mult: number;
}

/** Jacks or Better pay table, best hand first. Payout is `mult` x the bet. */
export const PAY_TABLE: PayRow[] = [
  { name: 'Royal Flush', mult: 250 },
  { name: 'Straight Flush', mult: 50 },
  { name: 'Four of a Kind', mult: 25 },
  { name: 'Full House', mult: 9 },
  { name: 'Flush', mult: 6 },
  { name: 'Straight', mult: 4 },
  { name: 'Three of a Kind', mult: 3 },
  { name: 'Two Pair', mult: 2 },
  { name: 'Jacks or Better', mult: 1 },
];

export const START_CREDITS = 100;
export const REFILL_CREDITS = 25;
export const MAX_BET = 5;

/** Index into PAY_TABLE for the hand, or -1 if it doesn't pay. */
export function evalHand(hand: Card[]): number {
  const ranks = hand.map((c) => (c.rank === 1 ? 14 : c.rank)).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const flush = hand.every((c) => c.suit === hand[0].suit);
  const straight = counts.size === 5 && (ranks[4] - ranks[0] === 4 || ranks.join() === '2,3,4,5,14');

  if (flush && straight && ranks[0] === 10) return 0;
  if (flush && straight) return 1;
  if (groups[0] === 4) return 2;
  if (groups[0] === 3 && groups[1] === 2) return 3;
  if (flush) return 4;
  if (straight) return 5;
  if (groups[0] === 3) return 6;
  if (groups[0] === 2 && groups[1] === 2) return 7;
  if (groups[0] === 2 && [...counts].some(([r, n]) => n === 2 && r >= 11)) return 8;
  return -1;
}

export interface Snapshot {
  phase: Phase;
  credits: number;
  bet: number;
  hand: Card[];
  held: boolean[];
  /** Which cards are newly dealt by the last deal/draw (for animation). */
  fresh: boolean[];
  winRow: number;
  win: number;
  best: number;
  refilled: boolean;
}

const STORE_KEY = 'video-poker-v1';

interface Saved {
  credits: number;
  bet: number;
  best: number;
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.credits) && Number.isFinite(s.best)) {
      return { credits: s.credits, bet: Number.isFinite(s.bet) ? s.bet : MAX_BET, best: s.best };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { credits: START_CREDITS, bet: MAX_BET, best: START_CREDITS };
}

export class VideoPokerGame {
  private phase: Phase = 'bet';
  private credits: number;
  private bet: number;
  private best: number;
  private deck: Card[] = [];
  private hand: Card[] = [];
  private held: boolean[] = [false, false, false, false, false];
  private fresh: boolean[] = [false, false, false, false, false];
  private winRow = -1;
  private win = 0;
  private refilled = false;

  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    const s = load();
    this.credits = s.credits;
    this.best = s.best;
    this.bet = Math.max(1, Math.min(MAX_BET, s.bet));
    if (this.credits < 1) this.refill();
    this.bet = Math.min(this.bet, this.credits);
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ credits: this.credits, bet: this.bet, best: this.best }));
    } catch {
      /* ignore */
    }
  }

  private refill() {
    this.credits = REFILL_CREDITS;
    this.refilled = true;
  }

  getSnapshot(): Snapshot {
    return {
      phase: this.phase,
      credits: this.credits,
      bet: this.bet,
      hand: this.hand.slice(),
      held: this.held.slice(),
      fresh: this.fresh.slice(),
      winRow: this.winRow,
      win: this.win,
      best: this.best,
      refilled: this.refilled,
    };
  }

  /** Bet one more credit, wrapping from the max back to 1. Only between hands. */
  betOne() {
    if (this.phase === 'hold') return;
    this.fresh = this.fresh.map(() => false);
    this.bet = this.bet >= Math.min(MAX_BET, this.credits) ? 1 : this.bet + 1;
    this.save();
  }

  betMax() {
    if (this.phase === 'hold') return;
    this.bet = Math.min(MAX_BET, this.credits);
    this.deal();
  }

  /** Start a hand (from the bet or result screen). */
  deal() {
    if (this.phase === 'hold') return;
    if (this.credits < 1) this.refill();
    this.bet = Math.min(this.bet, this.credits);
    this.credits -= this.bet;
    this.deck = shuffle(freshDeck(), this.rng);
    this.hand = this.deck.splice(0, 5);
    this.held = [false, false, false, false, false];
    this.fresh = [true, true, true, true, true];
    this.winRow = -1;
    this.win = 0;
    this.refilled = false;
    this.phase = 'hold';
    this.save();
  }

  toggleHold(i: number) {
    if (this.phase !== 'hold' || i < 0 || i > 4) return;
    this.held[i] = !this.held[i];
    this.fresh = this.fresh.map(() => false);
  }

  /** Replace every card that isn't held, then pay out. */
  draw() {
    if (this.phase !== 'hold') return;
    this.fresh = this.held.map((h) => !h);
    this.hand = this.hand.map((c, i) => (this.held[i] ? c : this.deck.shift()!));
    this.held = [false, false, false, false, false];
    this.winRow = evalHand(this.hand);
    this.win = this.winRow >= 0 ? PAY_TABLE[this.winRow].mult * this.bet : 0;
    this.credits += this.win;
    this.best = Math.max(this.best, this.credits);
    this.phase = 'result';
    this.save();
  }

  /** Reset the bank to the starting stake. */
  reset() {
    this.credits = START_CREDITS;
    this.bet = MAX_BET;
    this.best = START_CREDITS;
    this.phase = 'bet';
    this.hand = [];
    this.held = [false, false, false, false, false];
    this.fresh = [false, false, false, false, false];
    this.winRow = -1;
    this.win = 0;
    this.refilled = false;
    this.save();
  }
}
