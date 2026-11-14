import './style.css';
import { COLS, CROPS, CROP_BY_ID, FarmGame, H, W, fmtTime } from './game/engine';
import type { CropId } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new FarmGame();
const sound = new Sound();
game.onEvent = (e) => sound.play(e);

app.innerHTML = `
  <div class="table fl">
    <div class="bar">
      <span id="stat"></span>
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

const GX = 7;
const GY = 48;
const CELL = 40;
const STEP = 42;
const plotRect = (i: number) => ({ x: GX + (i % COLS) * STEP, y: GY + Math.floor(i / COLS) * STEP, w: CELL, h: CELL });
const PACK_Y = 250;
const packRect = (i: number) => ({ x: 4 + i * 35, y: PACK_Y, w: 33, h: 34 });
const HARV = { x: 5, y: 289, w: 108, h: 26 };
const SHOP = { x: 119, y: 289, w: 56, h: 26 };

// shop layout
let shopOpen = false;
let qtyIdx = 0;
const QTY = [1, 5, 10];
const S_CLOSE = { x: 150, y: 6, w: 24, h: 22 };
const qtyRect = (i: number) => ({ x: 10 + i * 56, y: 30, w: 52, h: 18 });
const seedRow = (i: number) => ({ x: 6, y: 66 + i * 22, w: 168, h: 20 });
const cropRow = (i: number) => ({ x: 6, y: 190 + i * 22, w: 168, h: 20 });
const buyBtn = (i: number) => ({ x: 124, y: 67 + i * 22, w: 48, h: 18 });
const sellBtn = (i: number) => ({ x: 124, y: 191 + i * 22, w: 48, h: 18 });
const SELL_ALL = { x: 10, y: 302, w: 160, h: 16 };

type Rect = { x: number; y: number; w: number; h: number };
const inside = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- helpers ----

function text(s: string, x: number, y: number, size: number, fill: string, stroke = '#12200a', align: CanvasTextAlign = 'center') {
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
function ell(x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(c1: [number, number, number], c2: [number, number, number], t: number) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
}
const GREEN: [number, number, number] = [96, 180, 70];

// ---- crops ----

/** Draw a crop with its base at (bx, by). rp is 0..1 ripeness; sc is the overall scale. */
function drawCrop(id: CropId, bx: number, by: number, sc: number, rp: number) {
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(sc, sc);
  const leaf = '#4fa83a';
  const leaf2 = '#3a8a2c';
  switch (id) {
    case 'radish': {
      ell(-7, -8, 4, 8, leaf2, -0.5);
      ell(7, -8, 4, 8, leaf2, 0.5);
      ell(0, -11, 4.5, 10, leaf, 0);
      ell(0, -2, 8, 7, mix(GREEN, [225, 60, 90], rp), 0);
      ell(-2, -4, 2.5, 2, 'rgba(255,255,255,0.4)', -0.5);
      break;
    }
    case 'carrot': {
      ell(-6, -13, 3, 9, leaf2, -0.5);
      ell(6, -13, 3, 9, leaf2, 0.5);
      ell(0, -15, 3.5, 11, leaf, 0);
      ctx.fillStyle = mix(GREEN, [255, 140, 30], rp);
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(7, -4);
      ctx.lineTo(0, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(-4, -2, 8, 1);
      break;
    }
    case 'tomato': {
      ctx.strokeStyle = leaf2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(-4, -12, 0, -22);
      ctx.stroke();
      ell(-8, -14, 6, 3, leaf, -0.4);
      ell(8, -18, 6, 3, leaf, 0.4);
      const col = mix(GREEN, [230, 50, 40], rp);
      ell(-6, -4, 7, 7, col);
      ell(7, -9, 6, 6, col);
      ell(-8, -6, 2, 2, 'rgba(255,255,255,0.45)');
      ell(5, -11, 1.8, 1.8, 'rgba(255,255,255,0.45)');
      ell(-6, -10, 3, 1.5, leaf2);
      break;
    }
    case 'pumpkin': {
      ell(-9, -12, 6, 3, leaf, -0.5);
      const col = mix(GREEN, [245, 125, 20], rp);
      ell(0, -3, 12, 10, col);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1.5;
      for (const dx of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.ellipse(dx * 0.7, -3, Math.abs(dx) * 0.3 + 2, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#5a7a2a';
      ctx.fillRect(-2, -15, 4, 6);
      ell(-4, -6, 3, 2, 'rgba(255,255,255,0.35)', -0.5);
      break;
    }
    case 'sunflower': {
      ctx.strokeStyle = leaf2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, -22);
      ctx.stroke();
      ell(-7, -8, 6, 3, leaf, -0.5);
      ell(7, -12, 6, 3, leaf, 0.5);
      const pc = mix([150, 190, 80], [255, 205, 30], rp);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ell(Math.cos(a) * 9, -26 + Math.sin(a) * 9, 5, 2.6, pc, a);
      }
      ell(0, -26, 6, 6, mix([90, 110, 40], [110, 60, 20], rp));
      ell(-2, -28, 2, 2, 'rgba(255,255,255,0.25)');
      break;
    }
  }
  ctx.restore();
}

function cropIcon(id: CropId, cx: number, cy: number, s = 0.5) {
  drawCrop(id, cx, cy + 6 * s * 2, s, 1);
}

function plotGraphics(i: number) {
  const g = game;
  const p = g.plots[i];
  const r = plotRect(i);
  const cx = r.x + r.w / 2;
  if (!p.unlocked) {
    rr(r.x, r.y, r.w, r.h, 6, 'rgba(70,120,50,0.55)');
    ctx.strokeStyle = 'rgba(40,80,30,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.roundRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 6);
    ctx.stroke();
    ctx.setLineDash([]);
    // padlock
    rr(cx - 6, r.y + 15, 12, 9, 2, '#d8d0a0');
    ctx.strokeStyle = '#d8d0a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, r.y + 15, 4, Math.PI, 0);
    ctx.stroke();
    text(String(g.nextUnlockCost()), cx, r.y + 32, 8, '#ffe08a', '#12200a');
    return;
  }
  // soil
  rr(r.x, r.y + 2, r.w, r.h, 6, '#4a2a14');
  rr(r.x, r.y, r.w, r.h, 6, '#7a4a28');
  rr(r.x + 2, r.y + 2, r.w - 4, r.h - 6, 5, '#8d5a32');
  ctx.fillStyle = 'rgba(60,30,10,0.35)';
  for (let k = 0; k < 4; k++) ctx.fillRect(r.x + 5, r.y + 8 + k * 7, r.w - 10, 1.5);
  if (!p.crop) return;
  const prog = g.progress(p);
  const ready = prog >= 1;
  const bob = ready ? Math.abs(Math.sin(g.t * 5 + i)) * 3 : 0;
  const by = r.y + r.h - 12 - bob;
  if (prog < 0.16) {
    // seed mound with a tiny sprout
    ell(cx, r.y + r.h - 13, 8, 4, '#6a3a1c');
    ell(cx, r.y + r.h - 15, 6, 3, '#9a6a3c');
    if (prog > 0.08) {
      ctx.strokeStyle = '#6ab84a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, r.y + r.h - 15);
      ctx.lineTo(cx, r.y + r.h - 21);
      ctx.stroke();
    }
  } else {
    const sc = lerp(0.35, 1, Math.min(1, (prog - 0.16) / 0.84));
    const rp = Math.max(0, (prog - 0.6) / 0.4);
    drawCrop(p.crop, cx, by, sc, rp);
  }
  if (ready) {
    // sparkles
    for (let k = 0; k < 3; k++) {
      const a = g.t * 3 + k * 2.1 + i;
      const sx = cx + Math.cos(a) * 14;
      const sy = r.y + 14 + Math.sin(a * 1.3) * 8;
      ctx.fillStyle = `rgba(255,255,200,${0.5 + 0.5 * Math.sin(g.t * 8 + k)})`;
      ctx.fillRect(sx - 1, sy - 3, 2, 6);
      ctx.fillRect(sx - 3, sy - 1, 6, 2);
    }
    rr(cx - 11, r.y + r.h - 9, 22, 7, 3, '#12200a');
    text('READY', cx, r.y + r.h - 5.5, 6, '#9af070', 'transparent');
  } else {
    // progress bar
    rr(cx - 14, r.y + r.h - 8, 28, 4, 2, 'rgba(0,0,0,0.5)');
    rr(cx - 14, r.y + r.h - 8, Math.max(2, 28 * prog), 4, 2, '#8ae05a');
  }
  if (g.focus === i) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, 7);
    ctx.stroke();
  }
}

// ---- scene ----

function scene() {
  const g = ctx.createLinearGradient(0, 0, 0, 52);
  g.addColorStop(0, '#7fc8f0');
  g.addColorStop(1, '#d6f0fa');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 60);
  ctx.fillStyle = '#fff2a8';
  ctx.beginPath();
  ctx.arc(150, 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const cx = ((game.t * 4) % (W + 60)) - 30;
  ell(cx, 18, 14, 5, 'rgba(255,255,255,0.8)');
  ell(cx - 8, 20, 8, 4, 'rgba(255,255,255,0.8)');
  ell(cx + 9, 20, 9, 4, 'rgba(255,255,255,0.8)');
  // hills
  ctx.fillStyle = '#8fd070';
  ctx.beginPath();
  ctx.moveTo(0, 44);
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, 36 - Math.sin(x * 0.04) * 6);
  ctx.lineTo(W, 60);
  ctx.lineTo(0, 60);
  ctx.fill();
  // meadow
  ctx.fillStyle = '#6cbc4c';
  ctx.fillRect(0, 40, W, H - 40);
  ctx.fillStyle = '#5aaa3c';
  for (let y = 56; y < H; y += 14) for (let x = (y % 28 ? 6 : 14); x < W; x += 28) ctx.fillRect(x, y, 6, 2);
  // fence around the field
  rr(2, 43, W - 4, 176, 8, '#5a3a1a');
  rr(4, 45, W - 8, 172, 7, '#4f9a38');
  ctx.fillStyle = '#e0b878';
  for (let x = 6; x < W - 4; x += 12) {
    ctx.fillRect(x, 40, 5, 12);
    ctx.fillRect(x, 213, 5, 12);
  }
  ctx.fillStyle = '#c8985a';
  ctx.fillRect(2, 44, W - 4, 3);
  ctx.fillRect(2, 217, W - 4, 3);
}

function header() {
  // coin counter
  rr(6, 5, 76, 22, 11, 'rgba(18,32,10,0.75)');
  ctx.fillStyle = '#ffd34a';
  ctx.beginPath();
  ctx.arc(19, 16, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c98a14';
  ctx.beginPath();
  ctx.arc(19, 16, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd34a';
  ctx.fillRect(18, 12, 2, 8);
  text(String(game.coins), 62, 16.5, 12, '#fff', 'transparent');
  const rc = game.readyCount();
  if (rc > 0) {
    rr(92, 6, 82, 20, 10, '#2a6a1a');
    text(`${rc} READY!`, 133, 16.5, 9, '#d8ffa8', 'transparent');
  } else {
    text('TINY FARM', 133, 16.5, 10, '#3a6a2a', '#e8f8d8');
  }
}

function strip() {
  const g = game;
  let msg = '';
  let col = '#fff';
  if (g.noteT > 0) {
    msg = g.note;
    col = '#ffe08a';
  } else if (g.focus >= 0 && g.plots[g.focus].crop) {
    const p = g.plots[g.focus];
    msg = g.ready(p) ? `${CROP_BY_ID[p.crop!].name.toUpperCase()}  ·  READY TO HARVEST` : `${CROP_BY_ID[p.crop!].name.toUpperCase()}  ·  ${fmtTime(g.remainingMs(p))} LEFT`;
  } else {
    const d = CROP_BY_ID[g.selected];
    msg = `PLANTING ${d.name.toUpperCase()}  ·  ${g.seeds[g.selected]} ${g.seeds[g.selected] === 1 ? 'SEED' : 'SEEDS'}`;
    col = '#d8f0c0';
  }
  rr(6, 224, W - 12, 20, 10, 'rgba(18,32,10,0.72)');
  text(msg, W / 2, 234.5, 9, col, 'transparent');
}

function toolbar() {
  const g = game;
  CROPS.forEach((c, i) => {
    const r = packRect(i);
    const sel = g.selected === c.id;
    const has = g.seeds[c.id] > 0;
    rr(r.x, r.y + 1, r.w, r.h, 6, 'rgba(0,0,0,0.35)');
    rr(r.x, r.y, r.w, r.h, 6, sel ? '#fff3c0' : '#e8dcb0');
    rr(r.x + 2, r.y + 2, r.w - 4, 5, 3, sel ? '#ffb030' : '#a07a3a');
    ctx.save();
    ctx.globalAlpha = has ? 1 : 0.4;
    cropIcon(c.id, r.x + r.w / 2, r.y + 18, 0.45);
    ctx.restore();
    text(String(g.seeds[c.id]), r.x + r.w / 2, r.y + r.h - 5, 9, has ? '#3a2a10' : '#8a7a5a', 'transparent');
    if (sel) {
      ctx.strokeStyle = '#ffb030';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, 7);
      ctx.stroke();
    }
  });
  const rc = g.readyCount();
  rr(HARV.x, HARV.y + 1, HARV.w, HARV.h, 9, 'rgba(0,0,0,0.35)');
  rr(HARV.x, HARV.y, HARV.w, HARV.h, 9, rc > 0 ? '#3aa83a' : '#5a7a4a');
  rr(HARV.x + 3, HARV.y + 3, HARV.w - 6, 8, 5, 'rgba(255,255,255,0.22)');
  text(rc > 0 ? `HARVEST ALL (${rc})` : 'HARVEST ALL', HARV.x + HARV.w / 2, HARV.y + 14, 10, rc > 0 ? '#fff' : '#c8d8b8', 'transparent');
  rr(SHOP.x, SHOP.y + 1, SHOP.w, SHOP.h, 9, 'rgba(0,0,0,0.35)');
  rr(SHOP.x, SHOP.y, SHOP.w, SHOP.h, 9, '#e08a2a');
  rr(SHOP.x + 3, SHOP.y + 3, SHOP.w - 6, 8, 5, 'rgba(255,255,255,0.25)');
  text('SHOP', SHOP.x + SHOP.w / 2, SHOP.y + 14, 10, '#fff', 'transparent');
}

function button(r: Rect, label: string, fill: string, size = 9, textCol = '#fff') {
  rr(r.x, r.y + 1, r.w, r.h, 6, 'rgba(0,0,0,0.35)');
  rr(r.x, r.y, r.w, r.h, 6, fill);
  rr(r.x + 2, r.y + 2, r.w - 4, r.h * 0.38, 4, 'rgba(255,255,255,0.2)');
  text(label, r.x + r.w / 2, r.y + r.h / 2 + 0.5, size, textCol, 'transparent');
}

function shop() {
  const g = game;
  ctx.fillStyle = '#2a4a1a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#34581f';
  for (let y = 0; y < H; y += 12) ctx.fillRect(0, y, W, 6);
  text('SHOP', W / 2, 17, 15, '#ffe08a');
  rr(8, 4, 66, 18, 9, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = '#ffd34a';
  ctx.beginPath();
  ctx.arc(19, 13, 6, 0, Math.PI * 2);
  ctx.fill();
  text(String(g.coins), 45, 13.5, 10, '#fff', 'transparent');
  button(S_CLOSE, 'X', '#c0503a', 11);
  QTY.forEach((q, i) => button(qtyRect(i), `BUY x${q}`, qtyIdx === i ? '#e08a2a' : '#5a7a4a', 8));
  text('SEEDS', 10, 59, 9, '#c8e8a8', 'transparent', 'left');
  CROPS.forEach((c, i) => {
    const r = seedRow(i);
    rr(r.x, r.y, r.w, r.h, 6, 'rgba(0,0,0,0.28)');
    cropIcon(c.id, r.x + 14, r.y + 12, 0.45);
    text(c.name, r.x + 28, r.y + 7, 9, '#fff', 'transparent', 'left');
    text(`${Math.round(c.growMs / 60000) >= 60 ? `${Math.round(c.growMs / 3600000)}h` : `${Math.round(c.growMs / 60000)}m`} grow · $${c.sell}`, r.x + 28, r.y + 15.5, 6.5, '#b0d090', 'transparent', 'left');
    text(`x${g.seeds[c.id]}`, 114, r.y + 10, 9, '#ffe08a', 'transparent', 'right');
    const afford = g.coins >= c.seedCost;
    button(buyBtn(i), `BUY ${c.seedCost * QTY[qtyIdx]}`, afford ? '#3aa83a' : '#6a6a5a', 8);
  });
  text('CROPS', 10, 183, 9, '#c8e8a8', 'transparent', 'left');
  CROPS.forEach((c, i) => {
    const r = cropRow(i);
    rr(r.x, r.y, r.w, r.h, 6, 'rgba(0,0,0,0.28)');
    cropIcon(c.id, r.x + 14, r.y + 12, 0.45);
    text(c.name, r.x + 28, r.y + 10, 9, '#fff', 'transparent', 'left');
    text(`x${g.crops[c.id]}`, 114, r.y + 10, 9, '#ffe08a', 'transparent', 'right');
    const has = g.crops[c.id] > 0;
    button(sellBtn(i), `SELL ${c.sell}`, has ? '#e08a2a' : '#6a6a5a', 8);
  });
  const val = g.cropValue();
  button(SELL_ALL, val > 0 ? `SELL ALL CROPS  +${val}` : 'SELL ALL CROPS', val > 0 ? '#3aa83a' : '#6a6a5a', 9);
}

function draw() {
  const g = game;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (shopOpen) {
    shop();
  } else {
    scene();
    for (let i = 0; i < COLS * 4; i++) plotGraphics(i);
    header();
    strip();
    toolbar();
  }
  for (const f of g.floaties) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    text(f.text, f.x, f.y, 10, f.color);
  }
  ctx.globalAlpha = 1;
  if (g.welcome) {
    ctx.fillStyle = 'rgba(10,25,5,0.7)';
    ctx.fillRect(0, 0, W, H);
    rr(14, 112, W - 28, 96, 12, '#f4f0d0');
    wrap(g.welcome, W / 2, 148, W - 56, 12, '#3a4a20');
    text('tap to continue', W / 2, 192, 9, '#8a9a60', 'transparent');
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

function pos(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const { x, y } = pos(e);
  if (game.welcome) {
    game.welcome = '';
    return;
  }
  if (shopOpen) {
    if (inside(S_CLOSE, x, y)) {
      shopOpen = false;
      sound.play('tap');
      return;
    }
    QTY.forEach((_q, i) => {
      if (inside(qtyRect(i), x, y)) {
        qtyIdx = i;
        sound.play('tap');
      }
    });
    CROPS.forEach((c, i) => {
      if (inside(buyBtn(i), x, y)) game.buy(c.id, QTY[qtyIdx]);
      if (inside(sellBtn(i), x, y)) game.sell(c.id, QTY[qtyIdx] === 1 ? 1 : QTY[qtyIdx]);
    });
    if (inside(SELL_ALL, x, y)) game.sellAll();
    return;
  }
  for (let i = 0; i < 4 * COLS; i++) {
    const r = plotRect(i);
    if (inside(r, x, y)) return game.tapPlot(i, r.x + r.w / 2, r.y + 10);
  }
  CROPS.forEach((c, i) => {
    if (inside(packRect(i), x, y)) game.select(c.id);
  });
  if (inside(HARV, x, y)) game.harvestAll();
  if (inside(SHOP, x, y)) {
    shopOpen = true;
    sound.play('tap');
  }
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

el('mute').addEventListener('pointerdown', (e) => e.stopPropagation());
el('mute').addEventListener('click', () => {
  sound.unlock();
  sound.toggle();
  renderBar();
});

// coming back from the background: catch up and show a summary
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    game.save();
  } else if (hiddenAt) {
    game.welcomeBack(hiddenAt);
    hiddenAt = 0;
  }
});
window.addEventListener('pagehide', () => game.save());

function renderBar() {
  el('stat').textContent = `${game.unlockedCount()}/${COLS * 4} PLOTS  ·  ${game.harvested} HARVESTED`;
  el('mute').textContent = sound.muted ? '🔇' : '🔊';
}
renderBar();

let prev = performance.now();
let lastStat = '';
function frame(now: number) {
  const dt = (now - prev) / 1000;
  prev = now;
  game.update(dt);
  draw();
  const st = `${game.unlockedCount()}${game.harvested}`;
  if (st !== lastStat) {
    lastStat = st;
    renderBar();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __game: FarmGame }).__game = game;
