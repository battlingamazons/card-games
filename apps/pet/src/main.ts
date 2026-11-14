import './style.css';
import { PetGame, H, W } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new PetGame();
const sound = new Sound();
game.onEvent = (e) => sound.play(e);

app.innerHTML = `
  <div class="table fl">
    <div class="bar">
      <span id="age"></span>
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

// ---- layout ----

const FLOOR = 212;
const FEET = 238;
interface Btn {
  id: 'feed' | 'play' | 'sleep';
  x: number;
  y: number;
  w: number;
  h: number;
}
const BTNS: Btn[] = [
  { id: 'feed', x: 12, y: 268, w: 48, h: 44 },
  { id: 'play', x: 66, y: 268, w: 48, h: 44 },
  { id: 'sleep', x: 120, y: 268, w: 48, h: 44 },
];
const NAME_RECT = { x: 40, y: 52, w: 100, h: 18 };

// ---- helpers ----

function text(s: string, x: number, y: number, size: number, fill: string, stroke = 'transparent', align: CanvasTextAlign = 'center') {
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
function emoji(s: string, x: number, y: number, size: number) {
  ctx.font = `${size}px system-ui, -apple-system, "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

function sky() {
  const hr = new Date().getHours() + new Date().getMinutes() / 60;
  const day = hr >= 7 && hr < 18;
  const dusk = (hr >= 18 && hr < 20) || (hr >= 5.5 && hr < 7);
  return { c1: day ? '#7fc8f0' : dusk ? '#e8826a' : '#14183a', c2: day ? '#cfeefb' : dusk ? '#ffcf8a' : '#2a2a5a', night: !day && !dusk, hr, day };
}

function room() {
  // wall
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, '#f3dcc6');
  g.addColorStop(1, '#ead0b4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(160,110,90,0.12)';
  for (let x = 6; x < W; x += 18) ctx.fillRect(x, 0, 2, FLOOR);
  // window
  const s = sky();
  const wx = 104;
  const wy = 82;
  ctx.fillStyle = '#fff6ea';
  ctx.fillRect(wx - 4, wy - 4, 64, 58);
  const sg = ctx.createLinearGradient(0, wy, 0, wy + 50);
  sg.addColorStop(0, s.c1);
  sg.addColorStop(1, s.c2);
  ctx.fillStyle = sg;
  ctx.fillRect(wx, wy, 56, 50);
  if (s.night) {
    ctx.fillStyle = '#fff';
    for (const [x, y] of [[8, 8], [30, 14], [46, 6], [18, 30], [42, 36]]) ctx.fillRect(wx + x, wy + y, 1.5, 1.5);
    ctx.fillStyle = '#f4f4ff';
    ctx.beginPath();
    ctx.arc(wx + 38, wy + 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14183a';
    ctx.beginPath();
    ctx.arc(wx + 41, wy + 14, 5.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = s.day ? '#fff2a8' : '#ffe0b0';
    ctx.beginPath();
    ctx.arc(wx + 14, wy + (s.day ? 14 : 34), 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff6ea';
  ctx.fillRect(wx + 26, wy, 4, 50);
  ctx.fillRect(wx, wy + 22, 56, 4);
  // curtains
  ctx.fillStyle = '#d96a8a';
  ctx.beginPath();
  ctx.moveTo(wx - 6, wy - 8);
  ctx.lineTo(wx + 12, wy - 8);
  ctx.quadraticCurveTo(wx + 6, wy + 25, wx + 12, wy + 56);
  ctx.lineTo(wx - 6, wy + 56);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(wx + 62, wy - 8);
  ctx.lineTo(wx + 44, wy - 8);
  ctx.quadraticCurveTo(wx + 50, wy + 25, wx + 44, wy + 56);
  ctx.lineTo(wx + 62, wy + 56);
  ctx.fill();
  // picture frame and plant
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(18, 88, 40, 34);
  ctx.fillStyle = '#bfe3f5';
  ctx.fillRect(21, 91, 34, 28);
  ctx.fillStyle = '#7ac24a';
  ctx.beginPath();
  ctx.moveTo(21, 119);
  ctx.lineTo(34, 104);
  ctx.lineTo(44, 114);
  ctx.lineTo(50, 108);
  ctx.lineTo(55, 119);
  ctx.fill();
  // floor
  ctx.fillStyle = '#c8894a';
  ctx.fillRect(0, FLOOR, W, H - FLOOR);
  ctx.fillStyle = 'rgba(90,50,20,0.18)';
  for (let y = FLOOR + 10; y < H; y += 14) ctx.fillRect(0, y, W, 1.5);
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(0, FLOOR - 4, W, 5);
  // rug
  ctx.fillStyle = 'rgba(217,106,138,0.55)';
  ctx.beginPath();
  ctx.ellipse(W / 2, FEET + 2, 62, 11, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stat(i: number, icon: string, v: number) {
  const x = 8 + i * 58;
  emoji(icon, x + 7, 22, 12);
  ctx.fillStyle = 'rgba(30,20,50,0.7)';
  ctx.beginPath();
  ctx.roundRect(x + 17, 17, 34, 9, 4.5);
  ctx.fill();
  const low = v < 25;
  const pulse = low ? 0.6 + Math.sin(game.t * 8) * 0.4 : 1;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = v < 25 ? '#ff6a5a' : v < 50 ? '#ffc531' : '#5ae08a';
  if (v > 1) {
    ctx.beginPath();
    ctx.roundRect(x + 18, 18, Math.max(3, (v / 100) * 32), 7, 3.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- pet ----

function blinking() {
  return game.t % 4.3 < 0.13;
}

function petBody(cx: number, feet: number, r: number, hue: number, squash: number) {
  const rx = r * (1 + squash * 0.1);
  const ry = r * 0.92 * (1 - squash * 0.1);
  const cy = feet - ry + 2;
  // shadow
  ctx.fillStyle = 'rgba(60,30,10,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, FEET + 3, rx * 0.85, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.fillStyle = hsl(hue, 60, 62);
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.7, cy - ry * 0.55);
  ctx.lineTo(cx - rx * 0.55, cy - ry * 1.25);
  ctx.lineTo(cx - rx * 0.15, cy - ry * 0.85);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + rx * 0.7, cy - ry * 0.55);
  ctx.lineTo(cx + rx * 0.55, cy - ry * 1.25);
  ctx.lineTo(cx + rx * 0.15, cy - ry * 0.85);
  ctx.fill();
  // feet
  ctx.fillStyle = hsl(hue, 55, 58);
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.45, feet, rx * 0.26, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.45, feet, rx * 0.26, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 2, cx, cy, rx * 1.1);
  g.addColorStop(0, hsl(hue, 70, 82));
  g.addColorStop(1, hsl(hue, 62, 66));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // belly
  ctx.fillStyle = hsl(hue, 80, 92);
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.35, rx * 0.55, ry * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  return { cx, cy, rx, ry };
}

function face(b: { cx: number; cy: number; rx: number; ry: number }, mood: string, mouthOpen: number) {
  const { cx, cy, rx, ry } = b;
  const ex = rx * 0.38;
  const ey = cy - ry * 0.12;
  ctx.strokeStyle = '#2a1a3a';
  ctx.fillStyle = '#2a1a3a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const closed = mood === 'sleeping' || blinking();
  if (closed) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * ex, ey, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else if (mood === 'happy') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * ex, ey + 3, 4, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    }
  } else if (mood === 'tired') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillStyle = '#2a1a3a';
    }
    // droopy lids
    for (const s of [-1, 1]) {
      ctx.fillStyle = 'rgba(190,150,200,0.95)';
      ctx.fillRect(cx + s * ex - 5, ey - 5, 10, 5);
      ctx.fillStyle = '#2a1a3a';
    }
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx + s * ex - 1.2, ey - 1.4, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1a3a';
    }
    if (mood === 'sad' || mood === 'hungry') {
      ctx.beginPath();
      ctx.moveTo(cx - ex - 5, ey - 7);
      ctx.lineTo(cx - ex + 4, ey - 10);
      ctx.moveTo(cx + ex + 5, ey - 7);
      ctx.lineTo(cx + ex - 4, ey - 10);
      ctx.stroke();
    }
  }
  // blush
  if (mood === 'happy' || mouthOpen > 0.3) {
    ctx.fillStyle = 'rgba(255,110,140,0.45)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * (ex + 6), ey + 8, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // mouth
  const my = cy + ry * 0.2;
  ctx.strokeStyle = '#2a1a3a';
  ctx.fillStyle = '#7a2a4a';
  if (mouthOpen > 0.05) {
    ctx.beginPath();
    ctx.ellipse(cx, my + 2, 4.5, 1.5 + mouthOpen * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'happy') {
    ctx.beginPath();
    ctx.arc(cx, my - 2, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else if (mood === 'sad') {
    ctx.beginPath();
    ctx.arc(cx, my + 6, 4.5, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    // tear
    ctx.fillStyle = '#7fc8f0';
    const ty = (game.t * 14) % 14;
    ctx.beginPath();
    ctx.ellipse(cx + ex + 1, ey + 5 + ty, 1.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'hungry') {
    ctx.beginPath();
    ctx.ellipse(cx, my + 3, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'sleeping') {
    ctx.beginPath();
    ctx.ellipse(cx, my + 2, 2, 1.4 + Math.sin(game.t * 2) * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, my - 1, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

function food(x: number, y: number, kind: number) {
  if (kind === 0) {
    ctx.fillStyle = '#e0453b';
    ctx.beginPath();
    ctx.arc(x - 2.5, y, 6, 0, Math.PI * 2);
    ctx.arc(x + 2.5, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4f9a38';
    ctx.fillRect(x - 1, y - 9, 2, 4);
  } else {
    ctx.fillStyle = '#d9a05a';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a3a1a';
    for (const [dx, dy] of [[-2, -2], [2, 1], [-1, 3], [3, -3]]) ctx.fillRect(x + dx, y + dy, 1.6, 1.6);
  }
}

let foodKind = 0;


function drawPet() {
  const g = game;
  const age = Math.min(g.ageDays, 10);
  const r = 26 + age * 0.9;
  const mood = g.mood;
  const bob = mood === 'sleeping' ? Math.sin(g.t * 1.6) * 0.5 : Math.sin(g.t * 3) * 1.2;
  const squash = Math.sin(g.t * 3) * 0.5 + g.wobble * Math.sin(g.t * 30) * 1.2;
  const feet = FEET - g.jump + bob * 0.3;
  const b = petBody(g.petX, feet, r, g.hue, squash);
  let mouth = 0;
  let m: string = mood;
  if (g.action === 'eat') {
    mouth = Math.abs(Math.sin(g.actT * 9)) * 0.9;
    m = 'happy';
    const k = Math.min(1, g.actT / 0.9);
    if (g.actT < 1.0) food(g.petX + (1 - k) * 44, b.cy + b.ry * 0.25 - (1 - k) * 18, foodKind);
  }
  if (g.action === 'play') m = 'happy';
  face(b, m, mouth);
  if (g.action === 'play') {
    const cycle = 0.6;
    const ph = (g.actT % cycle) / cycle;
    const bx = g.petX + 36 + Math.sin(g.actT * 2) * 8;
    const by = FEET - 6 - Math.abs(Math.sin(ph * Math.PI)) * 40;
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 7, by - 1, 14, 2);
  }
  if (mood === 'hungry' && !g.asleep) {
    ctx.strokeStyle = 'rgba(90,50,20,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(g.petX + b.rx + 4 + i * 4, b.cy, 3 + i * 2, -0.9, 0.9);
      ctx.stroke();
    }
  }
  if (mood === 'sleeping') {
    for (let i = 0; i < 3; i++) {
      const k = (g.t * 0.5 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      text('z', g.petX + b.rx * 0.6 + k * 22, b.cy - b.ry - k * 26, 10 + k * 8, '#fff', '#5a3a8a');
    }
    ctx.globalAlpha = 1;
  }
  return b;
}

function egg() {
  const g = game;
  const hatching = g.action === 'hatch';
  const shake = hatching ? (g.actT < 1.2 ? Math.sin(g.actT * 50) * 3 : 0) : Math.sin(g.t * 30) * g.wobble * 4;
  const cx = W / 2 + shake;
  const cy = 170;
  ctx.fillStyle = 'rgba(60,30,10,0.25)';
  ctx.beginPath();
  ctx.ellipse(W / 2, FEET + 3, 28, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(hatching ? 0 : Math.sin(g.t * 1.8) * 0.04 + shake * 0.01);
  const grd = ctx.createLinearGradient(-30, -40, 30, 50);
  grd.addColorStop(0, '#fff6e0');
  grd.addColorStop(1, '#e8cfa0');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(0, 0, 32, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0a0c0';
  for (const [x, y, rr] of [[-14, -16, 6], [12, -8, 5], [-6, 14, 7], [16, 22, 4], [-20, 8, 3]]) {
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  const cracks = hatching ? 3 : g.eggTaps;
  ctx.strokeStyle = '#6a4a3a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (cracks >= 1) {
    ctx.moveTo(-8, -38);
    ctx.lineTo(-2, -26);
    ctx.lineTo(-10, -20);
  }
  if (cracks >= 2) {
    ctx.moveTo(14, -30);
    ctx.lineTo(8, -18);
    ctx.lineTo(16, -10);
  }
  if (cracks >= 3) {
    ctx.moveTo(-26, 0);
    ctx.lineTo(-14, 6);
    ctx.lineTo(-20, 16);
    ctx.lineTo(-6, 20);
  }
  ctx.stroke();
  ctx.restore();
  if (hatching && g.actT > 1.2) {
    ctx.fillStyle = `rgba(255,255,255,${(g.actT - 1.2) / 0.4})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function draw() {
  const g = game;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  room();

  if (g.phase === 'egg') {
    egg();
    text('Pocket Pal', W / 2, 40, 22, '#fff', '#6a4a8a');
    if (g.action !== 'hatch') text('tap the egg!', W / 2, 262, 13, '#fff', '#6a4a8a');
    return;
  }

  stat(0, '🍎', g.fullness);
  stat(1, '💖', g.happy);
  stat(2, '⚡', g.energy);
  text(`${g.name} ✎`, W / 2, 61, 13, '#5a3a6a', '#fff4e6');
  const b = drawPet();

  // floaties
  for (const f of g.floaties) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.fillStyle = '#ff5a8a';
    emoji(f.glyph === '♥' ? '💗' : f.glyph, f.x, f.y, 11);
  }
  ctx.globalAlpha = 1;

  // speech bubble
  if (g.noteT > 0) {
    ctx.font = '800 10px system-ui, sans-serif';
    const w = ctx.measureText(g.note).width + 14;
    const bx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, g.petX));
    const by = b.cy - b.ry - 34;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(bx - w / 2, by - 11, w, 22, 9);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - 4, by + 10);
    ctx.lineTo(bx, by + 17);
    ctx.lineTo(bx + 4, by + 10);
    ctx.fill();
    text(g.note, bx, by, 10, '#5a3a6a');
  }

  // night dimming
  if (g.asleep) {
    ctx.fillStyle = 'rgba(10,10,50,0.5)';
    ctx.fillRect(0, 0, W, 262);
  }

  // buttons
  const busy = g.action !== 'idle';
  for (const bt of BTNS) {
    const off = busy || (g.asleep && bt.id !== 'sleep');
    ctx.globalAlpha = off ? 0.45 : 1;
    ctx.fillStyle = bt.id === 'feed' ? '#ff8a5a' : bt.id === 'play' ? '#5ab8ff' : '#8a7ae0';
    ctx.beginPath();
    ctx.roundRect(bt.x, bt.y, bt.w, bt.h, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(bt.x + 3, bt.y + 3, bt.w - 6, 12, 8);
    ctx.fill();
    const ic = bt.id === 'feed' ? (foodKind === 0 ? '🍎' : '🍪') : bt.id === 'play' ? '🎾' : g.asleep ? '☀️' : '🌙';
    ctx.fillStyle = '#fff';
    emoji(ic, bt.x + bt.w / 2, bt.y + 19, 18);
    text(bt.id === 'sleep' ? (g.asleep ? 'Wake' : 'Sleep') : bt.id === 'feed' ? 'Feed' : 'Play', bt.x + bt.w / 2, bt.y + 36, 9, '#fff');
  }
  ctx.globalAlpha = 1;

  // welcome-back card
  if (g.welcome) {
    ctx.fillStyle = 'rgba(20,10,40,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff6ea';
    ctx.beginPath();
    ctx.roundRect(16, 110, W - 32, 90, 12);
    ctx.fill();
    wrapText(g.welcome, W / 2, 138, W - 56, 12, '#5a3a6a');
    text('tap to continue', W / 2, 186, 9, '#a07ab0');
  }
}

function wrapText(s: string, x: number, y: number, maxW: number, lh: number, color: string) {
  ctx.font = '700 10px system-ui, sans-serif';
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  const y0 = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => text(l, x, y0 + i * lh, 10, color));
}

// ---- input ----

function pos(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const p = pos(e);
  if (game.phase === 'egg') return game.tapEgg();
  if (game.welcome) {
    game.welcome = '';
    return;
  }
  for (const b of BTNS) {
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      if (b.id === 'feed') {
        foodKind = 1 - foodKind;
        game.feed();
      } else if (b.id === 'play') game.play();
      else game.toggleSleep();
      return;
    }
  }
  if (p.x >= NAME_RECT.x && p.x <= NAME_RECT.x + NAME_RECT.w && p.y >= NAME_RECT.y && p.y <= NAME_RECT.y + NAME_RECT.h) {
    const n = window.prompt('Name your pal:', game.name);
    if (n) game.rename(n);
    return;
  }
  const dx = p.x - game.petX;
  const dy = p.y - (FEET - 28);
  if (dx * dx + dy * dy < 40 * 40) game.pet();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

el('mute').addEventListener('pointerdown', (e) => e.stopPropagation());
el('mute').addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
  renderBar();
});

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    game.save();
  } else if (hiddenAt) {
    game.catchUp(hiddenAt);
    hiddenAt = 0;
    game.save();
  }
});
window.addEventListener('pagehide', () => game.save());

function renderBar() {
  el('age').textContent = game.phase === 'live' ? `DAY ${game.ageDays + 1}` : '';
  el('mute').textContent = sound.muted ? '🔇' : '🔊';
}
renderBar();

let prev = performance.now();
let lastAge = '';
function frame(now: number) {
  const dt = (now - prev) / 1000;
  prev = now;
  game.update(dt);
  draw();
  const a = `${game.phase}${game.ageDays}`;
  if (a !== lastAge) {
    lastAge = a;
    renderBar();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __game: PetGame }).__game = game;
