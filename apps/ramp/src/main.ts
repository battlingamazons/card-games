import './style.css';
import { BALLS, HOLES, SkeeGame, H, W } from './game/engine';
import type { GameEvent } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new SkeeGame();
const sound = new Sound();
game.onEvent = (e: GameEvent) => sound.play(e);

app.innerHTML = `
  <div class="table fl">
    <div class="bar">
      <span>BEST <b id="best"></b> · TICKETS <b id="tix"></b></span>
      <button class="icon-btn" id="mute" aria-label="Toggle sound"></button>
    </div>
    <div class="screen" id="screen"><canvas id="game"></canvas></div>
  </div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const el = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!;

let scale = 1;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const availW = Math.min(document.documentElement.clientWidth - 16, 520);
  const bar = document.querySelector<HTMLElement>('.bar')!.offsetHeight;
  const availH = app.clientHeight - bar - 40;
  const s = Math.max(1, Math.min((availW * dpr) / W, (availH * dpr) / H));
  scale = Math.floor(s * 4) / 4;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  canvas.style.width = `${(W * scale) / dpr}px`;
  canvas.style.height = `${(H * scale) / dpr}px`;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
resize();

// ---- geometry ----

const BX = 90; // board centre x
const BHW = 76; // board half width
const boardY = (y: number) => 170 - y * 120; // y: 0 (near) .. 1 (far)
const boardX = (x: number) => BX + x * BHW;
const laneSY = (s: number) => 304 - s * 120;
const laneHW = (s: number) => 70 - 22 * s;
const laneSX = (x: number, s: number) => 90 + x * laneHW(s);
function text(s: string, x: number, y: number, size: number, fill: string, stroke = '#1a0a0a', align: CanvasTextAlign = 'center') {
  ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 4.5);
  if (stroke !== 'transparent') {
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}
function rr(x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function ball(x: number, y: number, r: number) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#e8b080');
  g.addColorStop(0.5, '#a05a2a');
  g.addColorStop(1, '#4a2410');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

// ---- drawing ----

function drawBoard() {
  const g = game;
  // cabinet
  rr(6, 44, W - 12, 134, 10, '#3a1a0a');
  rr(9, 47, W - 18, 128, 8, '#c8893a');
  // playfield
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(14, 50, W - 28, 122, 6);
  ctx.clip();
  const field = ctx.createLinearGradient(0, 50, 0, 172);
  field.addColorStop(0, '#2a3a8a');
  field.addColorStop(1, '#3a5ab0');
  ctx.fillStyle = field;
  ctx.fillRect(14, 50, W - 28, 122);
  // painted arcs centred near the player
  const arcs: [number, string][] = [[150, '#c83a3a'], [120, '#f4efe0'], [92, '#3a5ab0'], [64, '#f4efe0'], [38, '#c83a3a']];
  for (const [r, c] of arcs) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(90, 196, r, Math.PI, 0);
    ctx.fill();
  }
  // lane wood lines
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 14; x < W - 14; x += 19) ctx.fillRect(x, 50, 1, 122);
  ctx.restore();
  // top wall shade
  rr(14, 50, W - 28, 5, 3, 'rgba(0,0,0,0.35)');
  // holes
  for (const h of HOLES) {
    const hx = boardX(h.x);
    const hy = boardY(h.y);
    const r = h.r * BHW;
    const flash = g.hit === h && g.hitT > 0 ? Math.floor(g.hitT * 14) % 2 : 0;
    ctx.fillStyle = flash ? '#fff6a0' : h.value >= 100 ? '#e0453b' : '#d8b060';
    ctx.beginPath();
    ctx.arc(hx, hy, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0404';
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(hx - r * 0.3, hy - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    text(String(h.value), hx, hy - r - 5, h.value >= 100 ? 8 : 9, '#fff', '#0a0404');
  }
  // ball on the board / in the air
  if (g.phase === 'board') {
    const bx = boardX(g.bx);
    const by = boardY(g.by);
    ell(bx + 1.5, by + 2, 5.5, 3, 'rgba(0,0,0,0.4)');
    ball(bx, by, 6);
  } else if (g.phase === 'air') {
    const k = g.airT / g.airDur;
    const x0 = boardX(g.fromX);
    const y0 = 184;
    const x1 = boardX(g.toX);
    const y1 = boardY(Math.min(g.toY, 1));
    const bx = x0 + (x1 - x0) * k;
    const by = y0 + (y1 - y0) * k;
    const lift = Math.sin(k * Math.PI) * (18 + 30 * Math.min(1, g.toY));
    ell(bx + 2, by + 3, 5 + 1.5 * Math.sin(k * Math.PI), 2.6, 'rgba(0,0,0,0.35)');
    ball(bx, by - lift, 7 + 2 * Math.sin(k * Math.PI));
  } else if (g.phase === 'settle' && g.hit) {
    // ball is in the hole; nothing to draw
  }
  // pops
  for (const p of g.pops) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    text(p.text, boardX(p.x), boardY(p.y) - 10, 12, p.color);
  }
  ctx.globalAlpha = 1;
}
function ell(x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLane() {
  const g = game;
  // background under the lane
  ctx.fillStyle = '#1c0f0f';
  ctx.fillRect(0, 176, W, H - 176);
  // gutters
  ctx.fillStyle = '#0a0505';
  ctx.beginPath();
  ctx.moveTo(90 - 80, 318);
  ctx.lineTo(90 + 80, 318);
  ctx.lineTo(90 + 54, 184);
  ctx.lineTo(90 - 54, 184);
  ctx.closePath();
  ctx.fill();
  // lane surface
  const lg = ctx.createLinearGradient(0, 184, 0, 318);
  lg.addColorStop(0, '#9a6a34');
  lg.addColorStop(1, '#c8924a');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(90 - 70, 318);
  ctx.lineTo(90 + 70, 318);
  ctx.lineTo(90 + 48, 184);
  ctx.lineTo(90 - 48, 184);
  ctx.closePath();
  ctx.fill();
  // planks
  ctx.strokeStyle = 'rgba(70,35,10,0.35)';
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(90 + (i / 4) * 70, 318);
    ctx.lineTo(90 + (i / 4) * 48, 184);
    ctx.stroke();
  }
  for (let s = 0.1; s < 1; s += 0.2) {
    ctx.beginPath();
    ctx.moveTo(90 - laneHW(s), laneSY(s) + 8);
    ctx.lineTo(90 + laneHW(s), laneSY(s) + 8);
    ctx.stroke();
  }
  // lane edges
  ctx.strokeStyle = '#5a3414';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(90 - 70, 318);
  ctx.lineTo(90 - 48, 184);
  ctx.moveTo(90 + 70, 318);
  ctx.lineTo(90 + 48, 184);
  ctx.stroke();
  // ramp lip
  const rg = ctx.createLinearGradient(0, 176, 0, 190);
  rg.addColorStop(0, '#e8b060');
  rg.addColorStop(1, '#8a5a24');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(90 - 52, 190);
  ctx.quadraticCurveTo(90, 172, 90 + 52, 190);
  ctx.lineTo(90 + 48, 184);
  ctx.quadraticCurveTo(90, 168, 90 - 48, 184);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const on = Math.floor(g.t * 6 + i) % 2;
    const lx = 90 - 40 + i * 13.3;
    ctx.fillStyle = on ? '#ffe08a' : '#a07a30';
    ctx.beginPath();
    ctx.arc(lx, 178.5 + Math.abs(i - 3) * 1.1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // aim guide
  if (g.phase === 'aim' && !g.dragging) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(laneSX(g.laneX, 0), laneSY(0) - 10);
    ctx.lineTo(laneSX(g.laneX, 1), laneSY(1));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // ball on the lane
  if (g.phase === 'aim' || g.phase === 'roll') {
    const s = g.s;
    const x = laneSX(g.laneX, s);
    const y = laneSY(s);
    const r = 10 - 3.5 * s;
    ell(x + 2, y + r * 0.7, r * 0.9, r * 0.35, 'rgba(0,0,0,0.35)');
    ball(x, y, r);
  }
}

function hud() {
  const g = game;
  ctx.fillStyle = '#2a1008';
  ctx.fillRect(0, 0, W, 42);
  ctx.fillStyle = '#4a2010';
  ctx.fillRect(0, 40, W, 2);
  text(String(g.score), 8, 14, 20, '#ffe08a', '#1a0a0a', 'left');
  text('SCORE', 8, 32, 7, '#d8a070', 'transparent', 'left');
  // balls left
  for (let i = 0; i < BALLS; i++) {
    const used = i >= g.ballsLeft + (g.phase === 'aim' ? 0 : 0);
    const x = 98 + (i % 5) * 15;
    const y = 12 + Math.floor(i / 5) * 15;
    ctx.globalAlpha = used ? 0.25 : 1;
    ball(x, y, 5.5);
    ctx.globalAlpha = 1;
  }
  if (g.noteT > 0) text(g.note, W / 2, 190, 12, '#ffe08a');
}

function draw() {
  const g = game;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#1c0f0f';
  ctx.fillRect(0, 0, W, H);
  drawBoard();
  drawLane();
  hud();

  if (g.phase === 'aim' && !g.dragging && g.ballsLeft === BALLS) {
    text('PUT YOUR FINGER ON THE BALL', W / 2, 226, 9, '#fff');
    text('AND FLICK IT UP THE LANE', W / 2, 240, 9, '#ffe8b0');
    text('faster flick = farther', W / 2, 254, 8, '#d8a070', 'transparent');
  } else if (g.phase === 'aim' && !g.dragging) {
    text('flick the ball', W / 2, 240, 9, 'rgba(255,255,255,0.8)');
  }
  drawPrediction();

  if (g.phase === 'title') {
    ctx.fillStyle = 'rgba(20,8,8,0.8)';
    ctx.fillRect(0, 0, W, H);
    text('RAMP', W / 2, 62, 34, '#ffe08a');
    text('ROLLERS', W / 2, 98, 30, '#ff9a6a');
    ball(W / 2, 150, 16);
    text('Flick the ball up the lane,', W / 2, 190, 9, '#fff', 'transparent');
    text('off the ramp and into the rings.', W / 2, 203, 9, '#fff', 'transparent');
    text('Flick faster to send it farther.', W / 2, 220, 8, '#d8a070', 'transparent');
    if (Math.floor(g.t * 2.5) % 2) text('TAP TO START', W / 2, 262, 14, '#fff');
    if (g.best > 0) text(`best ${g.best}`, W / 2, 288, 10, '#ffd0a0');
  } else if (g.phase === 'over') {
    const k = Math.min(1, g.deadFor / 0.4);
    ctx.fillStyle = `rgba(20,8,8,${0.85 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = k;
    text('GAME OVER', W / 2, 62, 26, '#ff9a6a');
    rr(W / 2 - 62, 84, 124, 110, 12, 'rgba(60,24,12,0.95)');
    text('SCORE', W / 2 - 30, 100, 9, '#d8a070', 'transparent');
    text('BEST', W / 2 + 30, 100, 9, '#d8a070', 'transparent');
    text(String(g.score), W / 2 - 30, 124, 22, '#fff');
    text(String(g.best), W / 2 + 30, 124, 22, '#ffe08a');
    text(`+${g.earned} tickets`, W / 2, 154, 11, '#7fe0c4', 'transparent');
    text(`${g.tickets} saved`, W / 2, 170, 9, '#bfe3f5', 'transparent');
    if (g.newBest) text('NEW BEST!', W / 2, 186, 9, '#ffe08a', 'transparent');
    if (g.deadFor > 0.8) text('tap to play again', W / 2, 226, 12, '#fff');
    ctx.globalAlpha = 1;
  }
}

// ---- input ----

function pos(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
let activeId = -1;
interface Sample {
  t: number;
  x: number;
  y: number;
}
let samples: Sample[] = [];
function sampleAt(e: PointerEvent) {
  const p = pos(e);
  samples.push({ t: performance.now(), x: p.x, y: p.y });
  if (samples.length > 12) samples.shift();
  return p;
}
/** Finger velocity in game px/s from the last ~100 ms of movement. */
function fingerVelocity() {
  const now = performance.now();
  const recent = samples.filter((s) => now - s.t < 120);
  if (recent.length < 2) return { up: 0, vx: 0 };
  const a = recent[0];
  const b = recent[recent.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0.004) return { up: 0, vx: 0 };
  // a finger that has stopped is not a flick
  if (now - b.t > 100) return { up: 0, vx: 0 };
  return { up: (a.y - b.y) / dt, vx: (b.x - a.x) / dt };
}
function laneFromScreen(x: number, y: number) {
  return { lx: (x - 90) / 70, s0: (304 - y) / 120 };
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const { x, y } = pos(e);
  if (game.phase === 'title' || game.phase === 'over') {
    game.tap();
    renderBar();
    return;
  }
  if (game.phase === 'aim' && y > 200 && activeId < 0) {
    activeId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    samples = [];
    sampleAt(e);
    const l = laneFromScreen(x, y);
    game.grab(l.lx, l.s0);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activeId) return;
  const p = sampleAt(e);
  const l = laneFromScreen(p.x, p.y);
  game.drag(l.lx, l.s0);
});
function up(e: PointerEvent) {
  if (e.pointerId !== activeId) return;
  sampleAt(e);
  const v = fingerVelocity();
  activeId = -1;
  samples = [];
  if (e.type === 'pointercancel') game.cancelDrag();
  else game.flick(v.up, v.vx);
}
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);

/** Faint marker on the board showing where the ball would land at the current finger speed. */
function drawPrediction() {
  const g = game;
  if (g.phase !== 'aim' || !g.dragging) return;
  const v = fingerVelocity();
  if (v.up < 250) return;
  const pr = g.predict(v.up, v.vx);
  if (!pr) {
    text('TOO SOFT', W / 2, 190, 10, '#ff9a8a');
    return;
  }
  const px = boardX(pr.x);
  const py = boardY(Math.min(pr.y, 1));
  const pulse = 1 + Math.sin(g.t * 14) * 0.15;
  ctx.strokeStyle = pr.y > 1 ? 'rgba(255,150,120,0.95)' : 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.arc(px, py, 7 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(px - 3, py);
  ctx.lineTo(px + 3, py);
  ctx.moveTo(px, py - 3);
  ctx.lineTo(px, py + 3);
  ctx.stroke();
}
document.addEventListener('contextmenu', (e) => e.preventDefault());

el('mute').addEventListener('pointerdown', (e) => e.stopPropagation());
el('mute').addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
  renderBar();
});

function renderBar() {
  el('best').textContent = String(game.best);
  el('tix').textContent = String(game.tickets);
  el('mute').textContent = sound.muted ? '🔇' : '🔊';
}
renderBar();

let prev = performance.now();
let lastKey = '';
function frame(now: number) {
  const dt = (now - prev) / 1000;
  prev = now;
  game.update(dt);
  draw();
  const k = `${game.best}|${game.tickets}`;
  if (k !== lastKey) {
    lastKey = k;
    renderBar();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __game: SkeeGame }).__game = game;
