import { type Card, type Suit, freshDeck, isRed, shuffle } from '@card-games/shared';
import type { Snapshot, TableauCard } from './types';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const TABLEAU_COLUMNS = 7;
const DRAW_COUNT = 3;

function canStackOnTableau(moving: Card, targetTop: Card | null): boolean {
  if (!targetTop) return moving.rank === 13;
  return targetTop.rank === moving.rank + 1 && isRed(targetTop.suit) !== isRed(moving.suit);
}

function canStackOnFoundation(moving: Card, foundationTop: Card | null): boolean {
  if (!foundationTop) return moving.rank === 1;
  return foundationTop.suit === moving.suit && moving.rank === foundationTop.rank + 1;
}

export class SolitaireGame {
  private tableau: TableauCard[][] = [];
  private stock: Card[] = [];
  private waste: Card[] = [];
  private foundations: Record<Suit, Card[]> = { S: [], H: [], D: [], C: [] };
  private moves = 0;
  private wins = 0;

  constructor() {
    this.deal();
  }

  private deal() {
    const deck = shuffle(freshDeck());
    this.tableau = [];
    let idx = 0;
    for (let col = 0; col < TABLEAU_COLUMNS; col++) {
      const pile: TableauCard[] = [];
      for (let row = 0; row <= col; row++) {
        pile.push({ card: deck[idx++], faceUp: row === col });
      }
      this.tableau.push(pile);
    }
    this.stock = deck.slice(idx);
    this.waste = [];
    this.foundations = { S: [], H: [], D: [], C: [] };
    this.moves = 0;
  }

  newGame() {
    this.deal();
  }

  private tableauTop(index: number): TableauCard | null {
    const pile = this.tableau[index];
    return pile.length ? pile[pile.length - 1] : null;
  }

  private foundationTop(suit: Suit): Card | null {
    const pile = this.foundations[suit];
    return pile.length ? pile[pile.length - 1] : null;
  }

  private flipExposedCard(index: number) {
    const top = this.tableauTop(index);
    if (top && !top.faceUp) top.faceUp = true;
  }

  drawFromStock(): boolean {
    if (this.stock.length === 0) {
      if (this.waste.length === 0) return false;
      this.stock = this.waste.slice().reverse();
      this.waste = [];
      return true;
    }
    const count = Math.min(DRAW_COUNT, this.stock.length);
    for (let i = 0; i < count; i++) {
      this.waste.push(this.stock.pop()!);
    }
    this.moves++;
    return true;
  }

  moveWasteToFoundation(): boolean {
    const card = this.waste[this.waste.length - 1];
    if (!card || !canStackOnFoundation(card, this.foundationTop(card.suit))) return false;
    this.waste.pop();
    this.foundations[card.suit].push(card);
    this.moves++;
    if (this.won) this.wins++;
    return true;
  }

  moveWasteToTableau(toIndex: number): boolean {
    const card = this.waste[this.waste.length - 1];
    if (!card) return false;
    const targetTop = this.tableauTop(toIndex);
    if (!canStackOnTableau(card, targetTop?.card ?? null)) return false;
    this.waste.pop();
    this.tableau[toIndex].push({ card, faceUp: true });
    this.moves++;
    return true;
  }

  moveTableauToFoundation(fromIndex: number): boolean {
    const top = this.tableauTop(fromIndex);
    if (!top || !top.faceUp || !canStackOnFoundation(top.card, this.foundationTop(top.card.suit))) return false;
    this.tableau[fromIndex].pop();
    this.foundations[top.card.suit].push(top.card);
    this.flipExposedCard(fromIndex);
    this.moves++;
    if (this.won) this.wins++;
    return true;
  }

  moveFoundationToTableau(suit: Suit, toIndex: number): boolean {
    const card = this.foundationTop(suit);
    if (!card) return false;
    const targetTop = this.tableauTop(toIndex);
    if (!canStackOnTableau(card, targetTop?.card ?? null)) return false;
    this.foundations[suit].pop();
    this.tableau[toIndex].push({ card, faceUp: true });
    this.moves++;
    return true;
  }

  /** Moves the face-up run starting at `cardIndex` within tableau pile `fromIndex` onto pile `toIndex`. */
  moveTableauToTableau(fromIndex: number, cardIndex: number, toIndex: number): boolean {
    if (fromIndex === toIndex) return false;
    const source = this.tableau[fromIndex];
    const moving = source.slice(cardIndex);
    if (moving.length === 0 || !moving.every((c) => c.faceUp)) return false;
    const targetTop = this.tableauTop(toIndex);
    if (!canStackOnTableau(moving[0].card, targetTop?.card ?? null)) return false;
    this.tableau[fromIndex] = source.slice(0, cardIndex);
    this.tableau[toIndex] = this.tableau[toIndex].concat(moving);
    this.flipExposedCard(fromIndex);
    this.moves++;
    return true;
  }

  /** Plays one legal card onto a foundation, preferring tableau piles then the waste. Returns true if it made progress. */
  autoCompleteStep(): boolean {
    for (let i = 0; i < TABLEAU_COLUMNS; i++) {
      if (this.moveTableauToFoundation(i)) return true;
    }
    return this.moveWasteToFoundation();
  }

  get won(): boolean {
    return SUITS.every((suit) => this.foundations[suit].length === 13);
  }

  /** Once every tableau card is face up and the stock/waste are empty, the game can always be finished automatically. */
  get canAutoComplete(): boolean {
    if (this.stock.length > 0 || this.waste.length > 0) return false;
    return this.tableau.every((pile) => pile.every((c) => c.faceUp));
  }

  getSnapshot(): Snapshot {
    const foundationTops = {} as Record<Suit, Card | null>;
    const foundationCounts = {} as Record<Suit, number>;
    for (const suit of SUITS) {
      foundationTops[suit] = this.foundationTop(suit);
      foundationCounts[suit] = this.foundations[suit].length;
    }
    return {
      tableau: this.tableau.map((pile) => pile.map((c) => ({ ...c }))),
      foundationTops,
      foundationCounts,
      stockCount: this.stock.length,
      waste: this.waste.slice(),
      moves: this.moves,
      wins: this.wins,
      won: this.won,
      canAutoComplete: this.canAutoComplete,
    };
  }
}
