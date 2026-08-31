import type { Card, Suit } from '@card-games/shared';

export interface TableauCard {
  card: Card;
  faceUp: boolean;
}

export interface Snapshot {
  tableau: TableauCard[][];
  foundationTops: Record<Suit, Card | null>;
  foundationCounts: Record<Suit, number>;
  stockCount: number;
  waste: Card[]; // all drawn waste cards; only the last is playable
  moves: number;
  wins: number;
  won: boolean;
  canAutoComplete: boolean;
}
