import './style.css';
import { BALL_R, BRICK_H, BRICK_W, BrickGame, CEIL, H, PADDLE_H, PADDLE_Y, type PowerKind, W } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new BrickGame();
const sound = new Sound();
game.onEvent = (e) => sound.play(e);

app.innerHTML = `
  <div class="table bk">
    <div class="bar">
      <span>BEST <b id="best"></b></span>
      <button class="icon-btn" id="mute" aria-label="Toggle sound"></button>
    </div>
    <div class="screen"><canvas id="game"></canvas></div>
  </div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const el = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!;

let scale = 1;
let cssPerUnit = 1; // CSS pixels per game pixel
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
  cssPerUnit = scale / dpr;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
resize();

// ---- art ----

// One hue per row, top to bottom.
const ROW_HUES = [330, 18, 45, 140, 185, 215, 255, 285];
const hue = (row: number) => ROW_HUES[row % ROW_HUES.length];

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function brick(x: number, y: number, row: number, hp: number, maxHp: number) {
  const h = hue(row);
  const dmg = maxHp - hp; // darker and cracked as it wears down
  ctx.fillStyle = `hsl(${h} 80% ${58 - dmg * 7}%)`;
  roundRect(x + 0.7, y + 0.7, BRICK_W - 1.4, BRICK_H - 1.4, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(x + 1.6, y + 1.4, BRICK_W - 3.2, 2.2, 1);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + 1.6, y + BRICK_H - 2.6, BRICK_W - 3.2, 1.2);
  if (maxHp > 1) {
    // armoured bricks get a bright rim, one pip per remaining hit
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.8;
    roundRect(x + 0.7, y + 0.7, BRICK_W - 1.4, BRICK_H - 1.4, 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < hp; i++) ctx.fillRect(x + BRICK_W / 2 - hp * 2 + i * 4 + 0.5, y + BRICK_H / 2 - 0.5, 2, 2);
  }
}

const DROP_STYLE: Record<PowerKind, { label: string; hue: number }> = {
  wide: { label: '↔', hue: 140 },
  slow: { label: '◔', hue: 205 },
  multi: { label: '⁝', hue: 48 },
  life: { label: '♥', hue: 340 },
};

function background() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1a5e');
  g.addColorStop(1, '#0f0a26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(180,150,255,0.08)';
  for (let y = CEIL + 8; y < H; y += 16) for (let x = 8; x < W; x += 16) ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, W, CEIL);
  ctx.fillStyle = 'rgba(200,170,255,0.5)';
  ctx.fillRect(0, CEIL - 1, W, 1);
}

function text(s: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center', stroke = '#120a30') {
  ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (stroke !== 'none') {
    ctx.lineWidth = Math.max(2, size / 6);
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

const trails = new Map<object, { x: number; y: number }[]>();

function draw() {
  const g = game;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const sh = g.shake > 0 ? (Math.random() - 0.5) * 4 * g.shake : 0;
  ctx.translate(sh, 0);
  background();

  // HUD
  text(`${g.score}`, 6, 12, 11, '#fff', 'left', 'none');
  text(`LEVEL ${g.level}`, W / 2, 12, 9, '#c9b8ff', 'center', 'none');
  for (let i = 0; i < g.lives; i++) {
    ctx.fillStyle = '#ff7ab0';
    roundRect(W - 8 - i * 11 - 8, 8, 8, 5, 2.5);
    ctx.fill();
  }

  for (const b of g.bricks) brick(b.x, b.y, b.row, b.hp, b.maxHp);

  // break-up sparks
  for (const b of g.bursts) {
    const k = b.t / 0.4;
    ctx.fillStyle = `hsla(${hue(b.row)} 90% 70% / ${1 - k})`;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + b.x;
      ctx.fillRect(b.x + Math.cos(a) * k * 12 - 1, b.y + Math.sin(a) * k * 12 - 1 + k * 4, 2, 2);
    }
  }

  // falling power-ups
  for (const d of g.drops) {
    const s = DROP_STYLE[d.kind];
    ctx.fillStyle = `hsl(${s.hue} 85% 55%)`;
    roundRect(d.x - 7, d.y - 5, 14, 10, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.8;
    roundRect(d.x - 7, d.y - 5, 14, 10, 5);
    ctx.stroke();
    text(s.label, d.x, d.y + 0.5, 9, '#fff', 'center', 'none');
  }

  // paddle
  const pw = g.paddleW;
  ctx.shadowColor = g.wideT > 0 ? '#6dffb0' : '#8ad0ff';
  ctx.shadowBlur = 8 * scale;
  ctx.fillStyle = g.wideT > 0 ? '#6dffb0' : '#8ad0ff';
  roundRect(g.paddleX - pw / 2, PADDLE_Y, pw, PADDLE_H, 3);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  roundRect(g.paddleX - pw / 2 + 3, PADDLE_Y + 1, pw - 6, 1.6, 1);
  ctx.fill();

  // balls with a short trail
  for (const b of g.balls) {
    let tr = trails.get(b);
    if (!tr) { tr = []; trails.set(b, tr); }
    if (g.phase === 'play') {
      tr.push({ x: b.x, y: b.y });
      if (tr.length > 7) tr.shift();
    } else tr.length = 0;
    for (let i = 0; i < tr.length; i++) {
      ctx.fillStyle = `rgba(255,240,200,${(i / tr.length) * 0.25})`;
      ctx.beginPath();
      ctx.arc(tr[i].x, tr[i].y, BALL_R * (0.5 + i / tr.length / 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = '#ffe9a8';
    ctx.shadowBlur = 8 * scale;
    ctx.fillStyle = g.slowT > 0 ? '#9fe8ff' : '#fff6d6';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (g.balls.length === 0) trails.clear();

  if (g.phase === 'title') {
    shade();
    text('BRICK BOUNCE', W / 2, 120, 21, '#ffd86b');
    text('drag to slide the paddle', W / 2, 168, 11, '#fff');
    text('tap to start', W / 2, 190, 13, '#c9b8ff');
    if (g.best > 0) text(`best ${g.best}`, W / 2, 218, 11, '#ffd0a0');
  } else if (g.phase === 'serve') {
    text('tap to launch', W / 2, 232, 12, '#fff');
  } else if (g.phase === 'clear') {
    shade();
    text('LEVEL CLEAR!', W / 2, 130, 24, '#7dffc0');
    text(`+${100 * g.level} bonus`, W / 2, 160, 12, '#fff');
    if (g.phaseT > 0.7) text('tap for next level', W / 2, 200, 12, '#c9b8ff');
  } else if (g.phase === 'over') {
    shade();
    text('GAME OVER', W / 2, 110, 26, '#ff8aa0');
    ctx.fillStyle = 'rgba(20,12,50,0.85)';
    roundRect(W / 2 - 56, 128, 112, 62, 10);
    ctx.fill();
    text('SCORE', W / 2 - 28, 141, 9, '#c9b8ff', 'center', 'none');
    text('BEST', W / 2 + 28, 141, 9, '#c9b8ff', 'center', 'none');
    text(String(g.score), W / 2 - 28, 162, 20, '#fff');
    text(String(g.best), W / 2 + 28, 162, 20, '#ffd86b');
    if (g.newBest) text('NEW BEST!', W / 2, 181, 10, '#7dffc0', 'center', 'none');
    if (g.phaseT > 0.7) text('tap to play again', W / 2, 216, 12, '#fff');
  }
}

function shade() {
  ctx.fillStyle = 'rgba(10,6,30,0.55)';
  ctx.fillRect(0, CEIL, W, H - CEIL);
}

// ---- input ----

let dragId: number | null = null;
let lastX = 0;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  dragId = e.pointerId;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
  game.tap();
  renderBar();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId) return;
  game.move(((e.clientX - lastX) / cssPerUnit) * 1.4);
  lastX = e.clientX;
});
const endDrag = (e: PointerEvent) => {
  if (e.pointerId === dragId) dragId = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    e.preventDefault();
    keys.add(e.code);
  } else if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (!e.repeat) {
      sound.unlock();
      game.tap();
      renderBar();
    }
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
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  if (keys.has('ArrowLeft')) game.move(-240 * dt);
  if (keys.has('ArrowRight')) game.move(240 * dt);
  game.update(dt);
  draw();
  if (game.best !== lastBest) {
    lastBest = game.best;
    renderBar();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __game: BrickGame }).__game = game;


