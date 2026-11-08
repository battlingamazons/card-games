import './style.css';
import { CHIPS, CrapsGame, MAX_ODDS, ODDS_PAY, PLACE_PAY, POINTS, REFILL_CREDITS, type BetId, type Snapshot } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new CrapsGame();
const sound = new Sound();
let confirmingReset = false;
let rolling = false;
/** The table as it was before a roll, shown until the dice have landed. */
let before: Snapshot | null = null;

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

function dieHtml(n: number, idx: number): string {
  const pips = PIPS[n].map(([r, c]) => `<i style="grid-row:${r + 1};grid-column:${c + 1}"></i>`).join('');
  return `<div class="die" id="die${idx}">${pips}</div>`;
}

function el(id: string): HTMLElement {
  return document.querySelector<HTMLElement>(`#${id}`)!;
}

const chipBadge = (s: Snapshot, id: BetId) => (s.bets[id] ? `<span class="stack">${s.bets[id]}</span>` : '');

function betBtn(s: Snapshot, id: BetId, label: string, sub: string, cls = '', disabled = false): string {
  return `<button class="bet ${cls}${s.bets[id] ? ' has' : ''}" data-bet="${id}" ${disabled ? 'disabled' : ''}><b>${label}</b><small>${sub}</small>${chipBadge(s, id)}</button>`;
}

function message(s: Snapshot): string {
  if (rolling) return 'Rolling…';
  if (s.note) return s.note;
  if (s.dice) {
    const t = s.dice[0] + s.dice[1];
    const sign = s.net > 0 ? `+${s.net}` : s.net < 0 ? `−${-s.net}` : '±0';
    const head = s.lines.length ? `${t}  ·  ${sign}` : `${t}`;
    return head;
  }
  return s.point === null ? 'Come-out roll: place a Pass or Don’t Pass bet' : `Point is ${s.point}`;
}

function render() {
  const live = game.getSnapshot();
  const s = rolling && before ? before : live;
  const point = s.point;
  const odds = (id: 'passOdds' | 'dontPassOdds') => {
    const base = id === 'passOdds' ? 'pass' : 'dontPass';
    const dis = point === null || !s.bets[base];
    const sub = point !== null ? (id === 'passOdds' ? `pays ${ODDS_PAY[point].join(':')}` : `lays ${ODDS_PAY[point][1]}:${ODDS_PAY[point][0]}`) : 'after point';
    return betBtn(s, id, id === 'passOdds' ? 'PASS ODDS' : 'DON’T ODDS', sub, 'small', dis || rolling);
  };
  const lineLocked = point !== null || rolling;
  app.innerHTML = `
    <div class="table cr">
      <div class="scoreboard">
        <div class="score">
          <span>Credits: <b>${s.available}</b></span>
          <span>Best: <b>${s.best}</b></span>
        </div>
        <div class="hbtns"><button class="icon-btn" id="mute" aria-label="Toggle sound">${sound.muted ? '🔇' : '🔊'}</button><button class="icon-btn" data-action="reset">↻ Reset</button></div>
      </div>

      <div class="stage">
        <div class="dice" id="dice">${dieHtml(s.dice?.[0] ?? 3, 0)}${dieHtml(s.dice?.[1] ?? 4, 1)}</div>
        <div class="puck ${point === null ? 'off' : 'on'}"><small>POINT</small><b>${point === null ? 'OFF' : point}</b></div>
      </div>
      <div class="history">${s.history.map((n) => `<span class="h h${n === 7 ? '7' : ''}">${n}</span>`).join('')}</div>
      <div class="message${live.net > 0 && !rolling ? ' win' : ''}" id="msg">${message(live)}</div>
      <div class="lines" id="lines">${rolling ? '' : live.lines.map((l) => `<div>${l}</div>`).join('')}</div>

      <div class="grid2">
        ${betBtn(s, 'dontPass', 'DON’T PASS', '1:1 · bar 12', 'line', lineLocked)}
        ${betBtn(s, 'pass', 'PASS LINE', '1:1', 'line', lineLocked)}
      </div>
      <div class="grid2">${odds('dontPassOdds')}${odds('passOdds')}</div>
      <div class="places">
        ${POINTS.map((n) => betBtn(s, `place${n}` as BetId, `${n}`, point === null ? 'off' : PLACE_PAY[n].join(':'), 'place' + (point === n ? ' ispoint' : ''), rolling)).join('')}
      </div>
      <div class="grid1">${betBtn(s, 'field', 'FIELD', '3 4 9 10 11 pay 1:1 · 2 pays 2:1 · 12 pays 3:1', 'field', rolling)}</div>
      <div class="grid3">
        ${betBtn(s, 'any7', 'ANY 7', '4:1', 'prop', rolling)}
        ${betBtn(s, 'anyCraps', 'ANY CRAPS', '7:1', 'prop', rolling)}
        ${betBtn(s, 'eleven', 'ELEVEN', '15:1', 'prop', rolling)}
      </div>

      <div class="chips">
        ${CHIPS.map((c) => `<button class="chip-btn${c === s.chip ? ' sel' : ''}" data-chip="${c}" ${rolling ? 'disabled' : ''}>${c}</button>`).join('')}
        <span class="staked">On table <b>${s.staked}</b></span>
      </div>

      <div class="action-bar cr-actions">
        <button class="btn-secondary" data-action="undo" ${rolling ? 'disabled' : ''}>Undo</button>
        <button class="btn-secondary" data-action="clear" ${rolling ? 'disabled' : ''}>Clear</button>
        <button class="btn-accent big" data-action="roll" ${rolling || !s.staked ? 'disabled' : ''}>${rolling ? 'Rolling…' : 'Roll'}</button>
      </div>
      <div class="install-hint">Free odds up to ${MAX_ODDS}× · place and field pay rounded down · one-roll bets come down after each roll · ${REFILL_CREDITS} credits if you bust</div>
    </div>
    ${
      confirmingReset
        ? `<div class="modal-backdrop"><div class="modal">
            <h2>Reset credits?</h2>
            <div class="subtitle">Your bank goes back to 100 and the table is cleared.</div>
            <div class="buttons">
              <button class="btn-secondary" data-action="reset-no">Cancel</button>
              <button class="btn-accent" data-action="reset-yes">Reset</button>
            </div>
          </div></div>`
        : ''
    }`;
}

function setDie(idx: number, n: number) {
  const d = el(`die${idx}`);
  d.innerHTML = PIPS[n].map(([r, c]) => `<i style="grid-row:${r + 1};grid-column:${c + 1}"></i>`).join('');
}

function doRoll() {
  if (rolling) return;
  const pre = game.getSnapshot();
  if (!game.roll()) return render();
  const post = game.getSnapshot();
  before = pre;
  rolling = true;
  render();
  sound.play('rattle');
  const dice = post.dice!;
  el('dice').classList.add('tumble');
  const t0 = performance.now();
  const total = 1300;
  const tick = () => {
    const k = (performance.now() - t0) / total;
    if (k < 1) {
      setDie(0, 1 + Math.floor(Math.random() * 6));
      setDie(1, 1 + Math.floor(Math.random() * 6));
      window.setTimeout(tick, 70 + k * 120);
      return;
    }
    setDie(0, dice[0]);
    setDie(1, dice[1]);
    el('dice').classList.remove('tumble');
    sound.play('land');
    window.setTimeout(() => {
      rolling = false;
      before = null;
      render();
      const t = dice[0] + dice[1];
      if (post.net > 0) sound.play('win');
      else if (pre.point !== null && t === 7 && pre.staked > 0) sound.play('sevenOut');
      else if (post.net < 0) sound.play('lose');
      else if (post.point !== null && pre.point === null) sound.play('point');
    }, 250);
  };
  tick();
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (rolling) return;
  const bet = target.closest<HTMLButtonElement>('[data-bet]');
  if (bet) {
    sound.unlock();
    const stakedBefore = game.getSnapshot().staked;
    game.placeBet(bet.dataset.bet as BetId);
    if (game.getSnapshot().staked > stakedBefore) sound.play('chip');
    return render();
  }
  const chip = target.closest<HTMLButtonElement>('[data-chip]');
  if (chip && !chip.disabled) {
    game.setChip(Number(chip.dataset.chip));
    return render();
  }
  const btn = target.closest<HTMLButtonElement>('[data-action]');
  if (!btn || btn.disabled) return;
  sound.unlock();
  const action = btn.dataset.action;
  if (action === 'roll') return doRoll();
  if (action === 'undo') game.undo();
  else if (action === 'clear') game.clearBets();
  else if (action === 'reset') confirmingReset = true;
  else if (action === 'reset-no') confirmingReset = false;
  else if (action === 'reset-yes') {
    game.reset();
    confirmingReset = false;
  } else return;
  render();
});
app.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('#mute')) {
    sound.unlock();
    sound.toggle();
    render();
  }
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

render();
