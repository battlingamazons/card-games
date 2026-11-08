import './style.css';
import { REFILL_CREDITS, SPOTS, SYMBOLS, ScratchGame, TIERS, type Snapshot } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new ScratchGame();
const sound = new Sound();
let confirmingReset = false;

app.innerHTML = `
  <div class="table sc">
    <div class="scoreboard">
      <div class="score">
        <span>Credits: <b id="credits">0</b></span>
        <span>Best: <b id="best">0</b></span>
      </div>
      <div class="hbtns"><button class="icon-btn" id="mute" aria-label="Toggle sound"></button><button class="icon-btn" data-action="reset">↻ Reset</button></div>
    </div>
    <div class="tiers" id="tiers"></div>
    <div id="ticket-wrap"></div>
    <div class="message" id="msg"></div>
    <div class="action-bar sc-actions" id="actions"></div>
    <div class="install-hint">Tip: add this to your Home Screen (Share → Add to Home Screen) to play like an app.</div>
  </div>
  <div id="modal"></div>`;

const el = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!;

// ---- the ticket and its scratch-off coating ----

let coat: HTMLCanvasElement | null = null;
let cctx: CanvasRenderingContext2D | null = null;
/** True while a spot still has its coating on. */
let covered: boolean[] = new Array(SPOTS).fill(false);
let spotRects: { x: number; y: number; w: number; h: number }[] = [];
let dpr = 1;
/** Whether the coating currently on screen can be scratched. */
let scratchable = false;

function ticketHtml(s: Snapshot): string {
  const tier = TIERS[s.ticket ? s.ticket.tier : s.tier];
  const [c1, c2, acc] = tier.theme;
  const t = s.ticket;
  const winId = t?.settled && t.prize > 0 ? t.symbols.find((id) => t.symbols.filter((x) => x === id).length >= 3) : undefined;
  const spots = Array.from({ length: SPOTS }, (_, i) => {
    const ch = t ? SYMBOLS[t.symbols[i]].ch : '';
    const hit = winId !== undefined && t?.symbols[i] === winId ? ' hit' : '';
    return `<div class="spot${hit}" data-spot="${i}">${ch}</div>`;
  }).join('');
  const legend = SYMBOLS.map((sym) => `<span class="lg"><i>${sym.ch}</i><b>${sym.mult * tier.price}</b></span>`).join('');
  const win = t?.settled && t.prize > 0 ? ' won' : '';
  return `
    <div class="ticket${win}" style="--c1:${c1};--c2:${c2};--acc:${acc}">
      <div class="t-head"><span class="t-name">${tier.name}</span><span class="t-price">${tier.price} credit${tier.price > 1 ? 's' : ''}</span></div>
      <div class="t-sub">Scratch to reveal · match 3 to win</div>
      <div class="grid" id="grid">${spots}<canvas id="coat"></canvas></div>
      <div class="legend">${legend}</div>
    </div>`;
}

function paintPatch(i: number) {
  const c = cctx!;
  const r = spotRects[i];
  const g = c.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, '#e6eaee');
  g.addColorStop(0.5, '#a3adb5');
  g.addColorStop(1, '#d9dee3');
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(r.x, r.y, r.w, r.h, 14);
  c.fill();
  // Brushed-metal specks.
  c.save();
  c.clip();
  for (let k = 0; k < 90; k++) {
    c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(80,90,100,0.18)';
    c.fillRect(r.x + Math.random() * r.w, r.y + Math.random() * r.h, 10 + Math.random() * 22, 1);
  }
  c.restore();
  c.fillStyle = 'rgba(70,80,90,0.55)';
  c.font = 'bold 12px -apple-system, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('SCRATCH', r.x + r.w / 2, r.y + r.h / 2);
}

function buildTicket() {
  const s = game.getSnapshot();
  el('ticket-wrap').innerHTML = ticketHtml(s);
  const grid = el('grid');
  coat = grid.querySelector<HTMLCanvasElement>('#coat')!;
  dpr = window.devicePixelRatio || 1;
  const gr = grid.getBoundingClientRect();
  coat.width = Math.round(gr.width * dpr);
  coat.height = Math.round(gr.height * dpr);
  coat.style.width = `${gr.width}px`;
  coat.style.height = `${gr.height}px`;
  cctx = coat.getContext('2d', { willReadFrequently: true })!;
  cctx.scale(dpr, dpr);
  spotRects = [...grid.querySelectorAll<HTMLElement>('.spot')].map((sp) => {
    const r = sp.getBoundingClientRect();
    return { x: r.left - gr.left, y: r.top - gr.top, w: r.width, h: r.height };
  });
  const t = s.ticket;
  covered = Array.from({ length: SPOTS }, (_, i) => !t || !t.revealed[i]);
  // Without a bought ticket the preview is covered but can't be scratched.
  scratchable = !!t && !t.settled;
  covered.forEach((cv, i) => cv && paintPatch(i));
  attachScratch();
}

// ---- scratching ----

let drawing = false;
let last = { x: 0, y: 0 };
let checkTimer: number | undefined;

function pos(e: PointerEvent) {
  const r = coat!.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function stroke(a: { x: number; y: number }, b: { x: number; y: number }) {
  const c = cctx!;
  c.globalCompositeOperation = 'destination-out';
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = 34;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}

function attachScratch() {
  const cv = coat!;
  cv.addEventListener('pointerdown', (e) => {
    if (!scratchable) return;
    e.preventDefault();
    sound.unlock();
    cv.setPointerCapture(e.pointerId);
    drawing = true;
    last = pos(e);
    stroke(last, { x: last.x + 0.1, y: last.y });
    sound.play('scratch');
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e);
    stroke(last, p);
    if (Math.hypot(p.x - last.x, p.y - last.y) > 3) sound.play('scratch');
    last = p;
    if (checkTimer === undefined) checkTimer = window.setTimeout(() => ((checkTimer = undefined), checkCoverage()), 120);
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    checkCoverage();
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('lostpointercapture', end);
}

/** Fraction of a spot's coating that has been scratched away, sampled on a coarse grid. */
function scratchedFraction(i: number): number {
  const r = spotRects[i];
  const inset = 0.12;
  const x = Math.floor((r.x + r.w * inset) * dpr);
  const y = Math.floor((r.y + r.h * inset) * dpr);
  const w = Math.max(1, Math.floor(r.w * (1 - 2 * inset) * dpr));
  const h = Math.max(1, Math.floor(r.h * (1 - 2 * inset) * dpr));
  const data = cctx!.getImageData(x, y, w, h).data;
  const step = 6;
  let clear = 0;
  let total = 0;
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      total++;
      if (data[(py * w + px) * 4 + 3] < 40) clear++;
    }
  }
  return total ? clear / total : 0;
}

function clearSpot(i: number) {
  const r = spotRects[i];
  cctx!.globalCompositeOperation = 'destination-out';
  cctx!.fillStyle = '#000';
  cctx!.beginPath();
  cctx!.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 16);
  cctx!.fill();
  covered[i] = false;
}

function checkCoverage() {
  if (!scratchable) return;
  let finished = false;
  let any = false;
  for (let i = 0; i < SPOTS; i++) {
    if (!covered[i]) continue;
    if (scratchedFraction(i) >= 0.5) {
      clearSpot(i);
      any = true;
      sound.play('reveal');
      if (game.reveal(i)) finished = true;
    }
  }
  if (any) afterReveal(finished);
}

function afterReveal(finished: boolean) {
  if (finished) {
    scratchable = false;
    const s = game.getSnapshot();
    sound.play(s.lastWin >= 25 * TIERS[s.ticket!.tier].price ? 'bigwin' : s.lastWin > 0 ? 'win' : 'lose');
    buildTicket(); // re-render to highlight the winning symbols
  }
  renderStatus();
}

// ---- status: scoreboard, tier picker, message, buttons ----

function message(s: Snapshot): string {
  const t = s.ticket;
  if (t && !t.settled) {
    const left = t.revealed.filter((r) => !r).length;
    return left === SPOTS ? 'Scratch the silver spots with your finger' : `${left} spot${left > 1 ? 's' : ''} left to scratch`;
  }
  if (t && t.settled) {
    const base = t.prize > 0 ? `WINNER!  +${s.lastWin}` : 'No match — better luck next ticket';
    return s.refilled ? `${base}  ·  The booth pities you  +${REFILL_CREDITS}` : base;
  }
  return s.refilled ? `The booth pities you  +${REFILL_CREDITS}` : 'Pick a ticket and buy it';
}

function renderStatus() {
  const s = game.getSnapshot();
  const active = game.active;
  el('credits').textContent = String(s.credits);
  el('best').textContent = String(s.best);
  el('mute').textContent = sound.muted ? '🔇' : '🔊';
  el('tiers').innerHTML = TIERS.map(
    (t, i) => `<button class="tier${i === s.tier ? ' sel' : ''}" data-tier="${i}" ${active || t.price > s.credits ? 'disabled' : ''}><b>${t.price}</b><span>${t.name}</span></button>`,
  ).join('');
  const msg = el('msg');
  msg.textContent = message(s);
  msg.className = `message${s.ticket?.settled && s.ticket.prize > 0 ? ' win' : ''}`;
  const price = TIERS[s.tier].price;
  el('actions').innerHTML = active
    ? `<button class="btn-secondary" data-action="reveal-all">Reveal all</button>`
    : `<button class="btn-primary big" data-action="buy" ${price > s.credits ? 'disabled' : ''}>${s.ticket ? 'Buy another' : 'Buy ticket'} · ${price}</button>`;
  el('modal').innerHTML = confirmingReset
    ? `<div class="modal-backdrop"><div class="modal">
        <h2>Reset credits?</h2>
        <div class="subtitle">Your bank goes back to 100 and any open ticket is discarded.</div>
        <div class="buttons">
          <button class="btn-secondary" data-action="reset-no">Cancel</button>
          <button class="btn-accent" data-action="reset-yes">Reset</button>
        </div>
      </div></div>`
    : '';
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const tier = target.closest<HTMLButtonElement>('[data-tier]');
  if (tier && !tier.disabled) {
    game.setTier(Number(tier.dataset.tier));
    buildTicket();
    return renderStatus();
  }
  const btn = target.closest<HTMLButtonElement>('[data-action]');
  if (!btn || btn.disabled) return;
  sound.unlock();
  const action = btn.dataset.action;
  if (action === 'buy') {
    if (game.buy()) {
      sound.play('buy');
      buildTicket();
    }
  } else if (action === 'reveal-all') {
    const open = covered.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
    open.forEach(clearSpot);
    game.revealAll();
    afterReveal(true);
    return;
  } else if (action === 'reset') confirmingReset = true;
  else if (action === 'reset-no') confirmingReset = false;
  else if (action === 'reset-yes') {
    game.reset();
    confirmingReset = false;
    buildTicket();
  } else return;
  renderStatus();
});
el('mute').addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
  renderStatus();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

buildTicket();
renderStatus();
