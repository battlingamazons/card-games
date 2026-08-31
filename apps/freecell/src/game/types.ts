import type { Card, Suit } from '@card-games/shared';

export interface Snapshot {
  tableau: Card[][];
  freeCells: (Card | null)[];
  foundationTops: Record<Suit, Card | null>;
  foundationCounts: Record<Suit, number>;
  moves: number;
  wins: number;
  won: boolean;
}
