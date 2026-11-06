import './style.css';
import { type Card, cardBackHtml, cardHtml } from '@card-games/shared';
import { BlackjackGame, REFILL_CREDITS, type Outcome, type Snapshot } from './game/engine';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new BlackjackGame();
let confirmingReset = false;
let dealerTimer: number | undefined;

const MESSAGES: Record<Outcome, (net: number) => string> = {
  blackjack: (n) => `Blackjack!  +${n}`,
  win: (n) => `You win  +${n}`,
  push: () => 'Push',
  lose: () => 'Dealer wins',
  bust: () => 'Bust',
  'dealer-blackjack': () => 'Dealer has blackjack',
};

function message(s: Snapshot): string {
  if (s.phase === 'play') return 'Hit, stand or double?';
  if (s.phase === 'dealer') return 'Dealer plays…';
  if (s.phase === 'result' && s.outcome) {
    const extra = s.credits < 5 ? '  (out of credits)' : '';
    return MESSAGES[s.outcome](s.net) + extra;
  }
  return s.refilled ? `The dealer pities you  +${REFILL_CREDITS}` : 'Place your bet and deal';
}

function handHtml(cards: Card[], fresh: boolean[], hideSecond: boolean): string {
  const tight = cards.length > 6 ? 'tight' : '';
  return `<div class="bj-row ${tight}">${cards
    .map((c, i) => {
      if (hideSecond && i === 1) return cardBackHtml();
      return cardHtml(c, fresh[i] ? 'dealt' : '');
    })
    .join('')}</div>`;
}

function render() {
  const s = game.getSnapshot();
  const inRound = s.phase === 'play' || s.phase === 'dealer';
  const resultCls = s.outcome === 'blackjack' || s.outcome === 'win' ? 'win' : s.outcome === 'push' ? 'push' : s.outcome ? 'loss' : '';
  app.innerHTML = `
    <div class="table bj">
      <div class="scoreboard">
        <div class="score">
          <span>Credits: <b>${s.credits}</b></span>
          <span>Best: <b>${s.best}</b></span>
        </div>
        <button class="icon-btn" data-action="reset">↻ Reset</button>
      </div>

      <div class="hand-block">
        <div class="hand-label">Dealer ${s.dealer.length ? `<b>${s.dealerTotal}${s.holeHidden ? '+' : ''}</b>` : ''}</div>
        ${s.dealer.length ? handHtml(s.dealer, s.freshDealer, s.holeHidden) : '<div class="bj-row empty"></div>'}
      </div>

      <div class="message ${resultCls}">${message(s)}</div>

      <div class="hand-block">
        <div class="hand-label">You ${s.player.length ? `<b>${s.playerTotal}</b>` : ''}</div>
        ${s.player.length ? handHtml(s.player, s.freshPlayer, false) : '<div class="bj-row empty"></div>'}
      </div>

      <div class="bet-line">
        ${
          inRound
            ? `Bet <b>${s.bet}</b>`
            : `<button class="step" data-action="bet-down" aria-label="Lower bet">−</button>
               Bet <b>${s.bet}</b>
               <button class="step" data-action="bet-up" aria-label="Raise bet">+</button>`
        }
      </div>

      <div class="action-bar bj-actions">
        ${
          s.phase === 'play'
            ? `<button class="btn-secondary" data-action="double" ${s.canDouble ? '' : 'disabled'}>Double</button>
               <button class="btn-secondary" data-action="stand">Stand</button>
               <button class="btn-accent big" data-action="hit">Hit</button>`
            : s.phase === 'dealer'
              ? `<button class="btn-secondary" disabled>Dealer plays…</button>`
              : `<button class="btn-primary big" data-action="deal">${s.phase === 'result' ? 'Deal again' : 'Deal'}</button>`
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
  scheduleDealer(s);
}

function scheduleDealer(s: Snapshot) {
  if (s.phase !== 'dealer' || dealerTimer !== undefined) return;
  dealerTimer = window.setTimeout(() => {
    dealerTimer = undefined;
    game.dealerStep();
    render();
  }, 700);
}

function act(action: string) {
  if (action === 'deal') game.deal();
  else if (action === 'hit') game.hit();
  else if (action === 'stand') game.stand();
  else if (action === 'double') game.doubleDown();
  else if (action === 'bet-up') game.betUp();
  else if (action === 'bet-down') game.betDown();
  else if (action === 'reset') confirmingReset = true;
  else if (action === 'reset-no') confirmingReset = false;
  else if (action === 'reset-yes') {
    game.reset();
    confirmingReset = false;
  } else return;
  render();
}

app.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (btn && !btn.disabled) act(btn.dataset.action!);
});

// Desktop convenience: H hit, S stand, D double, Space/Enter deal.
window.addEventListener('keydown', (e) => {
  if (confirmingReset) return;
  const phase = game.getSnapshot().phase;
  const k = e.key.toLowerCase();
  if (phase === 'play') {
    if (k === 'h') act('hit');
    else if (k === 's') act('stand');
    else if (k === 'd') act('double');
    else return;
  } else if (phase !== 'dealer') {
    if (k === ' ' || k === 'enter') act('deal');
    else if (k === 'arrowup') act('bet-up');
    else if (k === 'arrowdown') act('bet-down');
    else return;
  } else return;
  e.preventDefault();
});

render();
