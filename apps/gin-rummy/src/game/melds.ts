import { type Card, cardValue } from '@card-games/shared';
import type { Meld, MeldBreakdown } from './types';

/**
 * Finds every valid meld (set of 3-4 same rank, or run of 3+ same suit
 * consecutive rank) that exists within the given hand, expressed as index
 * bitmasks into `hand`.
 */
function candidateMelds(hand: Card[]): number[] {
  const masks: number[] = [];

  // Sets: same rank, any 3 or 4 of them.
  const byRank = new Map<number, number[]>();
  hand.forEach((card, i) => {
    const list = byRank.get(card.rank) ?? [];
    list.push(i);
    byRank.set(card.rank, list);
  });
  for (const indices of byRank.values()) {
    if (indices.length >= 3) {
      masks.push(...subsetsOfSize(indices, 3));
      if (indices.length >= 4) masks.push(...subsetsOfSize(indices, 4));
    }
  }

  // Runs: same suit, consecutive rank, length 3+.
  const bySuit = new Map<string, number[]>();
  hand.forEach((card, i) => {
    const list = bySuit.get(card.suit) ?? [];
    list.push(i);
    bySuit.set(card.suit, list);
  });
  for (const indices of bySuit.values()) {
    const sorted = indices.slice().sort((a, b) => hand[a].rank - hand[b].rank);
    for (let start = 0; start < sorted.length; start++) {
      let mask = 0;
      let prevRank = -1;
      for (let end = start; end < sorted.length; end++) {
        const rank = hand[sorted[end]].rank;
        if (prevRank === -1) {
          mask = 1 << sorted[end];
          prevRank = rank;
        } else if (rank === prevRank + 1) {
          mask |= 1 << sorted[end];
          prevRank = rank;
          const size = popcount(mask);
          if (size >= 3) masks.push(mask);
        } else {
          break;
        }
      }
    }
  }

  return masks;
}

function subsetsOfSize(indices: number[], size: number): number[] {
  const results: number[] = [];
  const combo: number[] = [];
  function backtrack(start: number) {
    if (combo.length === size) {
      results.push(combo.reduce((m, i) => m | (1 << i), 0));
      return;
    }
    for (let i = start; i < indices.length; i++) {
      combo.push(indices[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return results;
}

function popcount(mask: number): number {
  let count = 0;
  while (mask) {
    count += mask & 1;
    mask >>= 1;
  }
  return count;
}

/**
 * Finds the meld/deadwood split that minimizes deadwood value for a hand,
 * via bitmask DP. Hand sizes here are always <= 11, so 2^11 states is cheap.
 */
export function bestBreakdown(hand: Card[]): MeldBreakdown {
  const n = hand.length;
  const full = (1 << n) - 1;
  const melds = candidateMelds(hand);
  const cardValues = hand.map(cardValue);

  const memoValue = new Map<number, number>();
  const memoMeld = new Map<number, number>(); // mask -> meld-mask used to reach it, or -1 if none

  function deadwoodValue(mask: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) v += cardValues[i];
    return v;
  }

  function solve(mask: number): number {
    if (mask === 0) return 0;
    const cached = memoValue.get(mask);
    if (cached !== undefined) return cached;

    let best = deadwoodValue(mask); // baseline: everything is deadwood
    let bestMeld = -1;

    for (const meldMask of melds) {
      if ((meldMask & mask) === meldMask) {
        const rest = mask & ~meldMask;
        const val = solve(rest);
        if (val < best) {
          best = val;
          bestMeld = meldMask;
        }
      }
    }

    memoValue.set(mask, best);
    memoMeld.set(mask, bestMeld);
    return best;
  }

  const total = solve(full);

  // Reconstruct chosen melds.
  const chosenMelds: Meld[] = [];
  let mask = full;
  while (mask !== 0) {
    const meldMask = memoMeld.get(mask) ?? -1;
    if (meldMask === -1) break;
    const meldCards: Card[] = [];
    for (let i = 0; i < n; i++) if (meldMask & (1 << i)) meldCards.push(hand[i]);
    meldCards.sort((a, b) => a.rank - b.rank);
    chosenMelds.push(meldCards);
    mask &= ~meldMask;
  }

  const deadwoodCards: Card[] = [];
  for (let i = 0; i < n; i++) if (mask & (1 << i)) deadwoodCards.push(hand[i]);

  return { melds: chosenMelds, deadwood: deadwoodCards, deadwoodValue: total };
}

/** Can this meld legally accept `card` appended (run extension or set fill)? */
export function canLayOff(meld: Meld, card: Card): boolean {
  const isSet = meld.every((c) => c.rank === meld[0].rank);
  if (isSet) {
    return card.rank === meld[0].rank && meld.length < 4;
  }
  // run: same suit, contiguous ranks
  const suit = meld[0].suit;
  if (card.suit !== suit) return false;
  const ranks = meld.map((c) => c.rank).sort((a, b) => a - b);
  const min = ranks[0];
  const max = ranks[ranks.length - 1];
  return card.rank === min - 1 || card.rank === max + 1;
}
