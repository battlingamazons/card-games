import './style.css';
import { BASKET_W, BASKET_Y, CatchGame, GROUND, H, RADIUS, W } from './game/engine';
import type { Item } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new CatchGame();
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

// ---- art ----

function tree(x: number, h: number, shade: string, fruit: string) {
  const gy = H - GROUND;
  ctx.fillStyle = '#5a3a24';
  ctx.fillRect(x - 4, gy - h * 0.45, 8, h * 0.45);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(x, gy - h * 0.6, h * 0.36, h * 0.3, 0, 0, Math.PI * 2);
  ctx.moveTo((x - h * 0.2) + (h * 0.24), gy - h * 0.48);
  ctx.ellipse(x - h * 0.2, gy - h * 0.48, h * 0.24, h * 0.2, 0, 0, Math.PI * 2);
  ctx.moveTo((x + h * 0.22) + (h * 0.24), gy - h * 0.5);
  ctx.ellipse(x + h * 0.22, gy - h * 0.5, h * 0.24, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fruit;
  for (const [dx, dy] of [[-0.14, -0.62], [0.12, -0.7], [0.2, -0.48], [-0.25, -0.46], [0, -0.52]]) {
    ctx.beginPath();
    ctx.arc(x + dx * h, gy + dy * h, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function background() {
  const gy = H - GROUND;
  const g = ctx.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, '#7fc8f0');
  g.addColorStop(0.7, '#cfeefb');
  g.addColorStop(1, '#fff6d6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun and clouds
  ctx.fillStyle = 'rgba(255,244,190,0.9)';
  ctx.beginPath();
  ctx.arc(140, 50, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const [cx, cy, s] of [[40, 70, 1], [110, 130, 0.7]] as const) {
    const x = ((cx + game.t * 3 * s) % (W + 80)) - 30;
    ctx.beginPath();
    ctx.ellipse(x, cy, 20 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.moveTo((x - 10 * s) + (11 * s), cy + 2);
    ctx.ellipse(x - 10 * s, cy + 2, 11 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.moveTo((x + 11 * s) + (12 * s), cy + 2);
    ctx.ellipse(x + 11 * s, cy + 2, 12 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // hills
  ctx.fillStyle = '#8fc86a';
  ctx.beginPath();
  ctx.moveTo(0, gy);
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, gy - 40 - Math.sin(x * 0.03) * 14 - Math.sin(x * 0.09) * 4);
  ctx.lineTo(W, gy);
  ctx.fill();
  ctx.fillStyle = '#6fb050';
  ctx.beginPath();
  ctx.moveTo(0, gy);
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, gy - 16 - Math.sin(x * 0.05 + 2) * 8);
  ctx.lineTo(W, gy);
  ctx.fill();
  tree(24, 96, '#3f8f4a', '#e0453b');
  tree(158, 80, '#3a8444', '#ff9a2a');
  // ground
  ctx.fillStyle = '#4f9a38';
  ctx.fillRect(0, gy, W, GROUND);
  ctx.fillStyle = '#7ac24a';
  ctx.fillRect(0, gy, W, 5);
  ctx.fillStyle = '#3f8230';
  for (let x = 6; x < W; x += 14) ctx.fillRect(x, gy + 13 + ((x / 14) % 3) * 4, 6, 2);
}

function drawItem(it: Item) {
  const r = RADIUS[it.kind];
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(it.rot);
  switch (it.kind) {
    case 'apple':
      ctx.fillStyle = '#e0453b';
      ctx.beginPath();
      ctx.arc(-2.5, 0, r - 1, 0, Math.PI * 2);
      ctx.arc(2.5, 0, r - 1, 0, Math.PI * 2);
      ctx.fill();
      stem();
      shine(-3, -3);
      break;
    case 'pear':
      ctx.fillStyle = '#9ac83a';
      ctx.beginPath();
      ctx.arc(0, 3, r - 1, 0, Math.PI * 2);
      ctx.arc(0, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      stem();
      shine(-3, 1);
      break;
    case 'orange':
      ctx.fillStyle = '#ff9a2a';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4f9a38';
      ctx.fillRect(-2, -r - 1, 4, 2);
      shine(-3, -3);
      break;
    case 'cherry':
      ctx.strokeStyle = '#4f9a38';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3, 2);
      ctx.lineTo(1, -8);
      ctx.lineTo(4, 2);
      ctx.stroke();
      ctx.fillStyle = '#c0204a';
      ctx.beginPath();
      ctx.arc(-3.5, 3, 4, 0, Math.PI * 2);
      ctx.arc(4, 3, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'golden': {
      const glow = 0.5 + Math.sin(game.t * 10) * 0.2;
      ctx.fillStyle = `rgba(255,230,120,${glow * 0.5})`;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffc531';
      ctx.beginPath();
      ctx.arc(-2.5, 0, r - 1, 0, Math.PI * 2);
      ctx.arc(2.5, 0, r - 1, 0, Math.PI * 2);
      ctx.fill();
      stem();
      shine(-3, -3);
      break;
    }
    case 'rock':
      ctx.fillStyle = '#6a647a';
      ctx.beginPath();
      ctx.moveTo(-r, 2);
      ctx.lineTo(-4, -r);
      ctx.lineTo(5, -r + 1);
      ctx.lineTo(r, 1);
      ctx.lineTo(3, r);
      ctx.lineTo(-5, r - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(-4, -4, 4, 2);
      break;
    case 'heart':
      ctx.fillStyle = '#ff5a8a';
      heart(0, 0, r);
      break;
  }
  ctx.restore();
}
function stem() {
  ctx.fillStyle = '#5a3a24';
  ctx.fillRect(-0.7, -11, 1.8, 4);
  ctx.fillStyle = '#4f9a38';
  ctx.beginPath();
  ctx.ellipse(3.5, -9, 3, 1.4, -0.4, 0, Math.PI * 2);
  ctx.fill();
}
function shine(x: number, y: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y, 1.8, 1.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
}
function heart(cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r);
  ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.1, cx - r * 0.7, cy - r * 1.3, cx, cy - r * 0.4);
  ctx.bezierCurveTo(cx + r * 0.7, cy - r * 1.3, cx + r * 1.6, cy - r * 0.1, cx, cy + r);
  ctx.fill();
}

function basket() {
  const sq = game.bump;
  const lean = Math.max(-1, Math.min(1, game.vx / 500)) * 0.12;
  ctx.save();
  ctx.translate(game.x, BASKET_Y + 28);
  ctx.rotate(lean);
  ctx.scale(1 + sq * 0.06, 1 - sq * 0.08);
  const w = BASKET_W / 2;
  // handle
  ctx.strokeStyle = '#8a5a2a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, -28, w - 4, Math.PI, 0);
  ctx.stroke();
  // body
  ctx.fillStyle = game.hurtT > 0 && Math.floor(game.hurtT * 20) % 2 ? '#ff9a8a' : '#c8894a';
  ctx.beginPath();
  ctx.moveTo(-w, -28);
  ctx.lineTo(w, -28);
  ctx.lineTo(w - 5, 0);
  ctx.lineTo(-w + 5, 0);
  ctx.closePath();
  ctx.fill();
  // weave
  ctx.strokeStyle = '#8a5a2a';
  ctx.lineWidth = 1;
  for (let y = -20; y < 0; y += 8) {
    ctx.beginPath();
    ctx.moveTo(-w + 1, y);
    ctx.lineTo(w - 1, y);
    ctx.stroke();
  }
  for (let x = -w + 6; x < w - 4; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, -28);
    ctx.lineTo(x * 0.85, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#e0a860';
  ctx.fillRect(-w - 1, -31, BASKET_W + 2, 5);
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(-w - 1, -27, BASKET_W + 2, 1.5);
  ctx.restore();
}

function text(s: string, x: number, y: number, size: number, fill: string, stroke = '#1a1030', align: CanvasTextAlign = 'center') {
  ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 6);
  ctx.strokeStyle = stroke;
  if (stroke !== 'transparent') ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

function draw() {
  const g = game;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  background();
  for (const it of g.items) drawItem(it);
  basket();
  for (const b of g.bits) {
    ctx.fillStyle = b.color;
    ctx.globalAlpha = Math.min(1, b.life * 3);
    ctx.fillRect(b.x, b.y, 2, 2);
  }
  ctx.globalAlpha = 1;
  for (const p of g.pops) {
    ctx.globalAlpha = Math.min(1, p.life * 2.5);
    text(p.text, p.x, p.y, p.text.startsWith('x') ? 16 : 11, p.color);
  }
  ctx.globalAlpha = 1;

  if (g.phase === 'play') {
    text(String(g.score), W / 2, 30, 30, '#fff');
    for (let i = 0; i < g.lives; i++) {
      ctx.fillStyle = '#ff5a8a';
      ctx.strokeStyle = '#1a1030';
      ctx.lineWidth = 1;
      heart(14 + i * 15, 52, 5.5);
    }
    if (g.mult > 1) text(`x${g.mult}`, W - 12, 52, 14, '#7fe0c4', '#1a1030', 'right');
    if (g.playT < 4) {
      ctx.globalAlpha = Math.min(1, 4 - g.playT) * 0.8;
      text('drag to move the basket', W / 2, 190, 11, '#fff');
      ctx.globalAlpha = 1;
    }
  }

  if (g.phase === 'title') {
    text('ORCHARD', W / 2, 78, 28, '#ffe08a');
    text('CATCH', W / 2, 108, 30, '#fff');
    text('tap to start', W / 2, 168, 14, '#fff');
    text('catch fruit, dodge rocks', W / 2, 192, 10, '#1a1030', 'rgba(255,255,255,0.8)');
    text('golden apples = 5 pts · hearts = life', W / 2, 206, 9, '#1a1030', 'rgba(255,255,255,0.8)');
    if (g.best > 0) text(`best ${g.best}`, W / 2, 136, 12, '#ffd0a0');
  } else if (g.phase === 'over') {
    const k = Math.min(1, g.deadFor / 0.35);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * -10);
    text('GAME OVER', W / 2, 72, 26, '#ff9a8a');
    ctx.fillStyle = 'rgba(20,16,48,0.84)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 58, 98, 116, 78, 10);
    ctx.fill();
    text('SCORE', W / 2 - 30, 112, 9, '#bfe3f5', 'transparent');
    text('BEST', W / 2 + 30, 112, 9, '#bfe3f5', 'transparent');
    text(String(g.score), W / 2 - 30, 134, 19, '#fff');
    text(String(g.best), W / 2 + 30, 134, 19, '#ffe08a');
    text(`${g.caught} caught`, W / 2, 158, 10, '#fff', 'transparent');
    if (g.newBest) text('NEW BEST!', W / 2, 169, 9, '#7fe0c4', 'transparent');
    if (g.deadFor > 0.7) text('tap to play again', W / 2, 208, 12, '#fff');
    ctx.restore();
  }
}

// ---- input ----

function setTarget(clientX: number) {
  const r = canvas.getBoundingClientRect();
  game.target = ((clientX - r.left) / r.width) * W;
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  setTarget(e.clientX);
  if (game.phase !== 'play') {
    game.tap();
    renderBar();
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' || e.buttons) setTarget(e.clientX);
});
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space' || e.code === 'Enter') {
    sound.unlock();
    game.tap();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
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
  const dir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  if (dir) game.target = game.x + dir * 40;
  game.update(dt);
  draw();
  if (game.best !== lastBest) {
    lastBest = game.best;
    renderBar();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __game: CatchGame }).__game = game;
