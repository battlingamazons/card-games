import './style.css';
import { COLS, CopGame, H, MAG, ROW_Y, SCENE_BOTTOM, STAGES, W, isEnemy } from './game/engine';
import type { Kind, Target } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new CopGame();
const sound = new Sound();
game.onEvent = (e) => {
  sound.play(e);
  if (e === 'start' || e === 'clear') musicFor();
  if (e === 'over') sound.music(-1);
};

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

function musicFor() {
  sound.music(game.stage % 3);
}

// ---- themes ----

interface Theme {
  sky: [string, string];
  wall: string;
  wallDark: string;
  ground: string;
  accent: string;
  top: 'window' | 'container' | 'door';
  row1: 'dumpster' | 'crate' | 'speaker';
  row2: 'car' | 'barrel' | 'couch';
}
const THEMES: Theme[] = [
  { sky: ['#1a1245', '#6a2a6a'], wall: '#5a3a4a', wallDark: '#3a2434', ground: '#3a3a4a', accent: '#ff5ab0', top: 'window', row1: 'dumpster', row2: 'car' },
  { sky: ['#12345a', '#d9805a'], wall: '#46606a', wallDark: '#2c424c', ground: '#5a5a54', accent: '#ffc531', top: 'container', row1: 'crate', row2: 'barrel' },
  { sky: ['#2a0a4a', '#c0308a'], wall: '#4a2a6a', wallDark: '#2a1444', ground: '#2a1a3a', accent: '#5ae0ff', top: 'door', row1: 'speaker', row2: 'couch' },
];

// ---- helpers ----

function text(s: string, x: number, y: number, size: number, fill: string, stroke = '#0a0618', align: CanvasTextAlign = 'center') {
  ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 5);
  ctx.strokeStyle = stroke;
  if (stroke !== 'transparent') ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}
function rr(x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// ---- scene ----

function scene() {
  const th = THEMES[game.stage % 3];
  const g = ctx.createLinearGradient(0, 0, 0, 120);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // skyline
  ctx.fillStyle = 'rgba(10,5,30,0.55)';
  for (let i = 0; i < 9; i++) {
    const bw = 22;
    const bh = 24 + ((i * 37) % 30);
    ctx.fillRect(i * 21 - 4, 56 - bh * 0.3, bw, bh);
  }
  // building facade
  ctx.fillStyle = th.wall;
  ctx.fillRect(0, 44, W, 136);
  ctx.fillStyle = th.wallDark;
  for (let y = 52; y < 176; y += 12) ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = th.accent;
  ctx.globalAlpha = 0.5 + Math.sin(game.t * 5) * 0.2;
  ctx.fillRect(0, 44, W, 2);
  ctx.globalAlpha = 1;
  // street
  ctx.fillStyle = th.ground;
  ctx.fillRect(0, 180, W, SCENE_BOTTOM - 180);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = 6; x < W; x += 30) ctx.fillRect(x, 208, 16, 2);
  ctx.fillStyle = th.wallDark;
  ctx.fillRect(0, 178, W, 4);
  // stage neon sign
  const label = th.top === 'window' ? 'DONUTS' : th.top === 'container' ? 'PORT' : 'DISCO';
  ctx.globalAlpha = 0.6 + Math.sin(game.t * 7) * 0.3;
  text(label, W / 2, 56, 9, th.accent, 'transparent');
  ctx.globalAlpha = 1;
}

function topFrame(cx: number, th: Theme) {
  const y = ROW_Y[0];
  if (th.top === 'window') {
    ctx.fillStyle = '#12082a';
    ctx.fillRect(cx - 20, 54, 40, 46);
  } else if (th.top === 'container') {
    ctx.fillStyle = '#10161c';
    ctx.fillRect(cx - 20, 54, 40, 46);
  } else {
    ctx.fillStyle = '#1a0a30';
    ctx.fillRect(cx - 20, 54, 40, 46);
  }
  void y;
}
function topFront(cx: number, th: Theme) {
  const y = ROW_Y[0];
  ctx.strokeStyle = th.top === 'container' ? '#c8604a' : th.accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 21.5, 52.5, 43, 49);
  ctx.fillStyle = th.top === 'container' ? '#8a4034' : '#2a1a44';
  ctx.fillRect(cx - 24, y, 48, 5);
  if (th.top === 'container') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = cx - 18; x < cx + 20; x += 6) ctx.fillRect(x, 44, 2, 8);
  }
}

function cover(kind: Theme['row1'] | Theme['row2'], cx: number, y: number) {
  const w = 52;
  const x = cx - w / 2;
  switch (kind) {
    case 'dumpster':
      rr(x, y, w, 24, 3, '#2f7a4a');
      rr(x - 2, y - 4, w + 4, 6, 2, '#256038');
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 4, y + 8, w - 8, 2);
      ctx.fillStyle = '#12301e';
      ctx.fillRect(x + 6, y + 20, 6, 4);
      ctx.fillRect(x + w - 12, y + 20, 6, 4);
      break;
    case 'car':
      rr(x - 2, y + 4, w + 4, 22, 5, '#c0304a');
      rr(x + 8, y - 6, w - 16, 14, 5, '#a02640');
      ctx.fillStyle = '#9ad0f0';
      ctx.fillRect(x + 12, y - 3, 12, 8);
      ctx.fillRect(x + w - 24, y - 3, 12, 8);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x + 10, y + 26, 5, 0, Math.PI * 2);
      ctx.arc(x + w - 10, y + 26, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(x - 2, y + 10, 4, 4);
      break;
    case 'crate':
      rr(x, y, w, 24, 2, '#b8803a');
      ctx.strokeStyle = '#7a5020';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, 22);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + 24);
      ctx.moveTo(x + w, y);
      ctx.lineTo(x, y + 24);
      ctx.stroke();
      break;
    case 'barrel':
      for (const bx of [x + 10, x + w / 2, x + w - 10]) {
        rr(bx - 9, y - 2, 18, 28, 6, '#a84a2a');
        ctx.fillStyle = '#6a2a14';
        ctx.fillRect(bx - 9, y + 5, 18, 2);
        ctx.fillRect(bx - 9, y + 16, 18, 2);
      }
      break;
    case 'speaker':
      rr(x + 4, y - 2, w - 8, 26, 3, '#1a1a22');
      for (const sx of [x + 17, x + w - 17]) {
        ctx.fillStyle = '#3a3a4a';
        ctx.beginPath();
        ctx.arc(sx, y + 11, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5ae0ff';
        ctx.beginPath();
        ctx.arc(sx, y + 11, 3 + Math.sin(game.t * 12 + sx) * 1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'couch':
      rr(x - 2, y + 2, w + 4, 24, 6, '#c0308a');
      rr(x + 2, y - 4, w - 4, 12, 5, '#a02070');
      rr(x - 4, y + 6, 8, 18, 4, '#a02070');
      rr(x + w - 4, y + 6, 8, 18, 4, '#a02070');
      break;
  }
}

// ---- characters ----

function person(kind: Kind, t: Target, flashWarn: boolean) {
  const bounce = Math.sin(t.age * 9) * 0.8;
  ctx.translate(0, bounce * (t.state === 'hold' ? 1 : 0));
  const hit = t.flash > 0;
  const c = (col: string) => (hit ? '#ffffff' : col);
  const skin = c('#f2c9a0');
  const gun = () => {
    ctx.fillStyle = '#111';
    ctx.fillRect(5, -23, 10, 4);
    ctx.fillRect(5, -21, 4, 6);
    if (flashWarn) {
      ctx.fillStyle = `rgba(255,${180 + Math.sin(t.age * 50) * 60 | 0},60,0.95)`;
      ctx.beginPath();
      ctx.arc(16, -21, 5 + Math.sin(t.age * 50) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = skin;
    ctx.fillRect(2, -22, 5, 5);
  };
  switch (kind) {
    case 'thug':
      ctx.fillStyle = c('#f4f4f4');
      ctx.fillRect(-9, -22, 18, 24);
      ctx.fillStyle = hit ? '#fff' : '#1a1a22';
      for (let y = -22; y < 2; y += 6) ctx.fillRect(-9, y, 18, 3);
      ctx.beginPath();
      ctx.arc(0, -28, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hit ? '#fff' : '#f4f4f4';
      ctx.fillRect(-5, -30, 4, 2.5);
      ctx.fillRect(1, -30, 4, 2.5);
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(-4, -29.8, 2, 2);
      ctx.fillRect(2, -29.8, 2, 2);
      gun();
      break;
    case 'sharp':
      ctx.fillStyle = c('#c8a060');
      ctx.fillRect(-10, -22, 20, 24);
      ctx.fillStyle = c('#a07840');
      ctx.beginPath();
      ctx.moveTo(-3, -22);
      ctx.lineTo(0, -12);
      ctx.lineTo(3, -22);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, -28, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c('#2a2020');
      ctx.fillRect(-10, -33, 20, 3);
      ctx.fillRect(-6, -39, 12, 7);
      ctx.fillStyle = '#000';
      ctx.fillRect(-6, -29, 12, 3);
      gun();
      break;
    case 'boss':
      ctx.fillStyle = c('#f4f0e8');
      ctx.fillRect(-11, -22, 22, 24);
      ctx.fillStyle = c('#e07a9a');
      ctx.fillRect(-3, -22, 6, 14);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, -28, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c('#2a1a1a');
      ctx.beginPath();
      ctx.ellipse(0, -34, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-5, -41, 10, 7);
      ctx.fillRect(-4, -24.5, 8, 2);
      ctx.fillStyle = '#6a3a1a';
      ctx.fillRect(1, -25, 9, 2.4);
      ctx.fillStyle = '#ff7a2a';
      ctx.fillRect(9, -25, 2, 2.4);
      ctx.fillStyle = '#000';
      ctx.fillRect(-6, -30, 12, 2.5);
      ctx.fillStyle = '#ffd34a';
      ctx.fillRect(-6, -17, 12, 1.5);
      gun();
      break;
    case 'tourist':
      ctx.fillStyle = c('#20b0a0');
      ctx.fillRect(-9, -22, 18, 24);
      ctx.fillStyle = hit ? '#fff' : '#ffe08a';
      for (const [x, y] of [[-5, -17], [3, -12], [-2, -6], [5, -19]]) ctx.fillRect(x, y, 3, 3);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, -28, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c('#e8d080');
      ctx.beginPath();
      ctx.ellipse(0, -32, 11, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-5, -37, 10, 6);
      ctx.fillStyle = '#222';
      ctx.fillRect(-12, -24, 8, 6);
      ctx.fillStyle = '#9ad0f0';
      ctx.fillRect(-10, -22, 3, 3);
      ctx.fillStyle = '#2a1a1a';
      ctx.fillRect(-2, -28, 1.5, 1.5);
      ctx.fillRect(2, -28, 1.5, 1.5);
      hands(skin);
      break;
    case 'mayor':
      ctx.fillStyle = c('#2a2a4a');
      ctx.fillRect(-9, -22, 18, 24);
      ctx.fillStyle = c('#d03a4a');
      ctx.beginPath();
      ctx.moveTo(-9, -22);
      ctx.lineTo(9, -6);
      ctx.lineTo(9, -10);
      ctx.lineTo(-5, -22);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, -28, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c('#ddd');
      ctx.fillRect(-7, -33, 14, 4);
      ctx.fillStyle = '#2a1a1a';
      ctx.fillRect(-2, -28, 1.5, 1.5);
      ctx.fillRect(2, -28, 1.5, 1.5);
      ctx.fillRect(-3, -24, 6, 1.5);
      hands(skin);
      break;
    case 'granny':
      ctx.fillStyle = c('#b86ad0');
      ctx.fillRect(-9, -22, 18, 24);
      ctx.fillStyle = hit ? '#fff' : '#ffe0f0';
      for (const [x, y] of [[-5, -16], [3, -10], [-2, -4]]) ctx.fillRect(x, y, 3, 3);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, -28, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c('#e8e8f0');
      ctx.beginPath();
      ctx.arc(0, -33, 7, Math.PI, 0);
      ctx.arc(0, -40, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a1a1a';
      ctx.lineWidth = 1;
      ctx.strokeRect(-5, -30, 4, 3);
      ctx.strokeRect(1, -30, 4, 3);
      ctx.fillStyle = '#d03a4a';
      ctx.fillRect(10, -14, 7, 6);
      hands(skin);
      break;
    case 'donut': {
      const f = Math.sin(t.age * 6) * 2;
      ctx.translate(0, -14 + f);
      ctx.fillStyle = '#e0a060';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hit ? '#fff' : '#ff7aa8';
      ctx.beginPath();
      ctx.arc(0, -1, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6a3a1a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      for (const [x, y, c2] of [[-7, -4, '#fff'], [6, -6, '#ffe08a'], [7, 3, '#7fe0c4'], [-6, 6, '#fff'], [0, -9, '#9ad0f0']] as const) {
        ctx.fillStyle = c2;
        ctx.fillRect(x, y, 3, 1.5);
      }
      ctx.translate(0, 14 - f);
      break;
    }
  }
  if (flashWarn && isEnemy(kind)) text('!', 0, -46, 12, '#ff4a3a');
}
function hands(skin: string) {
  ctx.fillStyle = skin;
  const w = Math.sin(game.t * 14) * 2;
  ctx.fillRect(-14, -30 + w, 4, 8);
  ctx.fillRect(10, -30 - w, 4, 8);
}

function drawTarget(t: Target, th: Theme) {
  const r = game.rect(t);
  const row = Math.floor(t.slot / 3);
  ctx.save();
  // clip to the visible window / above the cover
  ctx.beginPath();
  if (row === 0) ctx.rect(r.cx - 20, 54, 40, 46);
  else ctx.rect(r.cx - 34, ROW_Y[row] - 70, 68, 70);
  ctx.clip();
  ctx.translate(r.cx, r.feet);
  ctx.scale(r.s, r.s);
  if (t.state === 'dead') {
    ctx.rotate(Math.min(1, t.dieT * 3) * 0.9 * (t.slot % 2 ? 1 : -1));
    ctx.globalAlpha = Math.max(0, 1 - t.dieT * 2);
  }
  person(t.kind, t, t.state === 'hold' && t.warned && isEnemy(t.kind));
  ctx.restore();
  if (t.maxHp > 1 && t.state !== 'dead') {
    for (let i = 0; i < t.maxHp; i++) {
      ctx.fillStyle = i < t.hp ? '#ff5a5a' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(r.cx - (t.maxHp * 5) / 2 + i * 5, r.top - 7, 4, 3);
    }
  }
  void th;
}

function gun() {
  // revolver at the bottom centre, aimed at the last shot
  const px = W / 2;
  const py = 308;
  const a = Math.atan2(game.aim.y - py, game.aim.x - px) + Math.PI / 2;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.max(-1.1, Math.min(1.1, a)));
  ctx.translate(0, game.recoil * 6);
  ctx.fillStyle = '#9a9aa8';
  ctx.fillRect(-4, -34, 8, 30);
  ctx.fillStyle = '#6a6a78';
  ctx.fillRect(-5, -16, 10, 10);
  ctx.fillStyle = '#4a2a1a';
  ctx.beginPath();
  ctx.roundRect(-5, -6, 10, 18, 3);
  ctx.fill();
  if (game.recoil > 0.5) {
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(0, -38, 5 * game.recoil, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function hud() {
  const g = game;
  // top bar
  ctx.fillStyle = 'rgba(10,5,30,0.7)';
  ctx.fillRect(0, 0, W, 40);
  text(String(g.score), 8, 14, 17, '#fff', '#0a0618', 'left');
  text(g.stageName, 8, 30, 8, '#ffc531', 'transparent', 'left');
  if (g.mult > 1) text(`x${g.mult}`, W / 2 + 14, 14, 13, '#7fe0c4');
  for (let i = 0; i < g.lives; i++) {
    ctx.fillStyle = '#e0c040';
    ctx.strokeStyle = '#6a5a10';
    ctx.lineWidth = 1;
    badge(W - 12 - i * 15, 14, 6);
  }
  // bottom bar
  ctx.fillStyle = 'rgba(10,5,30,0.85)';
  ctx.fillRect(0, SCENE_BOTTOM, W, H - SCENE_BOTTOM);
  for (let i = 0; i < MAG; i++) {
    const have = i < g.ammo && g.reloadT <= 0;
    ctx.fillStyle = have ? '#ffd34a' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(10 + i * 9, 282, 6, 14);
    ctx.fillStyle = have ? '#c87a2a' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(10 + i * 9, 292, 6, 6);
  }
  if (g.reloadT > 0) text('RELOADING', 38, 272, 8, '#fff', 'transparent');
  // reload button
  const lowAmmo = g.ammo <= 1 && g.reloadT <= 0;
  rr(RELOAD.x, RELOAD.y, RELOAD.w, RELOAD.h, 10, lowAmmo ? (Math.sin(g.t * 12) > 0 ? '#ff5a5a' : '#c03a3a') : '#4a3a8a');
  text('RELOAD', RELOAD.x + RELOAD.w / 2, RELOAD.y + RELOAD.h / 2, 10, '#fff', 'transparent');
  gun();
}
function badge(cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 ? r * 0.55 : r;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

const RELOAD = { x: 112, y: 270, w: 62, h: 40 };

function draw() {
  const g = game;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.save();
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * g.shake, (Math.random() - 0.5) * 8 * g.shake);
  scene();
  const th = THEMES[g.stage % 3];
  if (g.phase === 'title') {
    // empty set with a decorative parade of slot frames
  }
  for (const c of COLS) topFrame(c, th);
  const byRow = [0, 1, 2].map((r) => g.targets.filter((t) => Math.floor(t.slot / 3) === r));
  for (let row = 0; row < 3; row++) {
    for (const t of byRow[row]) drawTarget(t, th);
    for (const c of COLS) {
      if (row === 0) topFront(c, th);
      else cover(row === 1 ? th.row1 : th.row2, c, ROW_Y[row]);
    }
  }
  // bullet holes
  for (const s of g.shots) {
    ctx.fillStyle = `rgba(255,230,150,${Math.max(0, 1 - s.t * 6)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6 * Math.max(0, 1 - s.t * 6), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - s.t * 1.5)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x - 5, s.y);
    ctx.lineTo(s.x + 5, s.y);
    ctx.moveTo(s.x, s.y - 5);
    ctx.lineTo(s.x, s.y + 5);
    ctx.stroke();
  }
  for (const p of g.pops) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    text(p.text, p.x, p.y, p.size, p.color);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (g.hurtT > 0) {
    const gr = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 200);
    gr.addColorStop(0, 'rgba(255,0,0,0)');
    gr.addColorStop(1, `rgba(255,20,20,${g.hurtT * 1.3})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  if (g.phase === 'play' || g.phase === 'clear' || g.phase === 'over' || g.phase === 'card') hud();
  if (g.bannerT > 0 && g.phase === 'play') {
    ctx.globalAlpha = Math.min(1, g.bannerT * 2);
    text(g.banner, W / 2, 62 + (1 - Math.min(1, g.bannerT * 4)) * -6, g.banner.length > 16 ? 10 : 13, '#ffe08a');
    ctx.globalAlpha = 1;
  }

  if (g.phase === 'title') {
    ctx.fillStyle = 'rgba(10,5,30,0.78)';
    ctx.fillRect(0, 0, W, H);
    text('BADGE', W / 2, 64, 34, '#ffc531');
    text('BUSTERS', W / 2, 98, 32, '#ff5ab0');
    text('He was a loose cannon.', W / 2, 140, 9, '#fff', 'transparent');
    text('She was a by-the-book rookie.', W / 2, 153, 9, '#fff', 'transparent');
    text('You are a finger.', W / 2, 166, 9, '#7fe0c4', 'transparent');
    text('Tap the crooks. Spare the civilians.', W / 2, 196, 9, '#fff', 'transparent');
    text('Grab the donuts. Reload often.', W / 2, 209, 9, '#fff', 'transparent');
    if (Math.sin(g.t * 5) > -0.3) text('TAP TO START', W / 2, 250, 14, '#fff');
    if (g.best > 0) text(`best ${g.best}`, W / 2, 278, 11, '#ffd0a0');
  } else if (g.phase === 'card') {
    ctx.fillStyle = 'rgba(10,5,30,0.82)';
    ctx.fillRect(0, 40, W, SCENE_BOTTOM - 40);
    text(`STAGE ${g.stage + 1}`, W / 2, 100, 14, '#ffc531');
    text(g.stageName, W / 2, 128, g.stageName.length > 10 ? 18 : 24, '#fff');
    wrap(g.def.blurb, W / 2, 168, W - 40, 12, '#cfc0ff');
    if (g.cardT > 0.5) text('tap to begin', W / 2, 228, 11, '#fff');
  } else if (g.phase === 'clear') {
    ctx.fillStyle = 'rgba(10,5,30,0.82)';
    ctx.fillRect(0, 40, W, SCENE_BOTTOM - 40);
    text('CASE CLOSED!', W / 2, 96, 22, '#7fe0c4');
    text(`${g.def.boss} is in cuffs`, W / 2, 124, 10, '#fff', 'transparent');
    text(`Bonus +${g.clearBonus}`, W / 2, 158, 14, '#ffe08a');
    text(`(${g.lives} badges left)`, W / 2, 176, 9, '#cfc0ff', 'transparent');
    if (g.cardT > 1.2) text('tap for the next case', W / 2, 220, 11, '#fff');
  } else if (g.phase === 'over') {
    const k = Math.min(1, g.deadFor / 0.4);
    ctx.fillStyle = `rgba(10,5,30,${0.8 * k})`;
    ctx.fillRect(0, 40, W, SCENE_BOTTOM - 40);
    ctx.save();
    ctx.globalAlpha = k;
    text('YOU ARE', W / 2, 84, 18, '#ff9a8a');
    text('SUSPENDED', W / 2, 108, 26, '#ff5a5a');
    ctx.fillStyle = 'rgba(30,20,70,0.9)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 58, 128, 116, 70, 10);
    ctx.fill();
    text('SCORE', W / 2 - 30, 142, 9, '#bfe3f5', 'transparent');
    text('BEST', W / 2 + 30, 142, 9, '#bfe3f5', 'transparent');
    text(String(g.score), W / 2 - 30, 162, 18, '#fff');
    text(String(g.best), W / 2 + 30, 162, 18, '#ffe08a');
    text(`${g.kills} crooks busted · stage ${g.stage + 1}`, W / 2, 184, 8, '#fff', 'transparent');
    if (g.newBest) text('NEW BEST!', W / 2, 193, 8, '#7fe0c4', 'transparent');
    if (g.deadFor > 0.8) text('tap to go again', W / 2, 228, 12, '#fff');
    ctx.restore();
  }
}

function wrap(s: string, x: number, y: number, maxW: number, lh: number, color: string) {
  ctx.font = '700 10px system-ui, sans-serif';
  const lines: string[] = [];
  let line = '';
  for (const w of s.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  const y0 = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => text(l, x, y0 + i * lh, 10, color, 'transparent'));
}

// ---- input ----

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * W;
  const y = ((e.clientY - r.top) / r.height) * H;
  if (game.phase !== 'play') {
    game.tap();
    musicFor();
    renderBar();
    return;
  }
  if (y > SCENE_BOTTOM) {
    if (x >= RELOAD.x && x <= RELOAD.x + RELOAD.w && y >= RELOAD.y && y <= RELOAD.y + RELOAD.h) game.reload();
    return;
  }
  game.shoot(x, y);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') game.reload();
  if (e.code === 'Space' || e.code === 'Enter') game.tap();
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

(window as unknown as { __game: CopGame }).__game = game;
void STAGES;
