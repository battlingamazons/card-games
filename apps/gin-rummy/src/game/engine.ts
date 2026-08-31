import { type Card, cardValue, freshDeck, shuffle } from '@card-games/shared';
import { aiChooseDiscard, aiWantsDiscard, aiWantsToKnock } from './ai';
import { bestBreakdown, canLayOff } from './melds';
import type { MeldBreakdown, Player, RoundEndInfo, TurnPhase } from './types';

const KNOCK_THRESHOLD = 10;
const GIN_BONUS = 25;
const UNDERCUT_BONUS = 25;
const MATCH_TARGET = 100;
const BOX_BONUS = 25;
const GAME_BONUS = 100;

export interface MatchState {
  scores: Record<Player, number>;
  boxes: Record<Player, number>;
  dealer: Player;
  matchOver: boolean;
  matchWinner: Player | null;
}

export interface Snapshot {
  phase: TurnPhase;
  currentPlayer: Player;
  dealer: Player;
  nonDealer: Player;
  upcardDecisionStage: 'non-dealer' | 'dealer' | null;
  humanHand: Card[];
  aiHandCount: number;
  stockCount: number;
  discardTop: Card | null;
  match: MatchState;
  roundEnd: RoundEndInfo | null;
  lastAiDiscard: Card | null;
}

function other(p: Player): Player {
  return p === 'human' ? 'ai' : 'human';
}

export class GinRummyGame {
  private deck: Card[] = [];
  private stock: Card[] = [];
  private discardPile: Card[] = [];
  private hands: Record<Player, Card[]> = { human: [], ai: [] };

  private phase: TurnPhase = 'draw';
  private currentPlayer: Player = 'human';
  private dealer: Player;
  private upcardDecisionStage: 'non-dealer' | 'dealer' | null = null;
  private roundEnd: RoundEndInfo | null = null;
  private lastAiDiscard: Card | null = null;

  private scores: Record<Player, number> = { human: 0, ai: 0 };
  private boxes: Record<Player, number> = { human: 0, ai: 0 };
  private matchOver = false;
  private matchWinner: Player | null = null;

  constructor() {
    this.dealer = Math.random() < 0.5 ? 'human' : 'ai';
    this.startRound();
  }

  private get nonDealer(): Player {
    return other(this.dealer);
  }

  startRound() {
    this.deck = shuffle(freshDeck());
    this.stock = this.deck.slice();
    this.hands.human = this.stock.splice(0, 10);
    this.hands.ai = this.stock.splice(0, 10);
    this.discardPile = [this.stock.pop()!];
    this.roundEnd = null;
    this.lastAiDiscard = null;
    this.phase = 'upcard-decision';
    this.upcardDecisionStage = 'non-dealer';
    this.currentPlayer = this.nonDealer;
  }

  private nextMatchRound() {
    if (this.matchOver) return;
    this.startRound();
  }

  getSnapshot(): Snapshot {
    return {
      phase: this.phase,
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      nonDealer: this.nonDealer,
      upcardDecisionStage: this.upcardDecisionStage,
      humanHand: this.hands.human.slice().sort(sortHand),
      aiHandCount: this.hands.ai.length,
      stockCount: this.stock.length,
      discardTop: this.discardPile[this.discardPile.length - 1] ?? null,
      match: {
        scores: { ...this.scores },
        boxes: { ...this.boxes },
        dealer: this.dealer,
        matchOver: this.matchOver,
        matchWinner: this.matchWinner,
      },
      roundEnd: this.roundEnd,
      lastAiDiscard: this.lastAiDiscard,
    };
  }

  humanHandBreakdown(): MeldBreakdown {
    return bestBreakdown(this.hands.human);
  }

  // ---- Human actions ----

  takeUpcard(player: Player) {
    if (this.phase !== 'upcard-decision' || this.currentPlayer !== player) return;
    const card = this.discardPile.pop()!;
    this.hands[player].push(card);
    this.phase = 'discard';
    this.currentPlayer = player;
    this.upcardDecisionStage = null;
  }

  passUpcard(player: Player) {
    if (this.phase !== 'upcard-decision' || this.currentPlayer !== player) return;
    if (this.upcardDecisionStage === 'non-dealer') {
      this.upcardDecisionStage = 'dealer';
      this.currentPlayer = this.dealer;
    } else {
      this.upcardDecisionStage = null;
      this.phase = 'draw';
      this.currentPlayer = this.nonDealer;
    }
  }

  drawFromStock(player: Player) {
    if (this.phase !== 'draw' || this.currentPlayer !== player) return;
    if (this.stock.length <= 2) {
      this.endRoundStalemate();
      return;
    }
    const card = this.stock.pop()!;
    this.hands[player].push(card);
    this.phase = 'discard';
  }

  drawFromDiscardPile(player: Player) {
    if (this.phase !== 'draw' || this.currentPlayer !== player || this.discardPile.length === 0) return;
    const card = this.discardPile.pop()!;
    this.hands[player].push(card);
    this.phase = 'discard';
  }

  discard(player: Player, cardId: string) {
    if (this.phase !== 'discard' || this.currentPlayer !== player) return;
    const hand = this.hands[player];
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return;
    const [card] = hand.splice(idx, 1);
    this.discardPile.push(card);
    if (player === 'ai') this.lastAiDiscard = card;
    this.currentPlayer = other(player);
    this.phase = 'draw';
  }

  /** Discard cardId and knock/gin, ending the round. Validates deadwood <= 10. */
  knock(player: Player, cardId: string): boolean {
    if (this.phase !== 'discard' || this.currentPlayer !== player) return false;
    const hand = this.hands[player];
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return false;
    const remaining = hand.slice(0, idx).concat(hand.slice(idx + 1));
    const breakdown = bestBreakdown(remaining);
    if (breakdown.deadwoodValue > KNOCK_THRESHOLD) return false;

    const [card] = hand.splice(idx, 1);
    this.discardPile.push(card);
    this.finalizeKnock(player, breakdown);
    return true;
  }

  // ---- AI turn ----

  /** Is it the AI's move right now (as opposed to waiting on the human, or the round being over)? */
  isAiTurnPending(): boolean {
    return (
      this.currentPlayer === 'ai' &&
      (this.phase === 'upcard-decision' || this.phase === 'draw' || this.phase === 'discard')
    );
  }

  /** Perform exactly one AI micro-action (a single decision). Call in a loop, paced by the caller, until isAiTurnPending() is false. */
  runAiStep() {
    if (!this.isAiTurnPending()) return;

    if (this.phase === 'upcard-decision') {
      const top = this.discardPile[this.discardPile.length - 1];
      if (top && aiWantsDiscard(this.hands.ai, top)) {
        this.takeUpcard('ai');
      } else {
        this.passUpcard('ai');
      }
    } else if (this.phase === 'draw') {
      if (this.stock.length <= 2) {
        this.endRoundStalemate();
        return;
      }
      const top = this.discardPile[this.discardPile.length - 1];
      if (top && aiWantsDiscard(this.hands.ai, top)) {
        this.drawFromDiscardPile('ai');
      } else {
        this.drawFromStock('ai');
      }
    } else if (this.phase === 'discard') {
      const hand = this.hands.ai;
      // Try every possible discard to see if any legal knock exists; prefer
      // the one with lowest resulting deadwood.
      let knockCard: Card | null = null;
      let bestDeadwood = Infinity;
      for (const card of hand) {
        const rest = hand.filter((c) => c.id !== card.id);
        const { deadwoodValue } = bestBreakdown(rest);
        if (deadwoodValue <= KNOCK_THRESHOLD && deadwoodValue < bestDeadwood) {
          bestDeadwood = deadwoodValue;
          knockCard = card;
        }
      }
      if (knockCard && aiWantsToKnock(hand.filter((c) => c.id !== knockCard!.id))) {
        this.knock('ai', knockCard.id);
        return;
      }
      const discardCard = aiChooseDiscard(hand);
      this.discard('ai', discardCard.id);
    }
  }

  // ---- Round resolution ----

  private finalizeKnock(knocker: Player, knockerBreakdown: MeldBreakdown) {
    const defender = other(knocker);
    const defenderBreakdown = bestBreakdown(this.hands[defender]);
    const layoffs: { card: Card; ontoMeldIndex: number }[] = [];

    if (knockerBreakdown.deadwoodValue === 0) {
      // Gin: no lay-offs allowed.
      const points = defenderBreakdown.deadwoodValue + GIN_BONUS;
      this.awardRound({
        type: 'gin',
        knocker,
        winner: knocker,
        knockerDeadwood: 0,
        defenderDeadwood: defenderBreakdown.deadwoodValue,
        pointsAwarded: points,
        bonus: GIN_BONUS,
        knockerBreakdown,
        defenderBreakdown,
        layoffs,
      });
      return;
    }

    // Greedily lay off defender's deadwood cards onto the knocker's melds.
    const remainingDeadwood = defenderBreakdown.deadwood.slice();
    const melds = knockerBreakdown.melds.map((m) => m.slice());
    let laidOffValue = 0;
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = remainingDeadwood.length - 1; i >= 0; i--) {
        const card = remainingDeadwood[i];
        const meldIndex = melds.findIndex((m) => canLayOff(m, card));
        if (meldIndex !== -1) {
          melds[meldIndex].push(card);
          laidOffValue += cardValue(card);
          layoffs.push({ card, ontoMeldIndex: meldIndex });
          remainingDeadwood.splice(i, 1);
          changed = true;
        }
      }
    }

    const defenderDeadwoodAfter = defenderBreakdown.deadwoodValue - laidOffValue;

    if (defenderDeadwoodAfter <= knockerBreakdown.deadwoodValue) {
      // Undercut: defender wins.
      const points = knockerBreakdown.deadwoodValue - defenderDeadwoodAfter + UNDERCUT_BONUS;
      this.awardRound({
        type: 'undercut',
        knocker,
        winner: defender,
        knockerDeadwood: knockerBreakdown.deadwoodValue,
        defenderDeadwood: defenderDeadwoodAfter,
        pointsAwarded: points,
        bonus: UNDERCUT_BONUS,
        knockerBreakdown,
        defenderBreakdown,
        layoffs,
      });
    } else {
      const points = defenderDeadwoodAfter - knockerBreakdown.deadwoodValue;
      this.awardRound({
        type: 'knock',
        knocker,
        winner: knocker,
        knockerDeadwood: knockerBreakdown.deadwoodValue,
        defenderDeadwood: defenderDeadwoodAfter,
        pointsAwarded: points,
        bonus: 0,
        knockerBreakdown,
        defenderBreakdown,
        layoffs,
      });
    }
  }

  private endRoundStalemate() {
    this.roundEnd = {
      type: 'stalemate',
      knocker: null,
      winner: null,
      knockerDeadwood: 0,
      defenderDeadwood: 0,
      pointsAwarded: 0,
      bonus: 0,
      knockerBreakdown: null,
      defenderBreakdown: null,
      layoffs: [],
    };
    this.phase = 'round-over';
    // Same dealer deals again after a stalemate.
  }

  private awardRound(info: RoundEndInfo) {
    this.roundEnd = info;
    this.phase = 'round-over';
    if (info.winner) {
      this.scores[info.winner] += info.pointsAwarded;
      this.boxes[info.winner] += 1;
      // Loser of the hand deals next.
      this.dealer = other(info.winner);
      if (this.scores[info.winner] >= MATCH_TARGET) {
        this.finishMatch(info.winner);
      }
    }
  }

  private finishMatch(leader: Player) {
    // Apply box bonuses and the game-winner bonus, then settle final winner.
    const finalScores: Record<Player, number> = { ...this.scores };
    finalScores.human += this.boxes.human * BOX_BONUS;
    finalScores.ai += this.boxes.ai * BOX_BONUS;
    const winner: Player = finalScores.human === finalScores.ai ? leader : finalScores.human > finalScores.ai ? 'human' : 'ai';
    finalScores[winner] += GAME_BONUS;
    this.scores = finalScores;
    this.matchOver = true;
    this.matchWinner = winner;
    this.phase = 'match-over';
  }

  continueAfterRound() {
    if (this.matchOver) return;
    this.nextMatchRound();
  }

  startNewMatch() {
    this.scores = { human: 0, ai: 0 };
    this.boxes = { human: 0, ai: 0 };
    this.matchOver = false;
    this.matchWinner = null;
    this.dealer = Math.random() < 0.5 ? 'human' : 'ai';
    this.startRound();
  }
}

function sortHand(a: Card, b: Card): number {
  if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
  return a.rank - b.rank;
}
