import './style.css';
import { cardBackHtml, cardHtml } from '@card-games/shared';
import { PAY_TABLE, REFILL_CREDITS, VideoPokerGame, type Snapshot } from './game/engine';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new VideoPokerGame();
let confirmingReset = false;

function message(s: Snapshot): string {
  if (s.phase === 'hold') return 'Tap cards to hold, then Draw';
  if (s.phase === 'result') {
    if (s.winRow >= 0) return `${PAY_TABLE[s.winRow].name}  +${s.win}`;
    return s.credits < 1 ? 'No win. Out of credits' : 'No win';
  }
  return s.refilled ? `The machine pities you  +${REFILL_CREDITS}` : 'Place your bet and deal';
}

function render() {
  const s = game.getSnapshot();
  app.innerHTML = `
    <div class="table poker">
      <div class="scoreboard">
        <div class="score">
          <span>Credits: <b>${s.credits}</b></span>
          <span>Best: <b>${s.best}</b></span>
        </div>
        <button class="icon-btn" data-action="reset">↻ Reset</button>
      </div>

      <div class="paytable">
        ${PAY_TABLE.map(
          (r, i) => `
          <div class="pay-row ${i === s.winRow ? 'win' : ''}">
            <span>${r.name}</span><span>${r.mult * s.bet}</span>
          </div>`,
        ).join('')}
      </div>

      <div class="message ${s.winRow >= 0 ? 'win' : ''}">${message(s)}</div>

      <div class="poker-hand">
        ${[0, 1, 2, 3, 4]
          .map((i) => {
            const card = s.hand[i];
            if (!card) return `<div class="slot">${cardBackHtml()}</div>`;
            const cls = [s.held[i] ? 'held' : '', s.fresh[i] ? 'dealt' : '', s.phase === 'hold' ? 'tappable' : ''].join(' ');
            const delay = s.fresh[i] ? ` style="animation-delay:${i * 60}ms"` : '';
            return `<div class="slot" data-hold="${i}"${delay}>${cardHtml(card, cls)}<span class="held-tag">${s.held[i] ? 'HELD' : ''}</span></div>`;
          })
          .join('')}
      </div>

      <div class="bet-line">Bet <b>${s.bet}</b></div>

      <div class="action-bar poker-actions">
        ${
          s.phase === 'hold'
            ? `<button class="btn-accent big" data-action="draw">Draw</button>`
            : `<button class="btn-secondary" data-action="bet-one">Bet One</button>
               <button class="btn-secondary" data-action="bet-max">Bet Max</button>
               <button class="btn-primary big" data-action="deal">Deal</button>`
        }
      </div>

      <div class="install-hint">Tip: add this to your Home Screen (Share → Add to Home Screen) to play like an app.</div>
    </div>
    ${
      confirmingReset
        ? `<div class="modal-backdrop"><div class="modal">
            <h2>Reset credits?</h2>
            <div class="subtitle">Your bank goes back to 100.</div>
            <div class="buttons">
              <button class="btn-secondary" data-action="reset-no">Cancel</button>
              <button class="btn-accent" data-action="reset-yes">Reset</button>
            </div>
          </div></div>`
        : ''
    }`;
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const holdEl = target.closest<HTMLElement>('[data-hold]');
  if (holdEl) {
    game.toggleHold(Number(holdEl.dataset.hold));
    render();
    return;
  }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'draw') game.draw();
  else if (action === 'deal') game.deal();
  else if (action === 'bet-one') game.betOne();
  else if (action === 'bet-max') game.betMax();
  else if (action === 'reset') confirmingReset = true;
  else if (action === 'reset-no') confirmingReset = false;
  else if (action === 'reset-yes') {
    game.reset();
    confirmingReset = false;
  }
  render();
});

// Desktop convenience: 1-5 hold, Space/Enter deal or draw.
window.addEventListener('keydown', (e) => {
  if (confirmingReset) return;
  if (e.key >= '1' && e.key <= '5') game.toggleHold(Number(e.key) - 1);
  else if (e.key === ' ' || e.key === 'Enter') {
    if (game.getSnapshot().phase === 'hold') game.draw();
    else game.deal();
  } else return;
  e.preventDefault();
  render();
});

render();
