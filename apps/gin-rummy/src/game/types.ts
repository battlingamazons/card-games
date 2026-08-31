import type { Card } from '@card-games/shared';

export type Meld = Card[];

export interface MeldBreakdown {
  melds: Meld[];
  deadwood: Card[];
  deadwoodValue: number;
}

export type Player = 'human' | 'ai';

export type TurnPhase =
  | 'upcard-decision' // non-dealer decides whether to take the initial upcard
  | 'draw' // current player must draw from stock or discard
  | 'discard' // current player must discard (or knock)
  | 'round-over'
  | 'match-over';

export interface RoundEndInfo {
  type: 'gin' | 'knock' | 'undercut' | 'stalemate';
  knocker: Player | null;
  winner: Player | null;
  knockerDeadwood: number;
  defenderDeadwood: number;
  pointsAwarded: number;
  bonus: number;
  knockerBreakdown: MeldBreakdown | null;
  defenderBreakdown: MeldBreakdown | null;
  layoffs: { card: Card; ontoMeldIndex: number }[];
}
