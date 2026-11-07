import './style.css';
import {
  type Input,
  COLS,
  CELL_H,
  CELL_W,
  GROUND_Y,
  H,
  INV_WIDTHS,
  STAGGER,
  InvadersGame,
  PLAYER_Y,
  ROWS,
  SHIELD_XS,
  SHIELD_Y,
  UFO_Y,
  W,
  kindOfRow,
} from './game/engine';
import { STARS, drawAlien, drawBonusShip, drawBurst, drawShip, drawSpark } from './art';
import { SHIELD_H, SHIELD_W, rockTone } from './game/sprites';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new InvadersGame();
const sound = new Sound();
game.onEvent = (e) => sound.play(e);

app.innerHTML = `
  <div class="table inv">
    <div class="hud">
      <div class="hud-cell"><span>SCORE</span><b id="score">0</b></div>
      <div class="hud-cell"><span>HI</span><b id="hi">0</b></div>
      <div class="hud-cell"><span>WAVE</span><b id="wave">1</b></div>
      <button class="icon-btn" id="mute" aria-label="Toggle sound"></button>
    </div>
    <div class="lives" id="lives"></div>
    <div class="screen" id="screen">
      <canvas id="game"></canvas>
      <div class="overlay" id="overlay"></div>
    </div>
    <div class="pad">
      <div class="pad-move">
        <button class="pad-btn" data-hold="left" aria-label="Move left">◀</button>
        <button class="pad-btn" data-hold="right" aria-label="Move right">▶</button>
      </div>
      <button class="pad-btn fire" data-hold="fire" aria-label="Fire">FIRE</button>
    </div>
  </div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const el = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!;

// ---- title-screen icons: the same vector aliens, rendered once to small images ----

function alienIcon(kind: number): string {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.scale(3, 3);
  drawAlien(g, kind, 0, 2, 2);
  return c.toDataURL();
}

// ---- sizing: an integer number of device pixels per game pixel keeps the pixel art crisp ----

let scale = 1;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const availCss = Math.min(document.documentElement.clientWidth - 16, 520);
  const availH = window.innerHeight - 220; // room for the HUD and the control pad
  const byW = Math.floor((availCss * dpr) / W);
  const byH = Math.floor((availH * dpr) / H);
  scale = Math.max(1, Math.min(byW, byH));
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.style.width = `${(W * scale) / dpr}px`;
  canvas.style.height = `${(H * scale) / dpr}px`;
  el('screen').style.width = canvas.style.width;
  el('screen').style.height = canvas.style.height;
}
window.addEventListener('resize', resize);
resize();

// ---- drawing ----

const BIG = (n: number) => String(n).padStart(4, '0');

function drawText(text: string, x: number, y: number, color: string, size = 8) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px ui-monospace, Menlo, monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function draw() {
  const g = game;
  const now = performance.now() / 1000;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, W, H);

  // Stars.
  for (const s of STARS) {
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now * 1.5 + s.p);
    ctx.fillStyle = '#9fb4ff';
    ctx.fillRect(s.x, s.y, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Ground: a dashed energy line.
  ctx.strokeStyle = '#4ad0ff';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 0.5);
  ctx.lineTo(W, GROUND_Y + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Boulders.
  const TONES = ['#8c7a68', '#a6937d', '#6b5b4c'];
  SHIELD_XS.forEach((sx, i) => {
    const sh = g.shields[i];
    for (let y = 0; y < SHIELD_H; y++) {
      for (let x = 0; x < SHIELD_W; x++) {
        if (!sh[y * SHIELD_W + x]) continue;
        ctx.fillStyle = TONES[rockTone(x, y, i + 1)];
        ctx.fillRect(sx + x, SHIELD_Y + y, 1, 1);
      }
    }
  });

  // Invaders.
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!g.alive[row * COLS + col]) continue;
      const kind = kindOfRow(row);
      const w = INV_WIDTHS[kind];
      drawAlien(ctx, kind, g.frame, g.ox + col * CELL_W + (row % 2) * STAGGER + (CELL_W - w) / 2, g.oy + row * CELL_H);
    }
  }

  // Bonus ship and its score pop-ups.
  if (g.ufo) drawBonusShip(ctx, g.ufo.x, UFO_Y, now);
  for (const p of g.popups) drawText(p.text, Math.round(p.x), Math.round(p.y - p.t * 4), '#ffe65a', 7);

  // Player ship (or its wreck, shown by the blast below).
  if (g.phase === 'title' || g.phase === 'play' || g.phase === 'clear' || (g.phase === 'over' && g.overReason === 'invaded')) {
    drawShip(ctx, g.playerX, PLAYER_Y, g.phase !== 'over');
  }

  // Shots.
  if (g.pBullet) {
    const b = g.pBullet;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(b.x - 1, b.y, 4, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b.x, b.y, 2, 6);
  }
  for (const b of g.eBullets) {
    ctx.fillStyle = 'rgba(255,230,90,0.3)';
    ctx.beginPath();
    ctx.arc(b.x + 1, b.y + 3, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe65a';
    ctx.beginPath();
    ctx.arc(b.x + 1, b.y + 3, 1.9 + 0.5 * Math.sin(b.y * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  // Blasts.
  for (const b of g.blasts) {
    if (b.kind === 'invader') drawBurst(ctx, b.x + 6, b.y + 4, b.t, 0.3, '#ffffff', 9);
    else if (b.kind === 'spark') drawSpark(ctx, b.x + 4, b.y + 1, b.t);
    else {
      drawBurst(ctx, b.x + 6, b.y + 4, b.t, 1.5, '#4ad0ff', 22);
      drawBurst(ctx, b.x + 6, b.y + 4, Math.max(0, b.t - 0.25), 1.2, '#ffb04a', 14);
    }
  }

  drawText('INVADERS', 8, 2, '#7fe8ff', 8);
}

// ---- HUD and overlay ----

let lastHud = '';
function updateHud() {
  const g = game;
  const key = `${g.score}|${g.hi}|${g.wave}|${g.lives}|${sound.muted}`;
  if (key === lastHud) return;
  lastHud = key;
  el('score').textContent = BIG(g.score);
  el('hi').textContent = BIG(g.hi);
  el('wave').textContent = String(g.wave);
  el('lives').textContent = g.lives > 0 ? '▲ '.repeat(g.lives).trim() : '';
  el('mute').textContent = sound.muted ? '🔇 Sound off' : '🔊 Sound on';
}

let lastOverlay = '';
function updateOverlay() {
  const g = game;
  let html = '';
  if (g.phase === 'title') {
    html = `<div class="ov-box"><h1>INVADERS</h1>
      <p>Hold ◀ ▶ to move, hold FIRE to shoot.<br>Clear every wave. Hide behind the boulders.</p>
      <div class="pts"><span>${spriteImg(0)} = 30</span><span>${spriteImg(1)} = 20</span><span>${spriteImg(2)} = 10</span><span class="u">BONUS = ?</span></div>
      <button class="btn-accent big" data-start>Tap to start</button></div>`;
  } else if (g.phase === 'over') {
    html = `<div class="ov-box"><h1>GAME OVER</h1>
      <p>${g.overReason === 'invaded' ? 'The invaders reached the ground.' : 'Out of cannons.'}</p>
      <p class="final">Score <b>${g.score}</b>${g.newBest ? '<br><span class="best">New best!</span>' : ''}</p>
      <button class="btn-accent big" data-start>Play again</button></div>`;
  } else if (g.phase === 'clear') {
    html = `<div class="ov-banner">WAVE ${g.wave} CLEARED</div>`;
  }
  if (html === lastOverlay) return;
  lastOverlay = html;
  overlay.innerHTML = html;
  overlay.style.display = html ? 'flex' : 'none';
}

function spriteImg(kind: number): string {
  return `<img class="pt-spr" src="${alienIcon(kind)}" alt="" style="filter:none">`;
}

// ---- input: touch pad (multi-touch), keyboard ----

const held = new Set<string>();
const keys = new Set<string>();
const pointerHold = new Map<number, string>();

function startGame() {
  sound.unlock();
  game.start();
}

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-hold]')) {
  const name = btn.dataset.hold!;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sound.unlock();
    btn.setPointerCapture(e.pointerId);
    pointerHold.set(e.pointerId, name);
    held.add(name);
    btn.classList.add('down');
  });
  const release = (e: PointerEvent) => {
    if (pointerHold.get(e.pointerId) !== name) return;
    pointerHold.delete(e.pointerId);
    if (![...pointerHold.values()].includes(name)) held.delete(name);
    btn.classList.remove('down');
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
}

overlay.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-start]')) startGame();
});
el('mute').addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

const KEYMAP: Record<string, string> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'fire', z: 'fire', ArrowUp: 'fire' };
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (game.phase === 'title' || game.phase === 'over')) return startGame();
  const k = KEYMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (!k) return;
  e.preventDefault();
  sound.unlock();
  if ((game.phase === 'title' || game.phase === 'over') && k === 'fire') return startGame();
  keys.add(k);
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (k) keys.delete(k);
});
window.addEventListener('blur', () => {
  keys.clear();
  held.clear();
  pointerHold.clear();
});

function currentInput(): Input {
  const on = (n: string) => held.has(n) || keys.has(n);
  return { left: on('left'), right: on('right'), fire: on('fire') };
}

// ---- main loop ----

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt, currentInput());
  draw();
  updateHud();
  updateOverlay();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
