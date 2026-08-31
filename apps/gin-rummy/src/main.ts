import './style.css';
import { cardValue, cardHtml, cardBackHtml, type Card } from '@card-games/shared';
import { GinRummyGame, type Snapshot } from './game/engine';
import { bestBreakdown } from './game/melds';

const AI_STEP_DELAY_MS = 650;

const app = document.querySelector<HTMLDivElement>('#app')!;

const game = new GinRummyGame();
let selectedCardId: string | null = null;

function render() {
  const snap = game.getSnapshot();

  if (snap.phase === 'round-over' || snap.phase === 'match-over') {
    app.innerHTML = tableHtml(snap) + modalHtml(snap);
  } else {
    app.innerHTML = tableHtml(snap);
  }

  advanceIfAiTurn();
}

function tableHtml(snap: Snapshot): string {
  const humanTurn = snap.currentPlayer === 'human' && snap.phase !== 'round-over' && snap.phase !== 'match-over';
  const canDrawStock = humanTurn && snap.phase === 'draw';
  const canDrawDiscard = humanTurn && snap.phase === 'draw' && snap.discardTop;
  const inUpcardDecision = humanTurn && snap.phase === 'upcard-decision';
  const inDiscardPhase = humanTurn && snap.phase === 'discard';

  const selected = selectedCardId ? snap.humanHand.find((c) => c.id === selectedCardId) ?? null : null;
  let selectedDeadwood = 0;
  if (selected && inDiscardPhase) {
    const rest = snap.humanHand.filter((c) => c.id !== selected.id);
    selectedDeadwood = bestBreakdown(rest).deadwoodValue;
  }
  const canKnock = !!selected && inDiscardPhase && selectedDeadwood <= 10;

  return `
    <div class="table">
      <div class="scoreboard">
        <div class="score">
          <span>You: <b>${snap.match.scores.human}</b></span>
          <span>AI: <b>${snap.match.scores.ai}</b></span>
        </div>
        <span class="dealer-tag">${snap.dealer === 'human' ? 'Your deal' : "AI's deal"}</span>
        <button class="icon-btn" data-action="new-match">↻ New match</button>
      </div>

      <div class="opponent-row">
        <span class="opponent-label">AI opponent</span>
        <div class="card-back-row">
          ${Array.from({ length: snap.aiHandCount }).map(() => cardBackHtml()).join('')}
        </div>
      </div>

      <div class="middle-row">
        <div class="pile">
          <span class="pile-label">Stock</span>
          <div class="pile-slot stock-pile ${canDrawStock ? 'tappable' : ''}" data-action="${canDrawStock ? 'draw-stock' : ''}">
            ${snap.stockCount > 0 ? cardBackHtml() : ''}
          </div>
          <span class="pile-label">${snap.stockCount} left</span>
        </div>
        <div class="pile">
          <span class="pile-label">Discard</span>
          <div class="pile-slot ${snap.discardTop ? '' : 'empty'} ${canDrawDiscard ? 'tappable' : ''}" data-action="${canDrawDiscard ? 'draw-discard' : ''}">
            ${snap.discardTop ? cardHtml(snap.discardTop) : ''}
          </div>
          <span class="pile-label">&nbsp;</span>
        </div>
      </div>

      ${
        inUpcardDecision
          ? `<div class="decision-row">
              <button class="btn-primary" data-action="take-upcard">Take that card</button>
              <button class="btn-secondary" data-action="pass-upcard">Pass</button>
            </div>`
          : `<div class="action-hint">${actionHint(snap)}</div>`
      }

      <div class="hand-area">
        <div class="hand-row">
          ${snap.humanHand.map((c) => cardHtml(c, c.id === selectedCardId ? 'selected' : '')).join('')}
        </div>
        <div class="action-bar">
          ${
            inDiscardPhase && selected
              ? `<button class="btn-secondary" data-action="discard">Discard</button>
                 <button class="btn-accent" ${canKnock ? '' : 'disabled'} data-action="knock">${selectedDeadwood === 0 ? 'Gin!' : 'Knock'}</button>`
              : ''
          }
        </div>
      </div>
      <div class="install-hint">Tip: add this to your Home Screen (Share → Add to Home Screen) to play like an app.</div>
    </div>`;
}

function actionHint(snap: Snapshot): string {
  if (snap.phase === 'draw' && snap.currentPlayer === 'human') return 'Draw from the stock or the discard pile';
  if (snap.phase === 'discard' && snap.currentPlayer === 'human') return 'Select a card, then discard or knock';
  if (snap.currentPlayer === 'ai') return "AI is playing…";
  return '';
}

function meldsHtml(melds: Card[][], label: string): string {
  if (melds.length === 0) return '';
  return `<h3>${label}</h3>${melds.map((m) => `<div class="meld-group">${m.map((c) => cardHtml(c)).join('')}</div>`).join('')}`;
}

function deadwoodHtml(cards: Card[]): string {
  if (cards.length === 0) return '';
  return `<h3>Deadwood (${cards.reduce((s, c) => s + cardValue(c), 0)})</h3><div class="deadwood-group">${cards.map((c) => cardHtml(c)).join('')}</div>`;
}

function modalHtml(snap: Snapshot): string {
  const info = snap.roundEnd;
  if (!info) return '';

  let headline = '';
  let resultLine = '';

  if (info.type === 'stalemate') {
    headline = 'Wall game';
    resultLine = 'Stock ran out with no knock — no points this hand.';
  } else {
    const knockerName = info.knocker === 'human' ? 'You' : 'AI';
    const winnerName = info.winner === 'human' ? 'You' : 'AI';
    if (info.type === 'gin') headline = `${knockerName} went Gin!`;
    else if (info.type === 'undercut') headline = `Undercut! ${winnerName} wins the hand`;
    else headline = `${knockerName} knocked — ${winnerName} wins the hand`;
    resultLine = `${winnerName} score${info.winner === 'human' ? '' : 's'} ${info.pointsAwarded} point${info.pointsAwarded === 1 ? '' : 's'}${info.bonus ? ` (includes +${info.bonus} bonus)` : ''}.`;
  }

  const knockerLabel = info.knocker === 'human' ? 'Your hand' : "AI's hand";
  const defenderLabel = info.knocker === 'human' ? "AI's hand" : 'Your hand';

  const matchOverBlock =
    snap.match.matchOver && snap.match.matchWinner
      ? `<div class="result-line">🏆 ${snap.match.matchWinner === 'human' ? 'You win' : 'AI wins'} the match! Final: You ${snap.match.scores.human} — AI ${snap.match.scores.ai}</div>`
      : '';

  return `
    <div class="modal-backdrop">
      <div class="modal">
        <h2>${headline}</h2>
        <div class="subtitle">${snap.match.scores.human} — ${snap.match.scores.ai}</div>
        <div class="scroll-area">
          ${
            info.knockerBreakdown
              ? `<div class="reveal-hand">
                  <h3 style="margin-top:0">${knockerLabel}</h3>
                  ${meldsHtml(info.knockerBreakdown.melds, 'Melds')}
                  ${deadwoodHtml(info.knockerBreakdown.deadwood)}
                </div>`
              : ''
          }
          ${
            info.defenderBreakdown
              ? `<div class="reveal-hand">
                  <h3>${defenderLabel}</h3>
                  ${meldsHtml(info.defenderBreakdown.melds, 'Melds')}
                  ${info.layoffs.length ? `<h3>Laid off</h3><div class="meld-group">${info.layoffs.map((l) => cardHtml(l.card)).join('')}</div>` : ''}
                  ${deadwoodHtml(info.defenderBreakdown.deadwood.filter((c) => !info.layoffs.some((l) => l.card.id === c.id)))}
                </div>`
              : ''
          }
        </div>
        <div class="result-line">${resultLine}</div>
        ${matchOverBlock}
        <div class="buttons">
          ${
            snap.match.matchOver
              ? `<button class="btn-primary" data-action="new-match">Start new match</button>`
              : `<button class="btn-primary" data-action="continue">Next hand</button>`
          }
        </div>
      </div>
    </div>`;
}

function advanceIfAiTurn() {
  if (!game.isAiTurnPending()) return;
  window.setTimeout(() => {
    game.runAiStep();
    render();
  }, AI_STEP_DELAY_MS);
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const actionEl = target.closest<HTMLElement>('[data-action]');
  const cardEl = target.closest<HTMLElement>('.hand-row .card');

  if (cardEl) {
    const id = cardEl.dataset.cardId!;
    selectedCardId = selectedCardId === id ? null : id;
    render();
    return;
  }

  const action = actionEl?.dataset.action;
  if (!action) return;

  switch (action) {
    case 'draw-stock':
      game.drawFromStock('human');
      selectedCardId = null;
      render();
      break;
    case 'draw-discard':
      game.drawFromDiscardPile('human');
      selectedCardId = null;
      render();
      break;
    case 'take-upcard':
      game.takeUpcard('human');
      selectedCardId = null;
      render();
      break;
    case 'pass-upcard':
      game.passUpcard('human');
      render();
      break;
    case 'discard':
      if (selectedCardId) game.discard('human', selectedCardId);
      selectedCardId = null;
      render();
      break;
    case 'knock':
      if (selectedCardId) game.knock('human', selectedCardId);
      selectedCardId = null;
      render();
      break;
    case 'continue':
      game.continueAfterRound();
      selectedCardId = null;
      render();
      break;
    case 'new-match':
      if (confirm('Start a brand new match? Current scores will be reset.')) {
        game.startNewMatch();
        selectedCardId = null;
        render();
      }
      break;
  }
});

render();

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
