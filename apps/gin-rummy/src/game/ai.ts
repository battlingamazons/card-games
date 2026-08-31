import type { Card } from '@card-games/shared';
import { bestBreakdown } from './melds';

const KNOCK_THRESHOLD = 10;

/** Should the AI take the face-up discard instead of drawing blind from stock? */
export function aiWantsDiscard(hand: Card[], discardTop: Card): boolean {
  const withoutDiscard = bestBreakdown(hand).deadwoodValue;
  const withDiscard = bestBreakdown([...hand, discardTop]).deadwoodValue;
  // Only take it if it meaningfully improves the hand (accounts for the
  // extra card that must then be discarded straight back off).
  return withDiscard < withoutDiscard;
}

/** Given an 11-card hand (just drew), pick the card to discard. */
export function aiChooseDiscard(hand: Card[]): Card {
  let best: { card: Card; deadwood: number; isolation: number } | null = null;

  for (const card of hand) {
    const rest = hand.filter((c) => c.id !== card.id);
    const { deadwoodValue, deadwood } = bestBreakdown(rest);
    // Prefer discarding cards that are far (in rank) from any card left in
    // hand, of the same suit or rank, so we leak less info / keep options.
    const isolation = deadwood.some((c) => c.id === card.id) ? cardIsolation(card, rest) : -1;
    if (
      !best ||
      deadwoodValue < best.deadwood ||
      (deadwoodValue === best.deadwood && isolation > best.isolation)
    ) {
      best = { card, deadwood: deadwoodValue, isolation };
    }
  }

  return best!.card;
}

function cardIsolation(card: Card, rest: Card[]): number {
  let minDistance = 99;
  for (const c of rest) {
    if (c.suit === card.suit) minDistance = Math.min(minDistance, Math.abs(c.rank - card.rank));
    if (c.rank === card.rank) minDistance = 0;
  }
  return minDistance;
}

/** Should the AI knock (or go gin) with this post-discard hand? */
export function aiWantsToKnock(hand: Card[]): boolean {
  return bestBreakdown(hand).deadwoodValue <= KNOCK_THRESHOLD;
}
