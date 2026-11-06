import { type Card, freshDeck, shuffle } from '@card-games/shared';

export type Phase = 'bet' | 'play' | 'dealer' | 'result';
export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'dealer-blackjack';

export const START_CREDITS = 100;
export const REFILL_CREDITS = 25;
export const MIN_BET = 5;
export const BET_STEP = 5;

/** Best blackjack total (aces count 11 unless that busts). */
export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 1) {
      aces++;
      total += 11;
    } else {
      total += Math.min(c.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

export interface Snapshot {
  phase: Phase;
  credits: number;
  bet: number;
  player: Card[];
  dealer: Card[];
  holeHidden: boolean;
  playerTotal: number;
  /** Dealer total, counting only face-up cards while the hole card is hidden. */
  dealerTotal: number;
  freshPlayer: boolean[];
  freshDealer: boolean[];
  canDouble: boolean;
  outcome: Outcome | null;
  /** Net credits won (positive) on the last hand, 0 for a push, negative for a loss. */
  net: number;
  best: number;
  refilled: boolean;
}

const STORE_KEY = 'blackjack-v1';

function load(): { credits: number; bet: number; best: number } {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (s && Number.isFinite(s.credits) && Number.isFinite(s.best)) {
      return { credits: s.credits, bet: Number.isFinite(s.bet) ? s.bet : 10, best: s.best };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { credits: START_CREDITS, bet: 10, best: START_CREDITS };
}

export class BlackjackGame {
  private rng: () => number;
  private phase: Phase = 'bet';
  private credits: number;
  private bet: number;
  private best: number;
  private deck: Card[] = [];
  private player: Card[] = [];
  private dealer: Card[] = [];
  private holeHidden = false;
  private freshPlayer: boolean[] = [];
  private freshDealer: boolean[] = [];
  private outcome: Outcome | null = null;
  private net = 0;
  private refilled = false;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    const s = load();
    this.credits = s.credits;
    this.best = s.best;
    this.bet = s.bet;
    this.clampBet();
  }

  private clampBet() {
    const max = Math.max(MIN_BET, this.credits);
    this.bet = Math.max(MIN_BET, Math.min(max, Math.round(this.bet / BET_STEP) * BET_STEP));
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
      player: this.player.slice(),
      dealer: this.dealer.slice(),
      holeHidden: this.holeHidden,
      playerTotal: handValue(this.player),
      dealerTotal: handValue(this.holeHidden ? this.dealer.slice(0, 1) : this.dealer),
      freshPlayer: this.freshPlayer.slice(),
      freshDealer: this.freshDealer.slice(),
      canDouble: this.phase === 'play' && this.player.length === 2 && this.credits >= this.bet,
      outcome: this.outcome,
      net: this.net,
      best: this.best,
      refilled: this.refilled,
    };
  }

  betUp() {
    if (this.phase === 'play' || this.phase === 'dealer') return;
    this.bet = Math.min(Math.max(MIN_BET, this.credits), this.bet + BET_STEP);
    this.save();
  }

  betDown() {
    if (this.phase === 'play' || this.phase === 'dealer') return;
    this.bet = Math.max(MIN_BET, this.bet - BET_STEP);
    this.save();
  }

  deal() {
    if (this.phase === 'play' || this.phase === 'dealer') return;
    this.refilled = false;
    if (this.credits < MIN_BET) {
      this.credits = REFILL_CREDITS;
      this.refilled = true;
    }
    this.clampBet();
    this.bet = Math.min(this.bet, this.credits);
    this.credits -= this.bet;
    this.deck = shuffle(freshDeck(), this.rng);
    this.player = [this.deck.shift()!, this.deck.shift()!];
    this.dealer = [this.deck.shift()!, this.deck.shift()!];
    this.freshPlayer = [true, true];
    this.freshDealer = [true, true];
    this.holeHidden = true;
    this.outcome = null;
    this.net = 0;
    if (isBlackjack(this.player) || isBlackjack(this.dealer)) {
      this.finish();
    } else {
      this.phase = 'play';
    }
    this.save();
  }

  hit() {
    if (this.phase !== 'play') return;
    this.player.push(this.deck.shift()!);
    this.freshPlayer = this.player.map((_, i) => i === this.player.length - 1);
    this.freshDealer = this.dealer.map(() => false);
    const v = handValue(this.player);
    if (v > 21) this.finish();
    else if (v === 21) this.stand();
  }

  stand() {
    if (this.phase !== 'play') return;
    this.freshPlayer = this.player.map(() => false);
    this.phase = 'dealer';
  }

  doubleDown() {
    if (this.phase !== 'play' || this.player.length !== 2 || this.credits < this.bet) return;
    this.credits -= this.bet;
    this.bet *= 2;
    this.hit();
    if (this.phase === 'play') this.stand();
  }

  /** One dealer action: flip the hole card, then draw to 17. Call repeatedly while phase is 'dealer'. */
  dealerStep() {
    if (this.phase !== 'dealer') return;
    this.freshPlayer = this.player.map(() => false);
    this.freshDealer = this.dealer.map(() => false);
    if (this.holeHidden) {
      this.holeHidden = false;
    } else if (handValue(this.dealer) < 17) {
      this.dealer.push(this.deck.shift()!);
      this.freshDealer = this.dealer.map((_, i) => i === this.dealer.length - 1);
    } else {
      this.finish();
    }
  }

  private finish() {
    const pv = handValue(this.player);
    const dv = handValue(this.dealer);
    const pbj = isBlackjack(this.player);
    const dbj = isBlackjack(this.dealer);
    let payout = 0;
    if (pv > 21) this.outcome = 'bust';
    else if (pbj && !dbj) {
      payout = Math.floor(this.bet * 2.5);
      this.outcome = 'blackjack';
    } else if (dbj && !pbj) this.outcome = 'dealer-blackjack';
    else if (dv > 21 || pv > dv) {
      payout = this.bet * 2;
      this.outcome = 'win';
    } else if (pv === dv) {
      payout = this.bet;
      this.outcome = 'push';
    } else this.outcome = 'lose';

    this.holeHidden = false;
    this.net = payout - this.bet;
    this.credits += payout;
    this.best = Math.max(this.best, this.credits);
    this.phase = 'result';
    this.clampBet();
    this.save();
  }

  reset() {
    this.credits = START_CREDITS;
    this.bet = 10;
    this.best = START_CREDITS;
    this.phase = 'bet';
    this.player = [];
    this.dealer = [];
    this.holeHidden = false;
    this.freshPlayer = [];
    this.freshDealer = [];
    this.outcome = null;
    this.net = 0;
    this.refilled = false;
    this.save();
  }
}
