import { type Card, type Suit, freshDeck, isRed, shuffle } from '@card-games/shared';
import type { Snapshot } from './types';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const TABLEAU_COLUMNS = 8;
const FREE_CELLS = 4;

function canStackOnTableau(moving: Card, targetTop: Card | null): boolean {
  if (!targetTop) return true; // any card may start an empty column
  return targetTop.rank === moving.rank + 1 && isRed(targetTop.suit) !== isRed(moving.suit);
}

function canStackOnFoundation(moving: Card, foundationTop: Card | null): boolean {
  if (!foundationTop) return moving.rank === 1;
  return foundationTop.suit === moving.suit && moving.rank === foundationTop.rank + 1;
}

/** The lowest index in `pile` from which the cards to the end still form a valid descending, alternating-color run. */
function movableRunStart(pile: Card[]): number {
  if (pile.length === 0) return 0;
  let start = pile.length - 1;
  for (let i = pile.length - 2; i >= 0; i--) {
    const lower = pile[i];
    const upper = pile[i + 1];
    if (lower.rank === upper.rank + 1 && isRed(lower.suit) !== isRed(upper.suit)) {
      start = i;
    } else {
      break;
    }
  }
  return start;
}

/** A card is safe to whisk straight to its foundation once both opposite-color foundations are already high enough that no card could still need it as a tableau base. */
function isSafeToAutoFoundation(card: Card, foundations: Record<Suit, Card[]>): boolean {
  const opposite: Suit[] = isRed(card.suit) ? ['S', 'C'] : ['H', 'D'];
  const minOppositeRank = Math.min(foundations[opposite[0]].length, foundations[opposite[1]].length);
  return card.rank <= minOppositeRank + 1;
}

export class FreeCellGame {
  private tableau: Card[][] = [];
  private freeCells: (Card | null)[] = [null, null, null, null];
  private foundations: Record<Suit, Card[]> = { S: [], H: [], D: [], C: [] };
  private moves = 0;
  private wins = 0;
  private wonAlready = false;

  constructor() {
    this.deal();
  }

  private deal() {
    const deck = shuffle(freshDeck());
    this.tableau = Array.from({ length: TABLEAU_COLUMNS }, () => [] as Card[]);
    deck.forEach((card, i) => this.tableau[i % TABLEAU_COLUMNS].push(card));
    this.freeCells = [null, null, null, null];
    this.foundations = { S: [], H: [], D: [], C: [] };
    this.moves = 0;
    this.wonAlready = false;
  }

  newGame() {
    this.deal();
  }

  private tableauTop(index: number): Card | null {
    const pile = this.tableau[index];
    return pile.length ? pile[pile.length - 1] : null;
  }

  private foundationTop(suit: Suit): Card | null {
    const pile = this.foundations[suit];
    return pile.length ? pile[pile.length - 1] : null;
  }

  private emptyFreeCellCount(): number {
    return this.freeCells.filter((c) => c === null).length;
  }

  private emptyColumnCount(excludeIndex?: number): number {
    return this.tableau.filter((pile, i) => pile.length === 0 && i !== excludeIndex).length;
  }

  /** Max cards a single drag can carry, per the standard (free cells + 1) * 2^(empty columns) supermove rule. */
  private maxSupermoveSize(toIndex: number): number {
    const destEmpty = this.tableau[toIndex].length === 0;
    const emptyCols = this.emptyColumnCount(destEmpty ? toIndex : undefined);
    return (this.emptyFreeCellCount() + 1) * 2 ** emptyCols;
  }

  private afterMove() {
    this.autoPlaySafeCards();
    if (this.won && !this.wonAlready) {
      this.wins++;
      this.wonAlready = true;
    }
  }

  private autoPlaySafeCards() {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (let i = 0; i < FREE_CELLS; i++) {
        const card = this.freeCells[i];
        if (card && canStackOnFoundation(card, this.foundationTop(card.suit)) && isSafeToAutoFoundation(card, this.foundations)) {
          this.freeCells[i] = null;
          this.foundations[card.suit].push(card);
          progressed = true;
        }
      }
      for (let i = 0; i < TABLEAU_COLUMNS; i++) {
        const top = this.tableauTop(i);
        if (top && canStackOnFoundation(top, this.foundationTop(top.suit)) && isSafeToAutoFoundation(top, this.foundations)) {
          this.tableau[i].pop();
          this.foundations[top.suit].push(top);
          progressed = true;
        }
      }
    }
  }

  /** Moves the run starting at `cardIndex` within tableau pile `fromIndex` onto pile `toIndex`. */
  moveTableauToTableau(fromIndex: number, cardIndex: number, toIndex: number): boolean {
    if (fromIndex === toIndex) return false;
    const source = this.tableau[fromIndex];
    if (cardIndex < movableRunStart(source) || cardIndex >= source.length) return false;
    const moving = source.slice(cardIndex);
    const targetTop = this.tableauTop(toIndex);
    if (!canStackOnTableau(moving[0], targetTop)) return false;
    if (moving.length > this.maxSupermoveSize(toIndex)) return false;
    this.tableau[fromIndex] = source.slice(0, cardIndex);
    this.tableau[toIndex] = this.tableau[toIndex].concat(moving);
    this.moves++;
    this.afterMove();
    return true;
  }

  moveTableauToFreeCell(fromIndex: number, cellIndex: number): boolean {
    if (this.freeCells[cellIndex] !== null) return false;
    const top = this.tableauTop(fromIndex);
    if (!top) return false;
    this.tableau[fromIndex].pop();
    this.freeCells[cellIndex] = top;
    this.moves++;
    this.afterMove();
    return true;
  }

  moveFreeCellToTableau(cellIndex: number, toIndex: number): boolean {
    const card = this.freeCells[cellIndex];
    if (!card || !canStackOnTableau(card, this.tableauTop(toIndex))) return false;
    this.freeCells[cellIndex] = null;
    this.tableau[toIndex].push(card);
    this.moves++;
    this.afterMove();
    return true;
  }

  moveFreeCellToFoundation(cellIndex: number): boolean {
    const card = this.freeCells[cellIndex];
    if (!card || !canStackOnFoundation(card, this.foundationTop(card.suit))) return false;
    this.freeCells[cellIndex] = null;
    this.foundations[card.suit].push(card);
    this.moves++;
    this.afterMove();
    return true;
  }

  moveTableauToFoundation(fromIndex: number): boolean {
    const top = this.tableauTop(fromIndex);
    if (!top || !canStackOnFoundation(top, this.foundationTop(top.suit))) return false;
    this.tableau[fromIndex].pop();
    this.foundations[top.suit].push(top);
    this.moves++;
    this.afterMove();
    return true;
  }

  get won(): boolean {
    return SUITS.every((suit) => this.foundations[suit].length === 13);
  }

  getSnapshot(): Snapshot {
    const foundationTops = {} as Record<Suit, Card | null>;
    const foundationCounts = {} as Record<Suit, number>;
    for (const suit of SUITS) {
      foundationTops[suit] = this.foundationTop(suit);
      foundationCounts[suit] = this.foundations[suit].length;
    }
    return {
      tableau: this.tableau.map((pile) => pile.slice()),
      freeCells: this.freeCells.slice(),
      foundationTops,
      foundationCounts,
      moves: this.moves,
      wins: this.wins,
      won: this.won,
    };
  }
}

export { movableRunStart };
