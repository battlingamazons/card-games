import './style.css';
import { BETS, DRAWN, KenoGame, MAX_PICKS, PAY, POOL, type Snapshot } from './game/engine';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new KenoGame();
let confirmingReset = false;
/** How many of the drawn balls have been revealed so far (DRAWN = all). */
let shown = DRAWN;
let drawing = false;
let timer: number | undefined;
/** Credits shown while the draw is still being revealed (the real balance is already updated). */
let shownCredits: number | null = null;

const BALL_MS = 200;

function message(s: Snapshot): string {
  if (drawing) return `Drawing…  ${hitsShown(s)} of ${s.picks.length}`;
  if (s.note) return s.note;
  if (s.phase === 'result') {
    return s.win > 0 ? `${s.hits} of ${s.picks.length}  +${s.win}` : `${s.hits} of ${s.picks.length}  No win`;
  }
  return s.picks.length ? `${s.picks.length} picked — tap Play` : `Pick 1 to ${MAX_PICKS} numbers`;
}

function hitsShown(s: Snapshot): number {
  return s.drawn.slice(0, shown).filter((n) => s.picks.includes(n)).length;
}

function boardHtml(s: Snapshot): string {
  const revealed = new Set(s.drawn.slice(0, shown));
  const lastBall = drawing && shown > 0 ? s.drawn[shown - 1] : -1;
  let html = '';
  for (let n = 1; n <= POOL; n++) {
    const picked = s.picks.includes(n);
    const drawn = revealed.has(n);
    const cls = ['ball', picked ? 'picked' : '', drawn ? (picked ? 'hit' : 'drawn') : '', n === lastBall ? 'latest' : ''].join(' ');
    html += `<button class="${cls}" data-n="${n}" ${drawing ? 'disabled' : ''}>${drawn && picked ? '★' : n}${drawn && picked ? `<i>${n}</i>` : ''}</button>`;
  }
  return html;
}

function payHtml(s: Snapshot): string {
  const row = PAY[s.picks.length];
  if (!row) return '<div class="pay-empty">Pick numbers to see what each catch pays</div>';
  const hitsList = Object.keys(row)
    .map(Number)
    .sort((a, b) => b - a);
  return hitsList
    .map((h) => {
      const hot = !drawing && s.phase === 'result' && h === s.hits;
      return `<div class="pay-cell${hot ? ' hot' : ''}"><span>${h} hit${h > 1 ? 's' : ''}</span><b>${row[h] * s.bet}</b></div>`;
    })
    .join('');
}

function render() {
  const s = game.getSnapshot();
  const credits = shownCredits ?? s.credits;
  const winCls = !drawing && s.win > 0 ? 'win' : '';
  app.innerHTML = `
    <div class="table keno">
      <div class="scoreboard">
        <div class="score">
          <span>Credits: <b>${credits}</b></span>
          <span>Best: <b>${s.best}</b></span>
        </div>
        <button class="icon-btn" data-action="reset">↻ Reset</button>
      </div>

      <div class="message ${winCls}">${message(s)}</div>

      <div class="board">${boardHtml(s)}</div>

      <div class="paytable">
        <div class="pay-title">Pays on ${s.picks.length ? s.picks.length + ' pick' + (s.picks.length > 1 ? 's' : '') : '—'} (bet ${s.bet})</div>
        <div class="pay-grid">${payHtml(s)}</div>
      </div>

      <div class="chips">
        ${BETS.map((b) => `<button class="chip-btn${b === s.bet ? ' sel' : ''}" data-bet="${b}" ${drawing ? 'disabled' : ''}>${b}</button>`).join('')}
        <span class="staked">Bet</span>
      </div>

      <div class="action-bar keno-actions">
        <button class="btn-secondary" data-action="clear" ${drawing || !s.picks.length ? 'disabled' : ''}>Clear</button>
        <button class="btn-accent big" data-action="play" ${drawing || !s.picks.length ? 'disabled' : ''}>${drawing ? 'Drawing…' : 'Play'}</button>
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

function play() {
  if (drawing) return;
  if (!game.play()) return render();
  const s = game.getSnapshot();
  // The balance is already settled; hold back the win (but not the bet) until the draw is revealed.
  shownCredits = s.credits - s.win;
  drawing = true;
  shown = 0;
  render();
  timer = window.setInterval(() => {
    shown++;
    if (shown >= DRAWN) {
      window.clearInterval(timer);
      timer = undefined;
      drawing = false;
      shownCredits = null;
      game.finish();
    }
    render();
  }, BALL_MS);
}

app.addEventListener('click', (e) => {
  if (drawing) return;
  const target = e.target as HTMLElement;
  const ball = target.closest<HTMLElement>('[data-n]');
  if (ball) {
    game.toggle(Number(ball.dataset.n));
    shown = DRAWN;
    return render();
  }
  const bet = target.closest<HTMLButtonElement>('[data-bet]');
  if (bet && !bet.disabled) {
    game.setBet(Number(bet.dataset.bet));
    return render();
  }
  const btn = target.closest<HTMLButtonElement>('[data-action]');
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  if (action === 'play') return play();
  if (action === 'clear') game.clearPicks();
  else if (action === 'reset') confirmingReset = true;
  else if (action === 'reset-no') confirmingReset = false;
  else if (action === 'reset-yes') {
    game.reset();
    confirmingReset = false;
  } else return;
  render();
});

render();
