import './style.css';
import { REFILL_CREDITS, SlotGame, STRIP, STRIP_LEN, SYMBOLS, type Snapshot } from './game/engine';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new SlotGame();
let confirmingReset = false;
let animating = false;
/** Credits shown while the reels are still turning (the real balance is already updated). */
let shownCredits: number | null = null;

const FACES = ['🍒', '🍋', '🔔', 'BAR', '💎', '7'];
const ROW_H = 76;

function faceHtml(id: number): string {
  const cls = id === 3 ? 'sym bar' : id === 5 ? 'sym seven' : 'sym';
  return `<div class="${cls}">${FACES[id]}</div>`;
}

function reelHtml(i: number): string {
  // Rows for strip positions -2..+2 around the one under the payline; repositioned every frame.
  return `<div class="reel"><div class="reel-strip" data-reel="${i}">${[0, 1, 2, 3, 4].map((r) => `<div class="row" data-row="${r}"></div>`).join('')}</div></div>`;
}

function placeReel(i: number, pos: number) {
  const strip = app.querySelector<HTMLElement>(`[data-reel="${i}"]`);
  if (!strip) return;
  const base = Math.floor(pos);
  const frac = pos - base;
  strip.querySelectorAll<HTMLElement>('.row').forEach((row, r) => {
    const k = base + r - 2; // strip index shown in this row
    const id = STRIP[((k % STRIP_LEN) + STRIP_LEN) % STRIP_LEN];
    if (row.dataset.id !== String(id)) {
      row.dataset.id = String(id);
      row.innerHTML = faceHtml(id);
    }
    row.style.transform = `translateY(${(r - 2 - frac) * ROW_H}px)`;
  });
}

function placeAll(pos: number[]) {
  pos.forEach((p, i) => placeReel(i, p));
}

function message(s: Snapshot): string {
  if (s.phase === 'spin') return 'Good luck…';
  if (s.winName) return `${s.winName}  +${s.win}`;
  if (!s.spun) return s.refilled ? `The machine pities you  +${REFILL_CREDITS}` : 'Pull the lever';
  return s.credits < 1 ? 'No win. Out of credits' : 'No win';
}

function render() {
  const s = game.getSnapshot();
  const spinning = s.phase === 'spin';
  const winCls = !spinning && s.winName ? 'win' : '';
  app.innerHTML = `
    <div class="table slots">
      <div class="scoreboard">
        <div class="score">
          <span>Credits: <b>${shownCredits ?? s.credits}</b></span>
          <span>Best: <b>${s.best}</b></span>
        </div>
        <button class="icon-btn" data-action="reset">↻ Reset</button>
      </div>

      <div class="paytable">
        ${SYMBOLS.map((sym, id) => `<div class="pay-row"><span>${faceHtml(id).replace('class="sym', 'class="mini sym')} ×3 ${sym.name}</span><span>${sym.pay * s.bet}</span></div>`)
          .reverse()
          .join('')}
        <div class="pay-row"><span>🍒 🍒 any two cherries</span><span>${2 * s.bet}</span></div>
      </div>

      <div class="machine ${winCls}">
        ${[0, 1, 2].map(reelHtml).join('')}
        <div class="payline"></div>
      </div>

      <div class="message ${winCls}">${message(s)}</div>
      <div class="bet-line">Bet <b>${s.bet}</b><button class="step" data-action="bet-one" aria-label="Bet one more" ${spinning ? 'disabled' : ''}>+</button></div>

      <div class="action-bar slot-actions">
        <button class="btn-accent big" data-action="spin" ${spinning ? 'disabled' : ''}>${spinning ? 'Spinning…' : 'Spin'}</button>
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
  if (!animating) placeAll(s.pos);
}

function spin() {
  if (animating) return;
  game.spin();
  const s = game.getSnapshot();
  const winNow = s.win;
  shownCredits = s.credits - winNow;
  animating = true;
  render();
  const t0 = performance.now();
  const stopAt = [0, 1, 2].map((i) => 1100 + i * 550);
  // Each reel travels forward a whole number of laps (plus the distance to its target), easing out.
  const travel = [0, 1, 2].map((i) => {
    const dist = (((s.pos[i] - s.from[i]) % STRIP_LEN) + STRIP_LEN) % STRIP_LEN;
    return dist + STRIP_LEN * (3 + i * 2);
  });
  const frame = (now: number) => {
    const t = now - t0;
    let done = true;
    for (let i = 0; i < 3; i++) {
      const k = Math.min(1, t / stopAt[i]);
      if (k < 1) done = false;
      const e = 1 - Math.pow(1 - k, 3);
      placeReel(i, s.from[i] + travel[i] * e);
    }
    if (!done) {
      requestAnimationFrame(frame);
      return;
    }
    animating = false;
    shownCredits = null;
    game.finish();
    render();
  };
  requestAnimationFrame(frame);
}

app.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  if (action === 'spin') return spin();
  if (animating) return;
  if (action === 'bet-one') game.betOne();
  else if (action === 'reset') confirmingReset = true;
  else if (action === 'reset-no') confirmingReset = false;
  else if (action === 'reset-yes') {
    game.reset();
    confirmingReset = false;
  } else return;
  render();
});

// Desktop convenience: Space/Enter spins, B changes the bet.
window.addEventListener('keydown', (e) => {
  if (confirmingReset || animating) return;
  if (e.key === ' ' || e.key === 'Enter') spin();
  else if (e.key.toLowerCase() === 'b') {
    game.betOne();
    render();
  } else return;
  e.preventDefault();
});

render();
