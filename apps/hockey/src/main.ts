import './style.css';
import { type Controls, GOAL, GX0, HockeyGame, RK, RP, TH, TW, WIN_SCORE } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new HockeyGame();
const sound = new Sound();
game.onEvent = (e) => sound.play(e);

app.innerHTML = `
  <div class="table hk">
    <div class="hud">
      <div class="hud-cell"><span>RIVAL</span><b id="s-ai">0</b></div>
      <div class="hud-cell mid"><span>FIRST TO ${WIN_SCORE}</span><b id="lvl"></b></div>
      <div class="hud-cell"><span>YOU</span><b id="s-me">0</b></div>
      <button class="icon-btn" id="mute" aria-label="Toggle sound"></button>
    </div>
    <div class="screen" id="screen">
      <canvas id="game"></canvas>
      <div class="overlay" id="overlay"></div>
    </div>
  </div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const el = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!;

// The canvas shows the table plus a rim of MARGIN game pixels all round.
const MARGIN = 12;
const CW = TW + MARGIN * 2;
const CH = TH + MARGIN * 2;

let scale = 1;
let dprNow = 1;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  dprNow = dpr;
  const availW = Math.min(document.documentElement.clientWidth - 16, 520);
  const availH = window.innerHeight - 96; // room for the scoreboard
  const byW = Math.floor((availW * dpr) / CW);
  const byH = Math.floor((availH * dpr) / CH);
  scale = Math.max(1, Math.min(byW, byH));
  canvas.width = CW * scale;
  canvas.height = CH * scale;
  canvas.style.width = `${(CW * scale) / dpr}px`;
  canvas.style.height = `${(CH * scale) / dpr}px`;
  el('screen').style.width = canvas.style.width;
  el('screen').style.height = canvas.style.height;
}
window.addEventListener('resize', resize);
resize();

// ---- drawing ----

function disc(x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function paddle(x: number, y: number, rim: string, face: string, core: string) {
  disc(x, y + 1.5, RP, 'rgba(0,0,0,0.3)');
  disc(x, y, RP, rim);
  disc(x, y, RP - 3, face);
  disc(x, y, RP - 9, core);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(x - 3, y - 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  const g = game;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const sh = g.shake > 0 ? (Math.random() - 0.5) * 3 : 0;
  ctx.fillStyle = '#05121c';
  ctx.fillRect(0, 0, CW, CH);
  ctx.translate(MARGIN + sh, MARGIN);

  // Rim and surface.
  ctx.fillStyle = '#3a4a5a';
  ctx.beginPath();
  ctx.roundRect(-9, -9, TW + 18, TH + 18, 12);
  ctx.fill();
  ctx.fillStyle = '#10202c';
  ctx.beginPath();
  ctx.roundRect(-4, -4, TW + 8, TH + 8, 9);
  ctx.fill();
  ctx.fillStyle = '#1a6a8a';
  ctx.fillRect(0, 0, TW, TH);
  ctx.fillStyle = '#2a8aaa';
  ctx.fillRect(0, 0, TW, 3);
  ctx.fillRect(0, TH - 3, TW, 3);

  // Air holes.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let y = 6; y < TH; y += 12) for (let x = 6; x < TW; x += 12) ctx.fillRect(x, y, 1, 1);

  // Centre line, circle and faint end-zone arcs.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, TH / 2);
  ctx.lineTo(TW, TH / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(TW / 2, TH / 2, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(TW / 2, 0, 38, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(TW / 2, TH, 38, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Goals.
  ctx.fillStyle = '#05121c';
  ctx.fillRect(GX0 - 2, -9, GOAL + 4, 9);
  ctx.fillRect(GX0 - 2, TH, GOAL + 4, 9);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(GX0, 0, GOAL, 3);
  ctx.fillRect(GX0, TH - 3, GOAL, 3);

  // Puck trail, then the puck.
  g.trail.forEach((t, i) => {
    ctx.globalAlpha = ((i + 1) / g.trail.length) * 0.25;
    disc(t.x, t.y, RK - 1, '#0a0a12');
  });
  ctx.globalAlpha = 1;
  disc(g.puck.x, g.puck.y + 1.5, RK, 'rgba(0,0,0,0.35)');
  disc(g.puck.x, g.puck.y, RK, '#0c0d16');
  disc(g.puck.x, g.puck.y, RK - 2.5, '#2a2d44');
  disc(g.puck.x - 2, g.puck.y - 2, 1.6, 'rgba(255,255,255,0.45)');

  // Paddles.
  paddle(g.ai.x, g.ai.y, '#7a1a1a', '#ff5a5a', '#ff9a9a');
  paddle(g.me.x, g.me.y, '#0f4a66', '#4ad0ff', '#b8ecff');

  // Sparks.
  for (const f of g.fx) {
    ctx.globalAlpha = 1 - f.t / 0.5;
    ctx.fillStyle = f.color;
    ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Banner: GOAL!, THEY SCORE, GET READY.
  const banner = g.phase === 'ready' ? 'GET READY' : g.msgT > 0 && g.phase !== 'over' ? g.msg : '';
  if (banner) {
    ctx.font = 'bold 20px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(banner, TW / 2, TH / 2 - 40);
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(banner, TW / 2, TH / 2 - 40);
  }
}

// ---- HUD and overlay ----

let lastHud = '';
function updateHud() {
  const g = game;
  const key = `${g.score}|${g.level}|${g.streak}|${g.best}|${sound.muted}|${g.phase}`;
  if (key === lastHud) return;
  lastHud = key;
  el('s-ai').textContent = String(g.score[1]);
  el('s-me').textContent = String(g.score[0]);
  el('lvl').textContent = g.phase === 'title' ? `Streak ${g.streak}` : `Level ${g.level + 1}`;
  el('mute').textContent = sound.muted ? '🔇' : '🔊';
}

let lastOverlay = '';
function updateOverlay() {
  const g = game;
  let html = '';
  if (g.phase === 'title') {
    html = `<div class="ov-box"><h1>AIR HOCKEY</h1>
      <p>Drag your finger anywhere to slide your paddle (the blue one) around your half.<br>First to ${WIN_SCORE} goals wins. Each win in a row makes the rival tougher.</p>
      <p class="streak">Win streak <b>${g.streak}</b> · Best <b>${g.best}</b></p>
      <button data-start>Tap to start</button></div>`;
  } else if (g.phase === 'over') {
    html = `<div class="ov-box"><h1 class="${g.won ? 'w' : 'l'}">${g.won ? 'YOU WIN!' : 'YOU LOSE'}</h1>
      <p class="final">${g.score[0]} – ${g.score[1]}</p>
      <p class="streak">${g.won ? `Win streak <b>${g.streak}</b> · next rival is tougher` : 'Streak reset'} · Best <b>${g.best}</b></p>
      <button data-start>Play again</button></div>`;
  }
  if (html === lastOverlay) return;
  lastOverlay = html;
  overlay.innerHTML = html;
  overlay.style.display = html ? 'flex' : 'none';
}

// ---- input: drag anywhere on the table ----

let touchTarget: { x: number; y: number } | null = null;
let touchId: number | null = null;
const keys = new Set<string>();

/** Where the paddle sits relative to the fingertip, so the finger doesn't hide it. */
const FINGER_LIFT = 18;

function toTable(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const k = (dprNow / scale) * 1; // css px -> game px
  return { x: (e.clientX - rect.left) * k - MARGIN, y: (e.clientY - rect.top) * k - MARGIN - FINGER_LIFT };
}

canvas.addEventListener('pointerdown', (e) => {
  if (touchId !== null || game.phase === 'title' || game.phase === 'over') return;
  e.preventDefault();
  sound.unlock();
  canvas.setPointerCapture(e.pointerId);
  touchId = e.pointerId;
  touchTarget = toTable(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === touchId) touchTarget = toTable(e);
});
function touchEnd(e: PointerEvent) {
  if (e.pointerId !== touchId) return;
  touchId = null;
  touchTarget = null;
}
canvas.addEventListener('pointerup', touchEnd);
canvas.addEventListener('pointercancel', touchEnd);
canvas.addEventListener('lostpointercapture', touchEnd);

overlay.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-start]')) {
    sound.unlock();
    game.start();
  }
});
el('mute').addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

const KEYDIR: Record<string, string> = { ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'u', w: 'u', ArrowDown: 'd', s: 'd' };
window.addEventListener('keydown', (e) => {
  const k = KEYDIR[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (e.key === 'Enter' && (game.phase === 'title' || game.phase === 'over')) {
    sound.unlock();
    return game.start();
  }
  if (!k) return;
  e.preventDefault();
  sound.unlock();
  keys.add(k);
});
window.addEventListener('keyup', (e) => {
  const k = KEYDIR[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (k) keys.delete(k);
});
window.addEventListener('blur', () => {
  keys.clear();
  touchId = null;
  touchTarget = null;
});

function controls(): Controls {
  return {
    tx: touchTarget?.x ?? null,
    ty: touchTarget?.y ?? null,
    kx: (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0),
    ky: (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0),
  };
}

// ---- main loop ----

let last = performance.now();
function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  game.update(dt, controls());
  draw();
  updateHud();
  updateOverlay();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
