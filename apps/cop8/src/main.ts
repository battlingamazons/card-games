import './style.css';
import { COLS, CopGame, H, MAG, ROW_Y, SCENE_BOTTOM, W, isEnemy } from './game/engine';
import type { Kind, Target } from './game/engine';
import { Sound } from './sound';

// ---- 8-bit renderer: the whole game is drawn on a tiny 90x160 canvas using a fixed 16-colour palette,
// then blown up with smoothing off. Game logic still runs in 180x320 coordinates (1 pixel = 2 units).

const PW = 90;
const PH = 160;

// PICO-8 palette (16 colours)
const C = {
  black: '#000000',
  navy: '#1d2b53',
  plum: '#7e2553',
  green: '#008751',
  brown: '#ab5236',
  dgray: '#5f574f',
  lgray: '#c2c3c7',
  white: '#fff1e8',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  lime: '#00e436',
  blue: '#29adff',
  lav: '#83769c',
  pink: '#ff77a8',
  peach: '#ffccaa',
};

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
      <span class="btns"><button class="icon-btn" id="crt" aria-label="Toggle scanlines">CRT</button><button class="icon-btn" id="mute" aria-label="Toggle sound"></button></span>
    </div>
    <div class="screen" id="screen"><canvas id="game"></canvas></div>
  </div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const out = canvas.getContext('2d')!;
const px = document.createElement('canvas');
px.width = PW;
px.height = PH;
const ctx = px.getContext('2d')!;
const el = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!;

let crt = false;
try {
  crt = localStorage.getItem('cop8-crt') === '1';
} catch {
  /* ignore */
}

let k = 1; // device pixels per art pixel
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const availW = Math.min(document.documentElement.clientWidth - 16, 520);
  const bar = document.querySelector<HTMLElement>('.bar')!.offsetHeight;
  const availH = app.clientHeight - bar - 40;
  k = Math.max(1, Math.floor(Math.min((availW * dpr) / PW, (availH * dpr) / PH)));
  canvas.width = PW * k;
  canvas.height = PH * k;
  canvas.style.width = `${(PW * k) / dpr}px`;
  canvas.style.height = `${(PH * k) / dpr}px`;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
resize();

function musicFor() {
  sound.music(game.stage % 3);
}

// ---- pixel helpers ----

function R(x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function P(x: number, y: number, c: string) {
  R(x, y, 1, 1, c);
}
function D(cx: number, cy: number, r: number, c: string) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
    R(cx - w, cy + y, 2 * w + 1, 1, c);
  }
}
function line(x0: number, y0: number, x1: number, y1: number, c: string, t = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    R(x0, y0, t, t, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
/** Checkerboard dither of a colour (50% of pixels). */
function dither(x: number, y: number, w: number, h: number, c: string, phase = 0) {
  ctx.fillStyle = c;
  for (let j = 0; j < h; j++) for (let i = (j + phase) % 2; i < w; i += 2) ctx.fillRect(x + i, y + j, 1, 1);
}

// 3x5 bitmap font
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '1000111011101011000110001', N: '10011101101110011001', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '1000110001101011101110001', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '!': '010010010000010', '.': '000000000000010', ',': '000000000010100', "'": '010010000000000',
  ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', x: '000101010101000', '?': '110001010000010',
  '/': '001001010100100', ' ': '000000000000000',
};

const gw = (ch: string) => (FONT[ch] ?? FONT['?']).length / 5;
function tw(s: string, sc = 1) {
  let w = 0;
  for (const ch of s.toUpperCase()) w += (gw(ch) + 1) * sc;
  return w - sc;
}
function glyphs(s: string, x: number, y: number, sc: number, c: string) {
  ctx.fillStyle = c;
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT['?'];
    const w = g.length / 5;
    for (let i = 0; i < g.length; i++) if (g[i] === '1') ctx.fillRect(cx + (i % w) * sc, y + Math.floor(i / w) * sc, sc, sc);
    cx += (w + 1) * sc;
  }
}
/** Text with a 1px outline. align: 0 left, 1 centre, 2 right. */
function txt(s: string, x: number, y: number, c: string, sc = 1, align = 1, outline: string | null = C.black) {
  const w = tw(s, sc);
  const x0 = Math.round(align === 1 ? x - w / 2 : align === 2 ? x - w : x);
  const y0 = Math.round(y);
  if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) glyphs(s, x0 + dx, y0 + dy, sc, outline);
  glyphs(s, x0, y0, sc, c);
}

/** Draw text at the largest scale (<= maxSc) that fits in maxW pixels. */
function fit(s: string, x: number, y: number, c: string, maxSc: number, maxW: number, outline: string | null = null) {
  let sc = maxSc;
  while (sc > 1 && tw(s, sc) > maxW) sc--;
  txt(s, x, y, c, sc, 1, outline);
}
/** Banner text: splits long lines in two so they stay on screen. */
function banner(s: string, x: number, y: number, c: string) {
  if (s.length <= 21) return txt(s, x, y, c, 1);
  const mid = s.length / 2;
  let cut = s.indexOf(' ');
  for (let i = 0; i < s.length; i++) if (s[i] === ' ' && Math.abs(i - mid) < Math.abs(cut - mid)) cut = i;
  txt(s.slice(0, cut), x, y - 4, c, 1);
  txt(s.slice(cut + 1), x, y + 4, c, 1);
}

// ---- themes ----

interface Theme {
  wall: string;
  mortar: string;
  neon: string;
  frame: string;
  inside: string;
  ground: string;
  groundDark: string;
  top: 'window' | 'container' | 'door';
  row1: 'dumpster' | 'crate' | 'speaker';
  row2: 'car' | 'barrel' | 'couch';
  skyA: string;
  skyB: string;
  label: string;
}
const THEMES: Theme[] = [
  { wall: C.brown, mortar: C.plum, neon: C.pink, frame: C.pink, inside: C.navy, ground: C.dgray, groundDark: C.black, top: 'window', row1: 'dumpster', row2: 'car', skyA: C.navy, skyB: C.plum, label: 'DONUTS' },
  { wall: C.dgray, mortar: C.black, neon: C.yellow, frame: C.orange, inside: C.navy, ground: C.lav, groundDark: C.dgray, top: 'container', row1: 'crate', row2: 'barrel', skyA: C.navy, skyB: C.orange, label: 'PORT' },
  { wall: C.plum, mortar: C.navy, neon: C.blue, frame: C.blue, inside: C.lav, ground: C.navy, groundDark: C.black, top: 'door', row1: 'speaker', row2: 'couch', skyA: C.black, skyB: C.plum, label: 'DISCO' },
];

const PX_ROW = ROW_Y.map((y) => y / 2); // 50, 79, 111
const PX_COLS = COLS.map((x) => x / 2); // 16, 45, 74
const FACADE_Y = 22;
const STREET_Y = 90;
const SCENE_PB = SCENE_BOTTOM / 2; // 131

function scene(th: Theme) {
  // sky
  R(0, 0, PW, 22, th.skyA);
  dither(0, 12, PW, 10, th.skyB, 0);
  R(0, 18, PW, 4, th.skyB);
  // stars / skyline
  ctx.fillStyle = C.white;
  for (let i = 0; i < 9; i++) ctx.fillRect((i * 37) % PW, 2 + ((i * 11) % 10), 1, 1);
  for (let i = 0; i < 8; i++) R(i * 12 - 2, 17 - ((i * 5) % 4), 9, 6, C.black);
  // facade
  R(0, FACADE_Y, PW, STREET_Y - FACADE_Y, th.wall);
  ctx.fillStyle = th.mortar;
  for (let y = FACADE_Y + 3; y < STREET_Y; y += 4) {
    ctx.fillRect(0, y, PW, 1);
    const off = ((y - FACADE_Y) / 4) % 2 ? 0 : 4;
    for (let x = off; x < PW; x += 8) ctx.fillRect(x, y - 3, 1, 3);
  }
  R(0, FACADE_Y, PW, 1, th.neon);
  // street
  R(0, STREET_Y, PW, SCENE_PB - STREET_Y, th.ground);
  R(0, STREET_Y, PW, 2, th.groundDark);
  for (let x = 3; x < PW; x += 15) R(x, 104, 8, 1, C.white);
  dither(0, SCENE_PB - 4, PW, 4, th.groundDark, 0);
  // sign
  if (Math.sin(game.t * 7) > -0.6) txt(th.label, PW / 2, 24, th.neon, 1, 1, null);
}

function topFrame(cx: number, th: Theme) {
  R(cx - 10, 27, 20, 23, th.inside);
  if (th.top === 'window') {
    for (let y = 30; y < 50; y += 5) dither(cx - 10, y, 20, 1, C.navy, 0);
  }
}
function topFront(cx: number, th: Theme) {
  const f = th.frame;
  R(cx - 11, 26, 22, 1, f);
  R(cx - 11, 26, 1, 24, f);
  R(cx + 10, 26, 1, 24, f);
  R(cx - 12, 50, 24, 2, th.top === 'container' ? C.brown : C.navy);
  R(cx - 12, 50, 24, 1, f);
  if (th.top === 'container') for (let x = cx - 9; x < cx + 10; x += 3) R(x, 23, 1, 3, C.brown);
  if (th.top === 'door') {
    R(cx - 11, 26, 22, 1, game.t % 0.6 < 0.3 ? C.blue : C.pink);
  }
}

function cover(kind: Theme['row1'] | Theme['row2'], cx: number, y: number) {
  const x = cx - 13;
  switch (kind) {
    case 'dumpster':
      R(x, y, 26, 12, C.green);
      R(x - 1, y - 2, 28, 3, C.lime);
      R(x - 1, y + 1, 28, 1, C.black);
      R(x + 2, y + 5, 22, 1, C.lime);
      R(x + 3, y + 10, 3, 2, C.black);
      R(x + 20, y + 10, 3, 2, C.black);
      break;
    case 'car':
      R(x - 1, y + 2, 28, 10, C.red);
      R(x + 4, y - 3, 18, 6, C.red);
      R(x + 6, y - 2, 6, 4, C.blue);
      R(x + 14, y - 2, 6, 4, C.blue);
      R(x - 1, y + 5, 3, 2, C.yellow);
      R(x - 1, y + 9, 28, 1, C.plum);
      D(x + 5, y + 12, 2, C.black);
      D(x + 21, y + 12, 2, C.black);
      break;
    case 'crate':
      R(x, y, 26, 12, C.orange);
      R(x, y, 26, 1, C.brown);
      R(x, y + 11, 26, 1, C.brown);
      R(x, y, 1, 12, C.brown);
      R(x + 25, y, 1, 12, C.brown);
      line(x + 1, y + 1, x + 24, y + 10, C.brown);
      line(x + 24, y + 1, x + 1, y + 10, C.brown);
      break;
    case 'barrel':
      for (const bx of [x + 1, x + 9, x + 17]) {
        R(bx, y - 1, 8, 14, C.red);
        R(bx, y + 2, 8, 1, C.plum);
        R(bx, y + 8, 8, 1, C.plum);
        R(bx + 1, y - 1, 1, 14, C.pink);
      }
      break;
    case 'speaker':
      R(x + 1, y - 1, 24, 13, C.black);
      R(x + 1, y - 1, 24, 1, C.dgray);
      for (const sx of [x + 7, x + 18]) {
        D(sx, y + 5, 4, C.dgray);
        D(sx, y + 5, 1 + (Math.floor(game.t * 8 + sx) % 2), C.blue);
      }
      break;
    case 'couch':
      R(x - 1, y + 1, 28, 11, C.pink);
      R(x + 1, y - 2, 24, 5, C.plum);
      R(x - 2, y + 3, 4, 9, C.plum);
      R(x + 24, y + 3, 4, 9, C.plum);
      R(x + 3, y + 5, 20, 1, C.plum);
      break;
  }
}

// ---- characters (origin = feet centre, y grows down; the sprite is ~15x18 px) ----

function person(kind: Kind, t: Target, warn: boolean, cx: number, fy: number) {
  const flash = t.flash > 0;
  const c = (col: string) => (flash ? C.white : col);
  const bob = t.state === 'hold' ? (Math.floor(t.age * 4) % 2 ? 1 : 0) : 0;
  const y0 = Math.round(fy) + bob;
  const X = Math.round(cx);
  const r = (dx: number, dy: number, w: number, h: number, col: string) => R(X + dx, y0 + dy, w, h, c(col));
  const gunArm = () => {
    r(5, -8, 3, 2, C.peach);
    r(7, -9, 6, 2, C.black);
    r(7, -7, 2, 3, C.black);
    if (warn) {
      const big = Math.floor(t.age * 20) % 2;
      D(X + 15, y0 - 8, big ? 3 : 2, C.orange);
      D(X + 15, y0 - 8, 1, C.yellow);
    }
  };
  const wave = Math.floor(game.t * 4) % 2;
  const hands = () => {
    r(-8, -15 + wave, 2, 5, C.peach);
    r(7, -15 + (1 - wave), 2, 5, C.peach);
  };
  switch (kind) {
    case 'thug':
      for (let i = 0; i < 9; i++) r(-5, -9 + i, 11, 1, i % 2 ? C.black : C.white);
      r(-3, -18, 7, 1, C.black);
      r(-4, -17, 9, 8, C.black);
      r(-3, -15, 2, 1, C.white);
      r(1, -15, 2, 1, C.white);
      gunArm();
      break;
    case 'sharp':
      r(-5, -9, 11, 9, C.brown);
      r(-1, -9, 1, 1, C.black);
      r(1, -9, 1, 1, C.black);
      r(0, -8, 1, 2, C.black);
      r(-3, -15, 7, 6, C.peach);
      r(-3, -13, 7, 2, C.black);
      r(-3, -19, 7, 3, C.black);
      r(-6, -16, 13, 1, C.black);
      r(-3, -17, 7, 1, C.dgray);
      gunArm();
      break;
    case 'boss':
      r(-6, -10, 13, 10, C.white);
      r(-1, -10, 3, 7, C.pink);
      r(-4, -9, 9, 1, C.yellow);
      r(-4, -18, 9, 8, C.peach);
      r(-4, -16, 9, 2, C.black);
      r(-2, -12, 5, 1, C.brown);
      r(1, -13, 5, 1, C.brown);
      r(6, -13, 1, 1, C.red);
      r(-3, -22, 7, 3, C.black);
      r(-6, -19, 13, 1, C.black);
      gunArm();
      break;
    case 'tourist':
      r(-5, -9, 11, 9, C.blue);
      for (const [dx, dy, col] of [[-3, -7, C.yellow], [1, -5, C.pink], [-1, -2, C.yellow], [3, -8, C.pink]] as const) r(dx, dy, 2, 2, col);
      r(-3, -15, 7, 6, C.peach);
      r(-2, -13, 1, 1, C.black);
      r(2, -13, 1, 1, C.black);
      r(-1, -11, 3, 1, C.red);
      r(-6, -16, 13, 1, C.yellow);
      r(-3, -19, 7, 3, C.yellow);
      r(-3, -17, 7, 1, C.orange);
      r(-11, -12, 5, 4, C.black);
      r(-10, -11, 2, 2, C.blue);
      hands();
      break;
    case 'mayor':
      r(-5, -9, 11, 9, C.navy);
      line(X - 5, y0 - 9, X + 5, y0 - 1, C.red, 2);
      r(-3, -15, 7, 6, C.peach);
      r(-4, -17, 9, 3, C.lgray);
      r(-2, -13, 1, 1, C.black);
      r(2, -13, 1, 1, C.black);
      r(-2, -11, 5, 1, C.black);
      hands();
      break;
    case 'granny':
      r(-5, -9, 11, 9, C.lav);
      for (const [dx, dy] of [[-3, -7], [1, -4], [-2, -2], [3, -8]]) r(dx, dy, 1, 1, C.pink);
      r(-3, -15, 7, 6, C.peach);
      r(-3, -14, 3, 2, C.black);
      r(1, -14, 3, 2, C.black);
      r(-2, -14, 1, 1, C.white);
      r(2, -14, 1, 1, C.white);
      r(-4, -17, 9, 3, C.white);
      r(-2, -19, 5, 3, C.white);
      r(6, -5, 5, 4, C.red);
      r(7, -7, 3, 1, C.red);
      hands();
      break;
    case 'donut': {
      const f = Math.floor(game.t * 4) % 2;
      const cy = y0 - 6 - f;
      D(X, cy, 6, C.orange);
      D(X, cy - 1, 5, C.pink);
      D(X, cy, 2, C.black);
      for (const [dx, dy, col] of [[-4, -3, C.white], [3, -4, C.yellow], [4, 1, C.lime], [-3, 3, C.white], [0, -5, C.blue]] as const) P(X + dx, cy + dy, col);
      break;
    }
  }
  if (warn && isEnemy(kind)) txt('!', X, y0 - (kind === 'boss' ? 33 : 27), C.red, 2);
}

function drawTarget(t: Target) {
  const r = game.rect(t);
  const row = Math.floor(t.slot / 3);
  if (t.state === 'dead' && Math.floor(t.dieT * 18) % 2) return;
  const cx = r.cx / 2;
  const feet = r.feet / 2;
  ctx.save();
  ctx.beginPath();
  if (row === 0) ctx.rect(cx - 10, 27, 20, 23);
  else ctx.rect(cx - 17, PX_ROW[row] - 35, 34, 35);
  ctx.clip();
  person(t.kind, t, t.state === 'hold' && t.warned && isEnemy(t.kind), cx, feet);
  ctx.restore();
  if (t.maxHp > 1 && t.state !== 'dead') {
    for (let i = 0; i < t.maxHp; i++) R(cx - t.maxHp * 2 + i * 4, r.top / 2 - 4, 3, 2, i < t.hp ? C.red : C.black);
  }
}

// ---- HUD ----

function star(cx: number, cy: number, c: string) {
  R(cx - 1, cy - 3, 3, 1, c);
  R(cx - 3, cy - 2, 7, 2, c);
  R(cx - 2, cy, 5, 2, c);
  R(cx - 3, cy + 2, 3, 1, c);
  R(cx + 1, cy + 2, 3, 1, c);
  P(cx, cy - 1, C.orange);
}

const RELOAD = { x: 56, y: 135, w: 31, h: 20 };

function gun() {
  const gx = 45;
  const gy = 155;
  const a = Math.max(-1.0, Math.min(1.0, Math.atan2(game.aim.y / 2 - gy, game.aim.x / 2 - gx) + Math.PI / 2));
  const L = 14 - game.recoil * 3;
  const tx = gx + Math.sin(a) * L;
  const ty = gy - Math.cos(a) * L;
  line(gx, gy - 2, tx, ty, C.lgray, 3);
  line(gx, gy - 1, gx + Math.sin(a) * 8, gy - 1 - Math.cos(a) * 8, C.dgray, 5);
  R(gx - 2, gy, 5, 6, C.brown);
  R(gx - 2, gy, 5, 1, C.black);
  if (game.recoil > 0.5) {
    D(tx, ty - 1, 3, C.yellow);
    D(tx, ty - 1, 1, C.white);
  }
}

function hud() {
  const g = game;
  R(0, 0, PW, 20, C.black);
  R(0, 19, PW, 1, C.navy);
  const room = PW - 6 - g.lives * 8 - 6;
  const ssc = tw(String(g.score), 2) <= room ? 2 : 1;
  txt(String(g.score), 3, ssc === 2 ? 2 : 4, C.white, ssc, 0, null);
  txt(g.stageName, 3, 13, C.yellow, 1, 0, null);
  if (g.mult > 1) txt(`x${g.mult}`, 56, 3, C.lime, 1, 1, null);
  for (let i = 0; i < g.lives; i++) star(PW - 6 - i * 8, 7, C.yellow);
  // bottom bar
  R(0, SCENE_PB, PW, PH - SCENE_PB, C.black);
  R(0, SCENE_PB, PW, 1, C.navy);
  for (let i = 0; i < MAG; i++) {
    const have = i < g.ammo && g.reloadT <= 0;
    R(5 + i * 5, 141, 3, 7, have ? C.yellow : C.dgray);
    R(5 + i * 5, 146, 3, 3, have ? C.orange : C.black);
  }
  if (g.reloadT > 0) txt('RELOADING', 4, 135, C.white, 1, 0, null);
  const low = g.ammo <= 1 && g.reloadT <= 0;
  const bc = low ? (Math.floor(g.t * 6) % 2 ? C.red : C.plum) : C.navy;
  R(RELOAD.x, RELOAD.y, RELOAD.w, RELOAD.h, bc);
  R(RELOAD.x, RELOAD.y, RELOAD.w, 1, C.lav);
  R(RELOAD.x, RELOAD.y + RELOAD.h - 1, RELOAD.w, 1, C.black);
  txt('RELOAD', RELOAD.x + RELOAD.w / 2, RELOAD.y + 8, C.white, 1, 1, null);
  gun();
}

function panel(x: number, y: number, w: number, h: number) {
  R(x - 1, y - 1, w + 2, h + 2, C.lgray);
  R(x, y, w, h, C.navy);
}
function dim() {
  dither(0, 20, PW, SCENE_PB - 20, C.black, 0);
  dither(0, 20, PW, SCENE_PB - 20, C.black, 1);
  dither(0, 20, PW, SCENE_PB - 20, C.black, 0);
}
function wrapPx(s: string, x: number, y: number, maxChars: number, c: string) {
  const words = s.split(' ');
  const lines: string[] = [];
  let line2 = '';
  for (const w of words) {
    const t = line2 ? `${line2} ${w}` : w;
    if (t.length > maxChars && line2) {
      lines.push(line2);
      line2 = w;
    } else line2 = t;
  }
  lines.push(line2);
  lines.forEach((l, i) => txt(l, x, y + i * 7, c, 1, 1, null));
}

function draw() {
  const g = game;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const th = THEMES[g.stage % 3];
  ctx.save();
  if (g.shake > 0.1) ctx.translate(Math.round((Math.random() - 0.5) * 3 * g.shake), Math.round((Math.random() - 0.5) * 3 * g.shake));
  scene(th);
  for (const cx of PX_COLS) topFrame(cx, th);
  for (let row = 0; row < 3; row++) {
    for (const t of g.targets) if (Math.floor(t.slot / 3) === row) drawTarget(t);
    for (const cx of PX_COLS) {
      if (row === 0) topFront(cx, th);
      else cover(row === 1 ? th.row1 : th.row2, cx, PX_ROW[row]);
    }
  }
  // shot flashes
  for (const s of g.shots) {
    const x = Math.round(s.x / 2);
    const y = Math.round(s.y / 2);
    if (s.t < 0.08) {
      D(x, y, 2, C.yellow);
      P(x, y, C.white);
    } else if (s.t < 0.5) {
      P(x - 2, y, C.lgray);
      P(x + 2, y, C.lgray);
      P(x, y - 2, C.lgray);
      P(x, y + 2, C.lgray);
    }
  }
  for (const p of g.pops) {
    if (p.life < 0.25 && Math.floor(p.life * 30) % 2) continue;
    txt(p.text, p.x / 2, p.y / 2 - 2, p.color === '#ff6a5a' ? C.red : p.color === '#ffe08a' ? C.yellow : p.color === '#7fe0c4' ? C.lime : p.color === '#ff9a8a' ? C.pink : C.white, 1);
  }
  ctx.restore();

  if (g.hurtT > 0 && Math.floor(g.hurtT * 24) % 2 === 0) {
    R(0, 0, PW, 2, C.red);
    R(0, SCENE_PB - 2, PW, 2, C.red);
    R(0, 0, 2, SCENE_PB, C.red);
    R(PW - 2, 0, 2, SCENE_PB, C.red);
  }

  if (g.phase !== 'title') hud();
  if (g.bannerT > 0 && g.phase === 'play') banner(g.banner, PW / 2, 32, C.yellow);

  if (g.phase === 'title') {
    dim();
    R(0, 0, PW, 20, C.black);
    R(0, SCENE_PB, PW, PH - SCENE_PB, C.black);
    txt('BADGE', PW / 2, 22, C.yellow, 4);
    txt('BUSTERS', PW / 2, 44, C.pink, 3);
    txt('HE: LOOSE CANNON.', PW / 2, 68, C.white);
    txt('SHE: BY THE BOOK.', PW / 2, 75, C.white);
    txt('YOU: A FINGER.', PW / 2, 82, C.lime);
    txt('TAP THE CROOKS.', PW / 2, 96, C.white);
    txt('SPARE CIVILIANS.', PW / 2, 103, C.white);
    txt('GRAB DONUTS.', PW / 2, 110, C.white);
    if (Math.floor(g.t * 2.5) % 2) txt('TAP TO START', PW / 2, 122, C.yellow, 1);
    if (g.best > 0) txt(`BEST ${g.best}`, PW / 2, 142, C.peach, 1, 1, null);
  } else if (g.phase === 'card') {
    dim();
    panel(4, 34, PW - 8, 82);
    txt(`STAGE ${g.stage + 1}`, PW / 2, 40, C.yellow, 1, 1, null);
    fit(g.stageName, PW / 2, 51, C.white, 2, 78);
    wrapPx(g.def.blurb, PW / 2, 70, 19, C.lgray);
    if (g.cardT > 0.5 && Math.floor(g.t * 2.5) % 2) txt('TAP TO BEGIN', PW / 2, 104, C.white, 1, 1, null);
  } else if (g.phase === 'clear') {
    dim();
    panel(8, 40, PW - 16, 70);
    fit('CASE CLOSED!', PW / 2, 47, C.lime, 2, 70);
    fit(`${g.def.boss} BUSTED!`, PW / 2, 64, C.white, 1, 74);
    txt(`BONUS +${g.clearBonus}`, PW / 2, 76, C.yellow, 1, 1, null);
    txt(`${g.lives} BADGES LEFT`, PW / 2, 84, C.lav, 1, 1, null);
    if (g.cardT > 1.2 && Math.floor(g.t * 2.5) % 2) txt('TAP FOR NEXT CASE', PW / 2, 98, C.white, 1, 1, null);
  } else if (g.phase === 'over') {
    dim();
    txt('YOU ARE', PW / 2, 28, C.pink, 2);
    fit('SUSPENDED', PW / 2, 42, C.red, 3, 84, C.black);
    panel(5, 64, PW - 10, 50);
    txt('SCORE', 24, 68, C.lav, 1, 1, null);
    txt('BEST', 66, 68, C.lav, 1, 1, null);
    fit(String(g.score), 24, 77, C.white, 2, 36);
    fit(String(g.best), 66, 77, C.yellow, 2, 36);
    fit(`BUSTED ${g.kills}`, PW / 2, 90, C.white, 1, 76);
    fit(`STAGE ${g.stage + 1}`, PW / 2, 97, C.white, 1, 76);
    if (g.newBest) txt('NEW BEST!', PW / 2, 105, C.lime, 1, 1, null);
    if (g.deadFor > 0.8 && Math.floor(g.t * 2.5) % 2) txt('TAP TO GO AGAIN', PW / 2, 122, C.yellow, 1);
  }

  // blit, crisp
  out.imageSmoothingEnabled = false;
  out.drawImage(px, 0, 0, PW * k, PH * k);
  if (crt) {
    out.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < PH; y++) out.fillRect(0, y * k + Math.ceil(k * 0.6), PW * k, Math.max(1, Math.floor(k * 0.4)));
  }
}

// ---- input (logical 180x320 coordinates) ----

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
    const px2 = x / 2;
    const py2 = y / 2;
    if (px2 >= RELOAD.x && px2 <= RELOAD.x + RELOAD.w && py2 >= RELOAD.y && py2 <= RELOAD.y + RELOAD.h) game.reload();
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
el('crt').addEventListener('pointerdown', (e) => e.stopPropagation());
el('crt').addEventListener('click', () => {
  crt = !crt;
  try {
    localStorage.setItem('cop8-crt', crt ? '1' : '0');
  } catch {
    /* ignore */
  }
  renderBar();
});

function renderBar() {
  el('best').textContent = String(game.best);
  el('mute').textContent = sound.muted ? '🔇' : '🔊';
  el('crt').style.opacity = crt ? '1' : '0.5';
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
