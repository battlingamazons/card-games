import './style.css';
import { type Card, type Suit, cardHtml, suitSymbol } from '@card-games/shared';
import { FreeCellGame, movableRunStart } from './game/engine';
import type { Snapshot } from './game/types';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const FREE_CELL_COUNT = 4;
const DOUBLE_TAP_MS = 350;

type Selection = { zone: 'freecell'; index: number } | { zone: 'tableau'; index: number; cardIndex: number };

type PileTarget = { zone: 'tableau'; index: number } | { zone: 'freecell'; index: number } | { zone: 'foundation'; suit: Suit };

const app = document.querySelector<HTMLDivElement>('#app')!;

const game = new FreeCellGame();
let snap: Snapshot = game.getSnapshot();
let selection: Selection | null = null;
let lastTap: { id: string; time: number } | null = null;

function render() {
  snap = game.getSnapshot();
  app.innerHTML = tableHtml(snap) + (snap.won ? winModalHtml(snap) : '');
}

function tableHtml(snap: Snapshot): string {
  return `
    <div class="table">
      <div class="scoreboard">
        <div class="score">
          <span>Moves: <b>${snap.moves}</b></span>
          ${snap.wins > 0 ? `<span>Wins: <b>${snap.wins}</b></span>` : ''}
        </div>
        <button class="icon-btn" data-action="new-game">↻ New game</button>
      </div>

      <div class="top-row">
        <div class="pile-group">
          <span class="pile-label">Free cells</span>
          <div class="freecell-row">
            ${Array.from({ length: FREE_CELL_COUNT }, (_, i) => freeCellHtml(i, snap.freeCells[i], selection)).join('')}
          </div>
        </div>
        <div class="pile-group">
          <span class="pile-label">Foundations</span>
          <div class="foundation-row">
            ${SUITS.map((s) => foundationHtml(s, snap.foundationTops[s])).join('')}
          </div>
        </div>
      </div>

      <div class="tableau-row">
        ${snap.tableau.map((pile, i) => tableauColumnHtml(pile, i, selection)).join('')}
      </div>

      <div class="install-hint">Tip: add this to your Home Screen (Share → Add to Home Screen) to play like an app.</div>
    </div>`;
}

function freeCellHtml(index: number, card: Card | null, selection: Selection | null): string {
  const isSelected = !!card && selection?.zone === 'freecell' && selection.index === index;
  return `
    <div class="pile-slot ${card ? '' : 'empty'} tappable" data-zone="freecell" data-index="${index}">
      ${card ? cardHtml(card, isSelected ? 'selected' : '') : ''}
    </div>`;
}

function foundationHtml(suit: Suit, topCard: Card | null): string {
  return `
    <div class="pile-slot ${topCard ? '' : 'empty'} tappable" data-zone="foundation" data-suit="${suit}">
      ${topCard ? cardHtml(topCard) : suitSymbol(suit)}
    </div>`;
}

function tableauColumnHtml(pile: Card[], index: number, selection: Selection | null): string {
  const cardsHtml = pile.length
    ? pile
        .map((card, i) => {
          const isSelected = !!selection && selection.zone === 'tableau' && selection.index === index && i >= selection.cardIndex;
          return cardHtml(card, isSelected ? 'selected tappable' : 'tappable');
        })
        .join('')
    : `<div class="pile-slot empty"></div>`;
  return `<div class="tableau-column" data-zone="tableau" data-index="${index}">${cardsHtml}</div>`;
}

function winModalHtml(snap: Snapshot): string {
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="win-emoji">🎉</div>
        <h2>You win!</h2>
        <div class="subtitle">Solved in ${snap.moves} moves</div>
        <div class="result-line">Wins this session: ${snap.wins}</div>
        <div class="buttons">
          <button class="btn-primary" data-action="new-game">Play again</button>
        </div>
      </div>
    </div>`;
}

function selectionsEqual(a: Selection, b: Selection): boolean {
  if (a.zone !== b.zone) return false;
  if (a.zone === 'freecell' && b.zone === 'freecell') return a.index === b.index;
  if (a.zone === 'tableau' && b.zone === 'tableau') return a.index === b.index && a.cardIndex === b.cardIndex;
  return false;
}

function selectableFrom(candidate: Selection): Selection | null {
  if (candidate.zone === 'freecell') {
    return snap.freeCells[candidate.index] ? candidate : null;
  }
  const pile = snap.tableau[candidate.index];
  if (!pile || candidate.cardIndex >= pile.length || candidate.cardIndex < movableRunStart(pile)) return null;
  return candidate;
}

function tryMove(sel: Selection, target: PileTarget): boolean {
  if (target.zone === 'tableau') {
    if (sel.zone === 'freecell') return game.moveFreeCellToTableau(sel.index, target.index);
    return game.moveTableauToTableau(sel.index, sel.cardIndex, target.index);
  }
  if (target.zone === 'freecell') {
    if (sel.zone !== 'tableau') return false;
    const pile = snap.tableau[sel.index];
    if (sel.cardIndex !== pile.length - 1) return false;
    return game.moveTableauToFreeCell(sel.index, target.index);
  }
  // target.zone === 'foundation'
  if (sel.zone === 'freecell') return game.moveFreeCellToFoundation(sel.index);
  const pile = snap.tableau[sel.index];
  const top = pile[pile.length - 1];
  if (!top || sel.cardIndex !== pile.length - 1 || top.suit !== target.suit) return false;
  return game.moveTableauToFoundation(sel.index);
}

/**
 * Double-tap: send the tapped card (and, if it's mid-run in the tableau, every card stacked on
 * top of it) straight to its foundation, or failing that, any legal tableau spot. Only an actual
 * single top card can go to a foundation; a multi-card run can only move to another tableau pile.
 */
function tryAutoMove(zone: 'freecell' | 'tableau', index: number, cardIndex?: number): boolean {
  if (zone === 'freecell') {
    if (game.moveFreeCellToFoundation(index)) return true;
    for (let i = 0; i < snap.tableau.length; i++) {
      if (game.moveFreeCellToTableau(index, i)) return true;
    }
    return false;
  }
  if (cardIndex === undefined) return false;
  const pile = snap.tableau[index];
  const isSingleCard = cardIndex === pile.length - 1;
  if (isSingleCard && game.moveTableauToFoundation(index)) return true;
  for (let i = 0; i < snap.tableau.length; i++) {
    if (i === index) continue;
    if (game.moveTableauToTableau(index, cardIndex, i)) return true;
  }
  return false;
}

function handleClick(candidate: Selection, target: PileTarget) {
  if (selection && selectionsEqual(selection, candidate)) {
    selection = null;
    render();
    return;
  }
  if (selection) {
    const moved = tryMove(selection, target);
    if (moved) {
      selection = null;
      lastTap = null; // the moved card is now elsewhere; don't let a stray fast tap on it there read as a double-tap
      render();
      return;
    }
  }
  selection = selectableFrom(candidate);
  render();
}

app.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;

  if (el.closest('[data-action="new-game"]')) {
    if (snap.moves === 0 || confirm('Start a new game? Current progress will be lost.')) {
      game.newGame();
      selection = null;
      lastTap = null;
      render();
    }
    return;
  }

  const cardEl = el.closest<HTMLElement>('.card[data-card-id]');
  if (cardEl) {
    const id = cardEl.dataset.cardId!;
    const now = Date.now();
    const isDoubleTap = !!lastTap && lastTap.id === id && now - lastTap.time < DOUBLE_TAP_MS;
    lastTap = isDoubleTap ? null : { id, time: now };
    if (isDoubleTap) {
      const cellIndex = snap.freeCells.findIndex((c) => c?.id === id);
      let colIndex = -1;
      let cardIndex = -1;
      if (cellIndex === -1) {
        for (let i = 0; i < snap.tableau.length; i++) {
          const idx = snap.tableau[i].findIndex((c) => c.id === id);
          if (idx !== -1) {
            colIndex = i;
            cardIndex = idx;
            break;
          }
        }
      }
      let moved = false;
      if (cellIndex !== -1) {
        moved = tryAutoMove('freecell', cellIndex);
      } else if (colIndex !== -1) {
        moved = tryAutoMove('tableau', colIndex, cardIndex);
      }
      if (moved) {
        selection = null;
        render();
        return;
      }
      // Not an auto-movable top card, or no legal destination — fall through and treat as a normal tap.
    }
  }

  const foundationEl = el.closest<HTMLElement>('[data-zone="foundation"]');
  if (foundationEl) {
    const suit = foundationEl.dataset.suit as Suit;
    if (selection) {
      if (tryMove(selection, { zone: 'foundation', suit })) lastTap = null;
      selection = null;
      render();
    }
    return;
  }

  const freecellEl = el.closest<HTMLElement>('[data-zone="freecell"]');
  if (freecellEl) {
    const index = Number(freecellEl.dataset.index);
    handleClick({ zone: 'freecell', index }, { zone: 'freecell', index });
    return;
  }

  const tableauEl = el.closest<HTMLElement>('[data-zone="tableau"]');
  if (tableauEl) {
    const index = Number(tableauEl.dataset.index);
    const pile = snap.tableau[index];
    const cardEl = el.closest<HTMLElement>('.card[data-card-id]');
    const foundIndex = cardEl ? pile.findIndex((c) => c.id === cardEl.dataset.cardId) : -1;
    const cardIndex = foundIndex !== -1 ? foundIndex : pile.length;
    handleClick({ zone: 'tableau', index, cardIndex }, { zone: 'tableau', index });
    return;
  }
});

render();

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
