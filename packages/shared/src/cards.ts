export type Suit = 'S' | 'H' | 'D' | 'C';

// rank: 1 = Ace ... 11 = Jack, 12 = Queen, 13 = King
export interface Card {
  id: string; // e.g. "S-1"
  suit: Suit;
  rank: number;
}

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  return deck;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Blackjack/gin-style card value: face cards count as 10, ace as 1. */
export function cardValue(card: Card): number {
  return Math.min(card.rank, 10);
}

export function rankLabel(rank: number): string {
  return rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'S':
      return '♠';
    case 'H':
      return '♥';
    case 'D':
      return '♦';
    case 'C':
      return '♣';
  }
}

export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}
