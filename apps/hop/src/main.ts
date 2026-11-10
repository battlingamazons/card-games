import './style.css';
import { BIRD_R, BIRD_X, HopGame, GAP, GROUND, H, PIPE_W, W } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new HopGame();
const sound = new Sound();
game.onEvent = (e) => sound.play(e);

app.innerHTML = `
  <div class="table fl">
    <div class="bar">
      <span>BEST <b id="best"></b></span>
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
  const availH = app.clientHeight - bar - 40; // table padding, gap and safe-area slack
  const s = Math.max(1, Math.min((availW * dpr) / W, (availH * dpr) / H));
  scale = Math.floor(s * 4) / 4;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  canvas.style.width = `${(W * scale) / dpr}px`;
  canvas.style.height = `${(H * scale) / dpr}px`;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
// Never let the page itself scroll or rubber-band while playing.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
resize();

// ---- art ----

const CLOUDS = [
  { x: 20, y: 60, s: 1 },
  { x: 110, y: 110, s: 0.7 },
  { x: 170, y: 40, s: 0.85 },
];

function cloud(x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, 20 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 10 * s, y + 2 * s, 11 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 11 * s, y + 2 * s, 12 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function wrap(v: number, span: number) {
  return ((v % span) + span) % span;
}

function background() {
  const g = ctx.createLinearGradient(0, 0, 0, H - GROUND);
  g.addColorStop(0, '#2b4a8a');
  g.addColorStop(0.55, '#e8826a');
  g.addColorStop(1, '#ffcf8a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun
  ctx.fillStyle = 'rgba(255,240,200,0.9)';
  ctx.beginPath();
  ctx.arc(128, H - GROUND - 70, 22, 0, Math.PI * 2);
  ctx.fill();
  for (const c of CLOUDS) cloud(wrap(c.x - game.scroll * 0.12 * c.s, W + 60) - 20, c.y, c.s);
  // far hills
  ctx.fillStyle = '#6a4f8a';
  ctx.beginPath();
  ctx.moveTo(0, H - GROUND);
  for (let x = 0; x <= W; x += 6) {
    const sx = x + game.scroll * 0.25;
    ctx.lineTo(x, H - GROUND - 34 - Math.sin(sx * 0.045) * 14 - Math.sin(sx * 0.11) * 5);
  }
  ctx.lineTo(W, H - GROUND);
  ctx.fill();
  // near hills
  ctx.fillStyle = '#3f3a6e';
  ctx.beginPath();
  ctx.moveTo(0, H - GROUND);
  for (let x = 0; x <= W; x += 6) {
    const sx = x + game.scroll * 0.5;
    ctx.lineTo(x, H - GROUND - 14 - Math.sin(sx * 0.07 + 2) * 8);
  }
  ctx.lineTo(W, H - GROUND);
  ctx.fill();
}

function pillar(x: number, top: number, bottom: number, flip: boolean) {
  // top..bottom is the visible column; the cap sits at the gap end.
  const h = bottom - top;
  if (h <= 0) return;
  const g = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  g.addColorStop(0, '#2f7f78');
  g.addColorStop(0.4, '#58c7ae');
  g.addColorStop(1, '#1f5c63');
  ctx.fillStyle = g;
  ctx.fillRect(x + 2, top, PIPE_W - 4, h);
  // carved bands
  ctx.fillStyle = 'rgba(10,40,50,0.28)';
  const capY = flip ? bottom - 12 : top;
  for (let y = flip ? bottom - 12 - 14 : top + 12 + 14; flip ? y > top : y < bottom; y += flip ? -14 : 14) {
    ctx.fillRect(x + 2, y, PIPE_W - 4, 2);
  }
  // cap
  ctx.fillStyle = '#7fe0c4';
  ctx.fillRect(x - 2, capY, PIPE_W + 4, 12);
  ctx.fillStyle = '#2a8a82';
  ctx.fillRect(x - 2, flip ? capY : capY + 10, PIPE_W + 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 1, capY + 2, 3, 8);
}

function ground() {
  const gy = H - GROUND;
  ctx.fillStyle = '#d9b36a';
  ctx.fillRect(0, gy, W, GROUND);
  ctx.fillStyle = '#7ac24a';
  ctx.fillRect(0, gy, W, 8);
  ctx.fillStyle = '#4f9a38';
  const off = wrap(game.scroll, 12);
  for (let x = -12 + -off; x < W + 12; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, gy + 8);
    ctx.lineTo(x + 6, gy + 8);
    ctx.lineTo(x + 3, gy + 2);
    ctx.fill();
  }
  ctx.fillStyle = '#b8924e';
  for (let x = -16 + -wrap(game.scroll, 16); x < W + 16; x += 16) ctx.fillRect(x, gy + 18, 8, 3);
  ctx.fillStyle = '#a07c3c';
  ctx.fillRect(0, gy + 8, W, 2);
}

function bird() {
  const g = game;
  const wing = g.phase === 'over' ? 0.4 : Math.sin(g.t * (g.phase === 'play' ? 28 : 14));
  ctx.save();
  ctx.translate(BIRD_X, g.y);
  ctx.rotate(g.tilt * 0.6);
  // tail feathers
  ctx.fillStyle = '#c24a6a';
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(-14, -4);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-14, 5);
  ctx.closePath();
  ctx.fill();
  // body
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_R + 1.5, BIRD_R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff0c2';
  ctx.beginPath();
  ctx.ellipse(1, 3, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // head tuft
  ctx.fillStyle = '#e0457b';
  ctx.beginPath();
  ctx.moveTo(-1, -6.5);
  ctx.lineTo(-3, -12);
  ctx.lineTo(1, -8);
  ctx.lineTo(3, -13);
  ctx.lineTo(4, -6.5);
  ctx.closePath();
  ctx.fill();
  // wing
  ctx.fillStyle = '#e0457b';
  ctx.save();
  ctx.translate(-3, 1);
  ctx.rotate(wing * 0.7);
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 3.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(4.5, -2.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1030';
  if (g.phase === 'over') {
    ctx.fillRect(3, -3.5, 3.5, 1);
    ctx.fillRect(4.2, -4.8, 1, 3.5);
  } else {
    ctx.beginPath();
    ctx.arc(5.3, -2.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // beak
  ctx.fillStyle = '#3b2a6a';
  ctx.beginPath();
  ctx.moveTo(7.5, 0);
  ctx.lineTo(13, 1.5);
  ctx.lineTo(7.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function text(s: string, x: number, y: number, size: number, fill: string, stroke = '#1a1030') {
  ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 6);
  ctx.strokeStyle = stroke;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

function draw() {
  const g = game;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  background();
  for (const p of g.pipes) {
    pillar(p.x, 0, p.gapY - GAP / 2, true);
    pillar(p.x, p.gapY + GAP / 2, H - GROUND, false);
  }
  ground();
  bird();

  if (g.phase === 'play' || g.phase === 'over') text(String(g.score), W / 2, 44, 34, '#fff');

  if (g.phase === 'title') {
    text('PILLAR HOP', W / 2, 78, 23, '#ffe08a');
    text('tap to start', W / 2, 200, 14, '#fff');
    if (g.best > 0) text(`best ${g.best}`, W / 2, 224, 12, '#ffd0a0');
  } else if (g.phase === 'ready') {
    text('GET READY', W / 2, 70, 24, '#ffe08a');
    text('tap to flap', W / 2, 200, 14, '#fff');
  } else if (g.phase === 'over') {
    const k = Math.min(1, g.deadFor / 0.35);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * -10);
    text('GAME OVER', W / 2, 92, 26, '#ff9a8a');
    ctx.fillStyle = 'rgba(20,16,48,0.82)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 54, 120, 108, 66, 10);
    ctx.fill();
    text('SCORE', W / 2 - 27, 134, 9, '#bfe3f5', 'transparent');
    text('BEST', W / 2 + 27, 134, 9, '#bfe3f5', 'transparent');
    text(String(g.score), W / 2 - 27, 156, 24, '#fff');
    text(String(g.best), W / 2 + 27, 156, 24, '#ffe08a');
    if (g.newBest) text('NEW BEST!', W / 2, 177, 10, '#7fe0c4', 'transparent');
    if (g.deadFor > 0.6) text('tap to play again', W / 2, 218, 12, '#fff');
    ctx.restore();
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.7})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ---- input ----

let lastTap = 0;
function tap() {
  const now = performance.now();
  if (now - lastTap < 30) return;
  lastTap = now;
  sound.unlock();
  game.tap();
  renderBar();
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tap();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
    e.preventDefault();
    if (!e.repeat) tap();
  }
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

el('mute').addEventListener('pointerdown', (e) => e.stopPropagation());
el('mute').addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
  renderBar();
});

function renderBar() {
  el('best').textContent = String(game.best);
  el('mute').textContent = sound.muted ? '🔇' : '🔊';
}
renderBar();

let prev = performance.now();
let lastBest = -1;
function frame(now: number) {
  const dt = (now - prev) / 1000;
  prev = now;
  game.update(dt);
  draw();
  if (game.best !== lastBest) {
    lastBest = game.best;
    renderBar();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __game: HopGame }).__game = game;
