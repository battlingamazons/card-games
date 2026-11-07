import './style.css';
import { CELLS, CHIPS, RouletteGame, WHEEL, colorOf, type Snapshot } from './game/engine';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new RouletteGame();
let confirmingReset = false;
let animating = false;
/** Credits shown while the ball is still rolling (the real balance is already updated). */
let shownCredits: number | null = null;

const STEP = (2 * Math.PI) / WHEEL.length;
const SIZE = 240;
const FILL = { red: '#c0102a', black: '#16171e', green: '#1f8a3c' } as const;

/** Wheel rotation and where the ball sits (pocket index, or -1 before the first spin). */
let wheelRot = 0;
let restPocket = -1;

function drawWheel(rot: number, ballAngle: number | null, ballR: number) {
  const canvas = app.querySelector<HTMLCanvasElement>('#wheel');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  const c = canvas.getContext('2d')!;
  c.scale(dpr, dpr);
  c.translate(SIZE / 2, SIZE / 2);

  c.beginPath();
  c.arc(0, 0, 118, 0, Math.PI * 2);
  c.fillStyle = '#5a3410';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = '#d4af37';
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 108, 0, Math.PI * 2);
  c.fillStyle = '#2b1807';
  c.fill();

  for (let i = 0; i < WHEEL.length; i++) {
    const a0 = rot + i * STEP - Math.PI / 2;
    const a1 = a0 + STEP;
    c.beginPath();
    c.arc(0, 0, 100, a0, a1);
    c.arc(0, 0, 62, a1, a0, true);
    c.closePath();
    c.fillStyle = FILL[colorOf(WHEEL[i])];
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = '#d4af37';
    c.stroke();
    c.save();
    c.rotate(a0 + STEP / 2);
    c.translate(84, 0);
    c.rotate(Math.PI / 2);
    c.fillStyle = '#fdfdfb';
    c.font = 'bold 9px -apple-system, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(WHEEL[i]), 0, 0);
    c.restore();
  }

  c.beginPath();
  c.arc(0, 0, 56, 0, Math.PI * 2);
  c.fillStyle = '#1a1a1a';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = '#d4af37';
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 14, 0, Math.PI * 2);
  c.fillStyle = '#d4af37';
  c.fill();

  if (ballAngle !== null) {
    c.beginPath();
    c.arc(Math.cos(ballAngle) * ballR, Math.sin(ballAngle) * ballR, 5, 0, Math.PI * 2);
    c.fillStyle = '#fdfdfd';
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = '#777';
    c.stroke();
  }
}

function drawRest() {
  if (restPocket < 0) return drawWheel(wheelRot, null, 0);
  drawWheel(wheelRot, wheelRot + (restPocket + 0.5) * STEP - Math.PI / 2, 91);
}

function numClass(n: number): string {
  return `n-${colorOf(n)}`;
}

function message(s: Snapshot): string {
  if (s.phase === 'spin') return 'No more bets…';
  if (s.note) return s.note;
  if (s.result >= 0) {
    const col = colorOf(s.result);
    const name = col === 'green' ? 'Zero' : col === 'red' ? 'Red' : 'Black';
    return s.win > 0 ? `${s.result} ${name}  +${s.win}` : `${s.result} ${name}  No win`;
  }
  return 'Place your bets';
}

function boardHtml(s: Snapshot): string {
  return CELLS.map((cell) => {
    const amt = s.bets[cell.id];
    return `<button class="cell tone-${cell.tone}${amt ? ' has-bet' : ''}" data-cell="${cell.id}" ${s.phase === 'spin' ? 'disabled' : ''}
      style="grid-area:${cell.row} / ${cell.col} / span ${cell.rowSpan} / span ${cell.colSpan}">${cell.label}${amt ? `<span class="stack">${amt}</span>` : ''}</button>`;
  }).join('');
}

function render() {
  const s = game.getSnapshot();
  const spinning = s.phase === 'spin';
  const credits = shownCredits ?? s.available;
  app.innerHTML = `
    <div class="table roulette">
      <div class="scoreboard">
        <div class="score">
          <span>Credits: <b>${credits}</b></span>
          <span>Best: <b>${s.best}</b></span>
        </div>
        <button class="icon-btn" data-action="reset">↻ Reset</button>
      </div>

      <div class="wheel-wrap"><canvas id="wheel" style="width:${SIZE}px;height:${SIZE}px"></canvas></div>

      <div class="history">${(spinning ? s.history.slice(1) : s.history).map((n) => `<span class="h ${numClass(n)}">${n}</span>`).join('')}</div>
      <div class="message ${!spinning && s.win > 0 ? 'win' : ''}">${message(s)}</div>

      <div class="board">${boardHtml(s)}</div>

      <div class="chips">
        ${CHIPS.map((c) => `<button class="chip-btn${c === s.chip ? ' sel' : ''}" data-chip="${c}" ${spinning ? 'disabled' : ''}>${c}</button>`).join('')}
        <span class="staked">On table <b>${s.staked}</b></span>
      </div>

      <div class="action-bar roulette-actions">
        <button class="btn-secondary" data-action="undo" ${spinning || !s.staked ? 'disabled' : ''}>Undo</button>
        <button class="btn-secondary" data-action="clear" ${spinning || !s.staked ? 'disabled' : ''}>Clear</button>
        <button class="btn-accent big" data-action="spin" ${spinning || !s.staked ? 'disabled' : ''}>${spinning ? 'Spinning…' : 'Spin'}</button>
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
  if (!animating) drawRest();
}

function spin() {
  if (animating) return;
  const before = game.getSnapshot();
  if (!before.staked) return;
  game.spin();
  const s = game.getSnapshot();
  if (s.phase !== 'spin') return;
  const pocket = WHEEL.indexOf(s.result);
  const afterAvail = s.available;
  // The balance is already settled; hold back the payout until the ball drops.
  shownCredits = afterAvail - s.payout;
  animating = true;
  restPocket = -1;
  render();

  const r0 = wheelRot;
  const wheelTurn = Math.PI * 4;
  const ballLaps = 6;
  const D = 5200;
  const t0 = performance.now();
  const frame = (now: number) => {
    const k = Math.min(1, (now - t0) / D);
    const e = 1 - Math.pow(1 - k, 3);
    wheelRot = r0 + wheelTurn * e;
    // The ball runs against the wheel and converges on the winning pocket as it slows.
    const ballAngle = wheelRot + (pocket + 0.5) * STEP - Math.PI / 2 - (1 - e) * ballLaps * 2 * Math.PI;
    let ballR = 111;
    if (k > 0.7) {
      const f = Math.min(1, (k - 0.7) / 0.22);
      ballR = 111 - f * 20 + (k > 0.92 ? Math.sin((k - 0.92) * 90) * (1 - k) * 25 : 0);
    }
    drawWheel(wheelRot, ballAngle, ballR);
    if (k < 1) {
      requestAnimationFrame(frame);
      return;
    }
    animating = false;
    shownCredits = null;
    restPocket = pocket;
    wheelRot = wheelRot % (2 * Math.PI);
    game.finish();
    render();
  };
  requestAnimationFrame(frame);
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (animating) return;
  const cell = target.closest<HTMLElement>('[data-cell]');
  if (cell) {
    game.placeBet(Number(cell.dataset.cell));
    return render();
  }
  const chip = target.closest<HTMLButtonElement>('[data-chip]');
  if (chip && !chip.disabled) {
    game.setChip(Number(chip.dataset.chip));
    return render();
  }
  const btn = target.closest<HTMLButtonElement>('[data-action]');
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  if (action === 'spin') return spin();
  if (action === 'undo') game.undo();
  else if (action === 'clear') game.clearBets();
  else if (action === 'reset') confirmingReset = true;
  else if (action === 'reset-no') confirmingReset = false;
  else if (action === 'reset-yes') {
    game.reset();
    confirmingReset = false;
    restPocket = -1;
  } else return;
  render();
});

render();
