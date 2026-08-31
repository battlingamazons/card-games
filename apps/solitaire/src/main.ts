import './style.css';
import { type Card, type Suit, cardBackHtml, cardHtml, suitSymbol } from '@card-games/shared';
import { SolitaireGame } from './game/engine';
import type { Snapshot, TableauCard } from './game/types';

const AUTO_STEP_DELAY_MS = 150;
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

type Selection =
  | { zone: 'waste' }
  | { zone: 'tableau'; index: number; cardIndex: number }
  | { zone: 'foundation'; suit: Suit };

type PileTarget = { zone: 'tableau'; index: number } | { zone: 'foundation'; suit: Suit };

const app = document.querySelector<HTMLDivElement>('#app')!;

const game = new SolitaireGame();
let snap: Snapshot = game.getSnapshot();
let selection: Selection | null = null;
let autoRunning = false;

function render() {
  snap = game.getSnapshot();
  app.innerHTML = tableHtml(snap) + (snap.won ? winModalHtml(snap) : '');
}

function tableHtml(snap: Snapshot): string {
  const canRecycle = snap.stockCount === 0 && snap.waste.length > 0;
  return `
    <div class="table">
      <div class="scoreboard">
        <div class="score">
          <span>Moves: <b>${snap.moves}</b></span>
          ${snap.wins > 0 ? `<span>Wins: <b>${snap.wins}</b></span>` : ''}
        </div>
        ${snap.canAutoComplete && !autoRunning ? `<button class="icon-btn" data-action="auto-complete">⏩ Auto</button>` : ''}
        <button class="icon-btn" data-action="new-game">↻ New game</button>
      </div>

      <div class="top-row">
        <div class="stock-waste-group">
          ${stockHtml(snap.stockCount, canRecycle)}
          ${wasteHtml(snap.waste, selection)}
        </div>
        <div class="foundation-row">
          ${SUITS.map((s) => foundationHtml(s, snap.foundationTops[s], selection)).join('')}
        </div>
      </div>

      <div class="tableau-row">
        ${snap.tableau.map((pile, i) => tableauColumnHtml(pile, i, selection)).join('')}
      </div>

      <div class="install-hint">Tip: add this to your Home Screen (Share → Add to Home Screen) to play like an app.</div>
    </div>`;
}

function stockHtml(count: number, canRecycle: boolean): string {
  return `
    <div class="pile" data-action="draw-stock">
      <span class="pile-label">Stock</span>
      <div class="pile-slot ${count === 0 ? 'empty' : ''} tappable">
        ${count > 0 ? cardBackHtml() : canRecycle ? '↻' : ''}
      </div>
      <span class="pile-label">${count} left</span>
    </div>`;
}

function wasteHtml(waste: Card[], selection: Selection | null): string {
  const shown = waste.slice(-3);
  const inner =
    shown.length === 0
      ? `<div class="pile-slot empty" data-zone="waste"></div>`
      : `<div class="waste-fan" data-zone="waste">${shown
          .map((card, i) => {
            const isTop = i === shown.length - 1;
            const classes = [isTop ? 'tappable' : '', isTop && selection?.zone === 'waste' ? 'selected' : '']
              .filter(Boolean)
              .join(' ');
            return `<div class="waste-slot" style="left:${i * 14}px">${cardHtml(card, classes)}</div>`;
          })
          .join('')}</div>`;
  return `
    <div class="pile">
      <span class="pile-label">Waste</span>
      ${inner}
      <span class="pile-label">&nbsp;</span>
    </div>`;
}

function foundationHtml(suit: Suit, topCard: Card | null, selection: Selection | null): string {
  const isSelected = !!topCard && selection?.zone === 'foundation' && selection.suit === suit;
  return `
    <div class="pile" data-zone="foundation" data-suit="${suit}">
      <span class="pile-label">${suitSymbol(suit)}</span>
      <div class="pile-slot ${topCard ? '' : 'empty'} tappable">
        ${topCard ? cardHtml(topCard, isSelected ? 'selected' : '') : ''}
      </div>
    </div>`;
}

function tableauColumnHtml(pile: TableauCard[], index: number, selection: Selection | null): string {
  const cardsHtml = pile.length
    ? pile
        .map((c, i) => {
          if (!c.faceUp) return cardBackHtml();
          const isSelected = !!selection && selection.zone === 'tableau' && selection.index === index && i >= selection.cardIndex;
          return cardHtml(c.card, isSelected ? 'selected tappable' : 'tappable');
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
  if (a.zone === 'waste' && b.zone === 'waste') return true;
  if (a.zone === 'tableau' && b.zone === 'tableau') return a.index === b.index && a.cardIndex === b.cardIndex;
  if (a.zone === 'foundation' && b.zone === 'foundation') return a.suit === b.suit;
  return false;
}

function selectableFrom(candidate: Selection): Selection | null {
  if (candidate.zone === 'waste') {
    return snap.waste.length > 0 ? candidate : null;
  }
  if (candidate.zone === 'tableau') {
    const card = snap.tableau[candidate.index]?.[candidate.cardIndex];
    return card && card.faceUp ? candidate : null;
  }
  return snap.foundationTops[candidate.suit] ? candidate : null;
}

function tryMove(sel: Selection, target: PileTarget): boolean {
  if (target.zone === 'tableau') {
    if (sel.zone === 'waste') return game.moveWasteToTableau(target.index);
    if (sel.zone === 'foundation') return game.moveFoundationToTableau(sel.suit, target.index);
    return game.moveTableauToTableau(sel.index, sel.cardIndex, target.index);
  }
  // target.zone === 'foundation'
  if (sel.zone === 'waste') {
    const card = snap.waste[snap.waste.length - 1];
    if (!card || card.suit !== target.suit) return false;
    return game.moveWasteToFoundation();
  }
  if (sel.zone === 'tableau') {
    const pile = snap.tableau[sel.index];
    const top = pile[pile.length - 1];
    if (!top || sel.cardIndex !== pile.length - 1 || top.card.suit !== target.suit) return false;
    return game.moveTableauToFoundation(sel.index);
  }
  return false; // foundation -> foundation is never meaningful
}

function handleClick(candidate: Selection, target: PileTarget | null) {
  if (selection && selectionsEqual(selection, candidate)) {
    selection = null;
    render();
    return;
  }
  if (selection && target) {
    const moved = tryMove(selection, target);
    if (moved) {
      selection = null;
      render();
      return;
    }
  }
  selection = selectableFrom(candidate);
  render();
}

function runAutoComplete() {
  if (autoRunning) return;
  autoRunning = true;
  const step = () => {
    const progressed = game.autoCompleteStep();
    render();
    if (progressed && !snap.won) {
      window.setTimeout(step, AUTO_STEP_DELAY_MS);
    } else {
      autoRunning = false;
      render();
    }
  };
  step();
}

app.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;

  if (el.closest('[data-action="new-game"]')) {
    if (snap.moves === 0 || confirm('Start a new game? Current progress will be lost.')) {
      game.newGame();
      selection = null;
      render();
    }
    return;
  }

  if (el.closest('[data-action="auto-complete"]')) {
    runAutoComplete();
    return;
  }

  if (el.closest('[data-action="draw-stock"]')) {
    game.drawFromStock();
    selection = null;
    render();
    return;
  }

  const wasteEl = el.closest<HTMLElement>('[data-zone="waste"]');
  if (wasteEl) {
    handleClick({ zone: 'waste' }, null);
    return;
  }

  const foundationEl = el.closest<HTMLElement>('[data-zone="foundation"]');
  if (foundationEl) {
    const suit = foundationEl.dataset.suit as Suit;
    handleClick({ zone: 'foundation', suit }, { zone: 'foundation', suit });
    return;
  }

  const tableauEl = el.closest<HTMLElement>('[data-zone="tableau"]');
  if (tableauEl) {
    const index = Number(tableauEl.dataset.index);
    const pile = snap.tableau[index];
    const cardEl = el.closest<HTMLElement>('.card[data-card-id]');
    const foundIndex = cardEl ? pile.findIndex((c) => c.card.id === cardEl.dataset.cardId) : -1;
    const cardIndex = foundIndex !== -1 ? foundIndex : pile.length;
    handleClick({ zone: 'tableau', index, cardIndex }, { zone: 'tableau', index });
    return;
  }
});

render();

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
