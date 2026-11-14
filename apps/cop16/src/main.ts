import './style.css';
import { COLS, CopGame, H, MAG, ROW_Y, SCENE_BOTTOM, W, isEnemy } from './game/engine';
import type { Kind, Target } from './game/engine';
import { Sound } from './sound';

// ---- 16-bit renderer ----
// The game is drawn on a 180x320 canvas (1 art pixel = 1 game unit) with hand-shaded pixel art,
// then scaled by a whole number with smoothing off, so every pixel stays sharp.

const PW = W;
const PH = H;

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
const mainCtx = px.getContext('2d')!;
let ctx: CanvasRenderingContext2D = mainCtx; // current drawing target (swapped while building sprites)
const el = (id: string) => document.querySelector<HTMLElement>(`#${id}`)!;

let crt = false;
try {
  crt = localStorage.getItem('cop16-crt') === '1';
} catch {
  /* ignore */
}

let k = 1;
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

// ---- palette ramps: [shadow, base, light, highlight] ----

type Ramp = [string, string, string, string];
const INK = '#120d1f';
const WHITE = '#fff8f0';
const SK: Ramp = ['#b8704f', '#e0966c', '#f6bd91', '#ffe0bf'];
const CREAM: Ramp = ['#a9a6c0', '#d8d6e6', '#f4f2ff', '#ffffff'];
const NAVY: Ramp = ['#0e1736', '#1d2b53', '#2f4a8a', '#4f74c0'];
const RED: Ramp = ['#7a0f2e', '#c3153f', '#ff3a5c', '#ff8aa0'];
const BROWN: Ramp = ['#4a2616', '#7a4024', '#a8643a', '#d99a62'];
const TAN: Ramp = ['#7a4a2a', '#a86c3c', '#d09a58', '#f0c887'];
const GREEN: Ramp = ['#04502e', '#0a8a48', '#22c466', '#7af0a0'];
const PURPLE: Ramp = ['#3a1a5a', '#6a3a9a', '#9a68c8', '#c8a0f0'];
const PINK: Ramp = ['#a02a62', '#e0508a', '#ff7ab0', '#ffc0d8'];
const YEL: Ramp = ['#a07010', '#e8b020', '#ffd840', '#fff090'];
const BLUE: Ramp = ['#0a3a7a', '#1a78c8', '#40b0ff', '#b0e4ff'];
const GRAY: Ramp = ['#2a2a38', '#4a4a5e', '#7a7a92', '#b0b0c8'];
const ORANGE: Ramp = ['#a04010', '#e07020', '#ff9a38', '#ffd080'];
const TEAL: Ramp = ['#0a5a5a', '#14a0a0', '#34d8c8', '#a0f4e8'];
const BLACK: Ramp = ['#05040a', '#14121e', '#2a2838', '#4a4860'];

// ---- pixel helpers (draw on the current context) ----

function R(x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function P(x: number, y: number, c: string) {
  R(x, y, 1, 1, c);
}
function D(cx: number, cy: number, r: number, c: string) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.round(r);
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y) + 0.5);
    ctx.fillRect(cx - w, cy + y, 2 * w + 1, 1);
  }
}
function E(cx: number, cy: number, rx: number, ry: number, c: string) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)) + 0.5);
    ctx.fillRect(cx - w, cy + y, 2 * w + 1, 1);
  }
}
/** Shaded rectangle, light from the top-left. */
function RS(x: number, y: number, w: number, h: number, r: Ramp) {
  const bh = Math.max(1, Math.round(h / 4));
  const bw = Math.max(1, Math.round(w / 5));
  R(x, y, w, h, r[1]);
  R(x, y + h - bh, w, bh, r[0]);
  R(x + w - bw, y, bw, h, r[0]);
  R(x, y, w, 1, r[2]);
  R(x, y, 1, h, r[2]);
  P(x + 1, y + 1, r[3]);
}
/** Shaded disc. */
function DS(cx: number, cy: number, rad: number, r: Ramp) {
  D(cx, cy, rad, r[0]);
  D(cx - Math.max(1, rad * 0.12), cy - Math.max(1, rad * 0.12), Math.max(1, rad - 1), r[1]);
  D(cx - rad * 0.3, cy - rad * 0.3, Math.max(1, Math.round(rad * 0.55)), r[2]);
  if (rad >= 5) D(cx - rad * 0.4, cy - rad * 0.4, Math.max(1, Math.round(rad * 0.22)), r[3]);
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
  ctx.fillStyle = c;
  for (;;) {
    ctx.fillRect(x0, y0, t, t);
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
function dither(x: number, y: number, w: number, h: number, c: string, phase = 0) {
  ctx.fillStyle = c;
  for (let j = 0; j < h; j++) for (let i = (j + phase) % 2; i < w; i += 2) ctx.fillRect(x + i, y + j, 1, 1);
}
function mkCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
/** Run `fn` with all helpers drawing on `c`. */
function on(c: HTMLCanvasElement, fn: () => void) {
  const prev = ctx;
  ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  fn();
  ctx = prev;
}
/** Render art into a canvas and add a 1px dark outline (and an optional all-white version). */
function outlined(w: number, h: number, fn: () => void, white = false) {
  const spr = mkCanvas(w, h);
  on(spr, fn);
  const sil = mkCanvas(w, h);
  const s = sil.getContext('2d')!;
  s.drawImage(spr, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = INK;
  s.fillRect(0, 0, w, h);
  const res = mkCanvas(w, h);
  const r = res.getContext('2d')!;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) r.drawImage(sil, dx, dy);
  r.drawImage(spr, 0, 0);
  if (white) {
    r.globalCompositeOperation = 'source-atop';
    r.fillStyle = '#ffffff';
    r.fillRect(0, 0, w, h);
  }
  return res;
}

// ---- 5x7 bitmap font ----

const F: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.####/#..../#..../#..../#..../#..../.####', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.####/#..../#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '#####/..#../..#../..#../..#../..#../#####', J: '....#/....#/....#/....#/....#/#...#/.###.',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
  0: '.###./#...#/#...#/#...#/#...#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '####./....#/....#/.###./....#/....#/####.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/....#/.###.',
  '!': '..#../..#../..#../..#../..#../...../..#..', '.': '...../...../...../...../...../...../..#..',
  ',': '...../...../...../...../...../..#../.#...', "'": '..#../..#../.#.../...../...../...../.....',
  ':': '...../..#../...../...../..#../...../.....', '-': '...../...../...../.###./...../...../.....',
  '+': '...../..#../..#../#####/..#../..#../.....', '?': '.###./#...#/....#/...#./..#../...../..#..',
  '/': '....#/....#/...#./..#../.#.../#..../#....', ' ': '...../...../...../...../...../...../.....',
};
const GLYPH: Record<string, boolean[]> = {};
for (const [ch, rows] of Object.entries(F)) GLYPH[ch] = rows.replace(/\//g, '').split('').map((c) => c === '#');

function tw(s: string, sc = 1) {
  return s.length * 6 * sc - sc;
}
function glyphs(s: string, x: number, y: number, sc: number, c: string) {
  ctx.fillStyle = c;
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPH[ch] ?? GLYPH['?'];
    for (let i = 0; i < 35; i++) if (g[i]) ctx.fillRect(cx + (i % 5) * sc, y + Math.floor(i / 5) * sc, sc, sc);
    cx += 6 * sc;
  }
}
/** align: 0 left, 1 centre, 2 right. y is the top of the glyphs. */
function txt(s: string, x: number, y: number, c: string, sc = 1, align = 1, outline: string | null = INK) {
  const w = tw(s, sc);
  const x0 = Math.round(align === 1 ? x - w / 2 : align === 2 ? x - w : x);
  const y0 = Math.round(y);
  if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) glyphs(s, x0 + dx, y0 + dy, sc, outline);
  glyphs(s, x0, y0, sc, c);
}
function fit(s: string, x: number, y: number, c: string, maxSc: number, maxW: number, outline: string | null = INK) {
  let sc = maxSc;
  while (sc > 1 && tw(s, sc) > maxW) sc--;
  txt(s, x, y, c, sc, 1, outline);
}
function banner(s: string, x: number, y: number, c: string) {
  if (s.length <= 28) return txt(s, x, y, c, 1);
  const mid = s.length / 2;
  let cut = s.indexOf(' ');
  for (let i = 0; i < s.length; i++) if (s[i] === ' ' && Math.abs(i - mid) < Math.abs(cut - mid)) cut = i;
  txt(s.slice(0, cut), x, y - 6, c, 1);
  txt(s.slice(cut + 1), x, y + 6, c, 1);
}
function wrapText(s: string, x: number, y: number, maxChars: number, c: string) {
  const words = s.split(' ');
  const lines: string[] = [];
  let l = '';
  for (const w of words) {
    const t = l ? `${l} ${w}` : w;
    if (t.length > maxChars && l) {
      lines.push(l);
      l = w;
    } else l = t;
  }
  lines.push(l);
  lines.forEach((ln, i) => txt(ln, x, y + i * 11, c, 1, 1, INK));
}

// ---- themes ----

interface Theme {
  sky: string[]; // bands, top to bottom
  wall: Ramp;
  mortar: string;
  neon: string;
  neonDim: string;
  frame: Ramp;
  inside: [string, string];
  asphalt: [string, string];
  curb: string;
  top: 'window' | 'container' | 'door';
  row1: 'dumpster' | 'crate' | 'speaker';
  row2: 'car' | 'barrel' | 'couch';
  label: string;
  moon: boolean;
}
const THEMES: Theme[] = [
  { sky: ['#0b0a2a', '#16124a', '#2a1a62', '#4a2272', '#7a2a7a', '#b0407a'], wall: ['#4a1f2e', '#7a3a3a', '#a8553a', '#c87a4e'], mortar: '#3a1626', neon: '#ff5ab0', neonDim: '#a02a70', frame: PINK, inside: ['#1a1440', '#2e2060'], asphalt: ['#3a3a52', '#2a2a40'], curb: '#8a86a8', top: 'window', row1: 'dumpster', row2: 'car', label: 'DONUTS', moon: true },
  { sky: ['#1a1450', '#3a2a7a', '#7a3a8a', '#c0507a', '#f08a5a', '#ffc070'], wall: ['#2a3440', '#46586a', '#667c90', '#8aa0b4'], mortar: '#1c242e', neon: '#ffd840', neonDim: '#a07010', frame: ORANGE, inside: ['#10182a', '#1e2c48'], asphalt: ['#5a5a6a', '#464656'], curb: '#a8a4b8', top: 'container', row1: 'crate', row2: 'barrel', label: 'PORT', moon: false },
  { sky: ['#05030f', '#0e0a28', '#1e1048', '#3a1468', '#6a1a80', '#a02a88'], wall: ['#2e1448', '#4a2470', '#6a3a98', '#8a58b8'], mortar: '#1e0a30', neon: '#40e0ff', neonDim: '#1078a8', frame: BLUE, inside: ['#2a1050', '#5a2088'], asphalt: ['#241a3c', '#18102c'], curb: '#7a68a8', top: 'door', row1: 'speaker', row2: 'couch', label: 'DISCO', moon: true },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---- static scene layers (pre-rendered once per theme) ----

interface Layers {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement[]; // per row: window frames / cover objects, transparent
}
const layerCache: (Layers | null)[] = [null, null, null];

function buildBack(th: Theme, idx: number) {
  const c = mkCanvas(PW, PH);
  on(c, () => {
    const rnd = rng(1000 + idx);
    // sky bands with dithered seams
    const bandH = 44 / th.sky.length;
    th.sky.forEach((col, i) => {
      R(0, i * bandH, PW, Math.ceil(bandH) + 1, col);
      if (i > 0) dither(0, Math.round(i * bandH) - 2, PW, 4, col, 0);
    });
    for (let i = 0; i < 40; i++) {
      const sy = Math.floor(rnd() * 30);
      P(Math.floor(rnd() * PW), sy, rnd() > 0.6 ? WHITE : '#9a9ad0');
    }
    // moon or low sun
    if (th.moon) {
      const mx = idx === 0 ? 142 : 36;
      D(mx, 18, 11, '#e8e6ff');
      D(mx + 3, 16, 10, th.sky[2]);
      D(mx, 18, 10, '#f4f2ff');
      D(mx - 4, 14, 2, '#cfcdf0');
      D(mx + 3, 22, 2, '#cfcdf0');
    } else {
      D(130, 46, 14, '#ffd880');
      D(130, 46, 11, '#fff0b0');
    }
    // far skyline
    const far = idx === 1 ? '#3a2060' : '#150f35';
    for (let x = 0; x < PW; x += 11) {
      const bh = 10 + Math.floor(rnd() * 22);
      R(x, 44 - bh, 11, bh, far);
      for (let wy = 44 - bh + 3; wy < 42; wy += 4) for (let wx = x + 2; wx < x + 9; wx += 4) if (rnd() > 0.55) P(wx, wy, rnd() > 0.5 ? '#ffd85a' : '#ff9ac0');
    }
    // roof ledge with neon strip + glow
    R(0, 44, PW, 3, th.wall[0]);
    R(0, 47, PW, 2, th.neon);
    dither(0, 49, PW, 3, th.neonDim, 0);
    // facade bricks
    for (let y = 49, row = 0; y < 180; y += 6, row++) {
      const off = row % 2 ? 0 : 6;
      for (let x = -off; x < PW; x += 12) {
        const r = rnd();
        const col = r < 0.12 ? th.wall[0] : r < 0.5 ? th.wall[1] : r < 0.85 ? th.wall[2] : th.wall[3];
        R(x + 1, y + 1, 11, 5, col);
        R(x + 1, y + 1, 11, 1, th.wall[3]);
      }
      R(0, y, PW, 1, th.mortar);
    }
    for (let y = 49; y < 100; y += 2) dither(0, y, PW, 1, '#00000040', (y / 2) % 2);
    // wall lamps with light cones
    for (const lx of [61, 119]) {
      D(lx, 84, 9, th.neonDim);
      dither(lx - 14, 70, 28, 28, th.neonDim, 0);
      RS(lx - 3, 78, 6, 6, GRAY);
      R(lx - 2, 82, 4, 3, '#fff6b0');
      R(lx - 1, 84, 2, 1, WHITE);
    }
    // drain pipes
    for (const dx of [3, 176]) {
      RS(dx - 2, 50, 4, 132, GRAY);
      for (let y = 66; y < 180; y += 30) R(dx - 3, y, 6, 2, GRAY[3]);
    }
    // window interiors
    for (const cx of COLS) {
      const x = cx - 20;
      R(x, 54, 40, 46, th.inside[0]);
      for (let y = 54; y < 100; y += 2) R(x, y, 40, 1, th.inside[1]);
      for (let sx = x + 3; sx < x + 40; sx += 8) dither(sx, 54, 3, 46, th.inside[1], 0);
      R(x + 2, 76, 14, 2, BROWN[1]);
      R(x + 4, 70, 3, 6, RED[1]);
      R(x + 8, 72, 3, 4, TEAL[1]);
      D(x + 32, 64, 5, '#ffd85a');
      dither(x + 24, 56, 16, 18, '#ffd85a', 0);
      dither(x, 54, 40, 5, '#000000', 0);
    }
    // street: curb/sidewalk then asphalt
    R(0, 180, PW, 10, th.curb);
    for (let x = 0; x < PW; x += 14) R(x, 180, 1, 10, '#00000030');
    R(0, 189, PW, 2, '#00000050');
    R(0, 190, PW, SCENE_BOTTOM - 190, th.asphalt[0]);
    for (let y = 190; y < SCENE_BOTTOM; y += 4) R(0, y, PW, 1, th.asphalt[1]);
    for (let i = 0; i < 160; i++) P(Math.floor(rnd() * PW), 192 + Math.floor(rnd() * 68), rnd() > 0.5 ? th.asphalt[1] : th.curb);
    for (let x = 6; x < PW; x += 30) {
      R(x, 214, 16, 2, '#f0c850');
      R(x, 216, 16, 1, '#a08020');
    }
    E(46, 248, 8, 3, '#00000050');
    E(46, 247, 7, 2, GRAY[1]);
    E(132, 236, 18, 4, th.asphalt[1]);
    E(132, 236, 16, 3, th.neonDim);
    dither(114, 234, 36, 4, th.neon, 0);
    dither(0, SCENE_BOTTOM - 8, PW, 8, '#000000', 0);
  });
  return c;
}

function coverSprite(kind: Theme['row1'] | Theme['row2'], th: Theme) {
  // sprite local origin: top-left of the cover body is (6, 12)
  return outlined(64, 48, () => {
    const x = 6;
    const y = 12;
    switch (kind) {
      case 'dumpster':
        RS(x, y, 52, 28, GREEN);
        for (let rx = x + 6; rx < x + 50; rx += 10) R(rx, y + 5, 2, 20, GREEN[0]);
        RS(x - 2, y - 4, 56, 7, GREEN);
        R(x - 2, y - 4, 56, 1, GREEN[3]);
        R(x + 6, y + 24, 7, 4, BLACK[1]);
        R(x + 39, y + 24, 7, 4, BLACK[1]);
        R(x + 18, y + 8, 16, 8, GREEN[0]);
        break;
      case 'car':
        RS(x - 2, y + 8, 56, 20, RED);
        RS(x + 8, y - 3, 36, 14, RED);
        R(x + 11, y, 13, 9, BLUE[2]);
        R(x + 27, y, 13, 9, BLUE[2]);
        line(x + 12, y + 8, x + 17, y + 1, BLUE[3]);
        line(x + 28, y + 8, x + 33, y + 1, BLUE[3]);
        R(x - 2, y + 14, 5, 5, YEL[2]);
        R(x - 1, y + 15, 2, 2, YEL[3]);
        R(x + 49, y + 14, 4, 5, RED[2]);
        R(x - 2, y + 24, 56, 3, GRAY[1]);
        D(x + 10, y + 28, 6, BLACK[0]);
        D(x + 42, y + 28, 6, BLACK[0]);
        D(x + 10, y + 28, 3, GRAY[2]);
        D(x + 42, y + 28, 3, GRAY[2]);
        break;
      case 'crate':
        RS(x, y, 52, 28, ORANGE);
        R(x, y + 13, 52, 2, ORANGE[0]);
        for (const cx of [x + 2, x + 48]) for (const cy of [y + 2, y + 24]) P(cx, cy, GRAY[3]);
        RS(x, y, 4, 28, BROWN);
        RS(x + 48, y, 4, 28, BROWN);
        line(x + 4, y + 2, x + 47, y + 26, BROWN[1], 2);
        line(x + 47, y + 2, x + 4, y + 26, BROWN[1], 2);
        break;
      case 'barrel':
        for (const bx of [x, x + 18, x + 36]) {
          RS(bx, y - 2, 16, 32, RED);
          R(bx, y + 3, 16, 2, GRAY[1]);
          R(bx, y + 22, 16, 2, GRAY[1]);
          R(bx + 1, y - 2, 14, 2, RED[3]);
        }
        break;
      case 'speaker':
        RS(x + 2, y - 2, 48, 30, BLACK);
        R(x + 2, y - 2, 48, 2, GRAY[2]);
        for (const sx of [x + 15, x + 37]) {
          DS(sx, y + 12, 9, GRAY);
          D(sx, y + 12, 5, BLACK[0]);
          DS(sx, y + 12, 3, BLUE);
        }
        R(x + 22, y + 24, 8, 2, th.neon);
        break;
      case 'couch':
        RS(x - 2, y + 6, 56, 22, PINK);
        RS(x + 2, y - 4, 48, 14, PURPLE);
        RS(x - 5, y + 8, 10, 20, PURPLE);
        RS(x + 47, y + 8, 10, 20, PURPLE);
        R(x + 26, y + 12, 1, 14, PINK[0]);
        R(x + 4, y + 22, 44, 2, PINK[0]);
        break;
    }
  });
}

function frontLayer(th: Theme, row: number) {
  const c = mkCanvas(PW, PH);
  on(c, () => {
    if (row === 0) {
      for (const cx of COLS) {
        const x = cx - 20;
        RS(x - 5, 49, 50, 5, th.frame);
        RS(x - 5, 54, 5, 46, th.frame);
        RS(x + 40, 54, 5, 46, th.frame);
        RS(x - 7, 100, 54, 6, th.frame);
        R(x - 7, 106, 54, 2, '#00000060');
        if (th.top === 'container') for (let rx = x - 3; rx < x + 43; rx += 5) R(rx, 40, 2, 9, th.frame[0]);
        if (th.top === 'door') R(x - 5, 49, 50, 2, th.neon);
        for (let i = 0; i < 3; i++) line(x + 6 + i * 9, 54, x + 22 + i * 9, 74, '#ffffff22', 2);
      }
    } else {
      const spr = coverSprite(row === 1 ? th.row1 : th.row2, th);
      for (const cx of COLS) ctx.drawImage(spr, cx - 32, ROW_Y[row] - 12);
    }
  });
  return c;
}

function layers(idx: number) {
  let l = layerCache[idx];
  if (!l) {
    const th = THEMES[idx];
    l = { back: buildBack(th, idx), front: [frontLayer(th, 0), frontLayer(th, 1), frontLayer(th, 2)] };
    layerCache[idx] = l;
  }
  return l;
}

// ---- characters ----

const SW = 80;
const SH = 76;
const OX = 34; // feet origin inside the sprite canvas
const OY = 62;

function eyes(angry: boolean, y = -30) {
  R(-6, y, 5, 4, WHITE);
  R(2, y, 5, 4, WHITE);
  R(-4, y + 1, 2, 3, INK);
  R(4, y + 1, 2, 3, INK);
  if (angry) {
    line(-7, y - 3, -2, y - 1, INK, 2);
    line(8, y - 3, 3, y - 1, INK, 2);
  } else {
    R(-6, y - 2, 5, 1, INK);
    R(2, y - 2, 5, 1, INK);
  }
}
function smile() {
  R(-3, -23, 7, 1, INK);
  P(-4, -24, INK);
  P(4, -24, INK);
  R(-2, -22, 5, 1, RED[1]);
}
function torso(r: Ramp) {
  RS(-10, -22, 20, 22, r);
  RS(-8, -23, 16, 4, r);
}
function pistol(gold = false) {
  const m: Ramp = gold ? YEL : GRAY;
  RS(18, -26, 17, 6, m);
  R(33, -27, 3, 2, INK);
  RS(19, -21, 6, 10, BROWN);
  R(18, -21, 2, 5, INK);
}
function armsUp(r: Ramp, wave: number) {
  RS(-17, -36 + wave, 5, 16, r);
  D(-15, -37 + wave, 3, SK[1]);
  RS(12, -36 - wave, 5, 16, r);
  D(14, -37 - wave, 3, SK[1]);
}

function person(kind: Kind, wave: number) {
  ctx.save();
  ctx.translate(OX, OY);
  switch (kind) {
    case 'thug': {
      RS(-10, -22, 20, 22, CREAM);
      for (let y = -22; y < 0; y += 5) R(-10, y + 2, 20, 2, BLACK[1]);
      R(7, -22, 3, 22, '#00000030');
      RS(-14, -20, 5, 14, CREAM);
      for (let y = -20; y < -6; y += 5) R(-14, y + 2, 5, 2, BLACK[1]);
      RS(8, -20, 12, 5, CREAM);
      for (let x = 10; x < 20; x += 4) R(x, -20, 2, 5, BLACK[1]);
      D(21, -17, 3, SK[1]);
      pistol();
      DS(0, -29, 9, BLACK);
      R(-7, -32, 14, 6, SK[1]);
      R(-7, -32, 14, 1, SK[0]);
      eyes(true, -31);
      R(-3, -23, 6, 3, SK[1]);
      R(-2, -22, 4, 1, RED[0]);
      RS(-9, -38, 18, 5, RED);
      for (let x = -8; x < 9; x += 3) R(x, -37, 1, 3, RED[0]);
      D(0, -41, 2, RED[2]);
      break;
    }
    case 'sharp': {
      torso(TAN);
      R(-3, -22, 6, 9, CREAM[2]);
      R(-1, -21, 2, 10, RED[1]);
      line(-3, -22, -6, -12, TAN[0], 2);
      line(3, -22, 6, -12, TAN[0], 2);
      RS(-14, -20, 5, 14, TAN);
      RS(8, -20, 12, 5, TAN);
      D(21, -17, 3, SK[1]);
      pistol();
      DS(0, -29, 8, SK);
      R(-7, -31, 14, 4, BLACK[1]);
      R(-6, -30, 4, 1, BLUE[3]);
      R(-1, -31, 2, 1, BLACK[3]);
      R(-3, -23, 6, 1, INK);
      E(0, -35, 13, 3, GRAY[0]);
      E(0, -36, 12, 2, GRAY[1]);
      RS(-8, -45, 16, 10, GRAY);
      R(-8, -38, 16, 3, RED[1]);
      R(-8, -38, 16, 1, RED[2]);
      break;
    }
    case 'boss': {
      ctx.scale(1.15, 1.15);
      RS(-12, -22, 24, 22, CREAM);
      R(-3, -22, 6, 22, WHITE);
      line(-12, -22, -4, -8, GRAY[2], 2);
      line(12, -22, 4, -8, GRAY[2], 2);
      RS(-1, -22, 3, 14, PINK);
      R(-8, -17, 16, 1, YEL[1]);
      D(0, -14, 2, YEL[2]);
      RS(-16, -20, 6, 14, CREAM);
      RS(8, -20, 12, 6, CREAM);
      D(22, -17, 3, SK[1]);
      pistol(true);
      DS(0, -29, 9, SK);
      eyes(true, -31);
      R(-7, -25, 14, 3, BROWN[1]);
      R(-7, -25, 14, 1, BROWN[2]);
      R(3, -22, 11, 3, BROWN[1]);
      R(14, -22, 3, 3, ORANGE[2]);
      P(16, -22, YEL[3]);
      RS(-9, -46, 18, 9, BLACK);
      E(0, -37, 13, 2, BLACK[1]);
      R(-9, -40, 18, 2, RED[1]);
      break;
    }
    case 'tourist': {
      torso(TEAL);
      for (const [dx, dy, c] of [[-6, -17, PINK[2]], [2, -12, YEL[2]], [-3, -6, PINK[2]], [6, -19, YEL[2]], [-8, -9, YEL[2]]] as const) {
        R(dx, dy, 3, 3, c);
        P(dx + 1, dy + 1, WHITE);
      }
      armsUp(TEAL, wave);
      RS(-26, -25, 12, 9, BLACK);
      DS(-20, -20, 3, BLUE);
      R(-24, -27, 4, 2, GRAY[2]);
      DS(0, -29, 8, SK);
      eyes(false, -30);
      smile();
      E(0, -35, 14, 3, YEL[0]);
      E(0, -36, 13, 2, YEL[1]);
      RS(-8, -44, 16, 9, YEL);
      R(-8, -38, 16, 2, RED[1]);
      break;
    }
    case 'mayor': {
      torso(NAVY);
      R(-3, -22, 6, 8, CREAM[2]);
      R(-1, -21, 2, 8, RED[1]);
      line(-10, -21, 10, -3, RED[1], 4);
      line(-10, -21, 10, -3, RED[2], 1);
      D(-6, -17, 2, YEL[2]);
      armsUp(NAVY, wave);
      DS(0, -29, 8, SK);
      eyes(false, -30);
      R(-4, -25, 9, 2, GRAY[2]);
      smile();
      RS(-8, -38, 16, 6, GRAY);
      R(-9, -34, 3, 5, GRAY[2]);
      R(6, -34, 3, 5, GRAY[2]);
      break;
    }
    case 'granny': {
      torso(PURPLE);
      for (const [dx, dy] of [[-6, -17], [3, -12], [-3, -6], [6, -19]] as const) {
        R(dx, dy, 3, 3, PINK[2]);
        P(dx + 1, dy + 1, YEL[3]);
      }
      armsUp(PURPLE, wave);
      RS(10, -11, 12, 9, RED);
      R(12, -15, 8, 1, RED[0]);
      R(12, -14, 1, 3, RED[0]);
      R(19, -14, 1, 3, RED[0]);
      DS(0, -29, 8, SK);
      R(-5, -31, 4, 4, GRAY[3]);
      R(1, -31, 4, 4, GRAY[3]);
      R(-4, -30, 2, 2, WHITE);
      R(2, -30, 2, 2, WHITE);
      P(-3, -29, INK);
      P(3, -29, INK);
      R(-1, -30, 2, 1, GRAY[3]);
      smile();
      DS(0, -37, 8, CREAM);
      DS(0, -45, 4, CREAM);
      R(-8, -33, 3, 6, CREAM[1]);
      R(5, -33, 3, 6, CREAM[1]);
      break;
    }
    case 'donut':
      break;
  }
  ctx.restore();
}

const spriteCache = new Map<string, HTMLCanvasElement>();
function personSprite(kind: Kind, wave: number, white: boolean) {
  const key = `${kind}|${wave}|${white ? 1 : 0}`;
  let s = spriteCache.get(key);
  if (!s) {
    s = outlined(SW, SH, () => person(kind, wave), white);
    spriteCache.set(key, s);
  }
  return s;
}
function donutSprite(white: boolean) {
  const key = `donut|${white ? 1 : 0}`;
  let s = spriteCache.get(key);
  if (!s) {
    s = outlined(40, 40, () => {
      DS(20, 20, 15, ORANGE);
      DS(19, 18, 13, PINK);
      D(20, 20, 5, ORANGE[1]);
      D(20, 20, 4, INK);
      for (const [dx, dy, c] of [[-8, -5, WHITE], [6, -8, YEL[2]], [8, 3, GREEN[3]], [-6, 7, WHITE], [1, -10, BLUE[3]], [-10, 1, YEL[2]], [4, 9, WHITE]] as const) R(20 + dx, 20 + dy, 3, 1, c);
    }, white);
    spriteCache.set(key, s);
  }
  return s;
}

function drawTarget(t: Target) {
  const r = game.rect(t);
  const row = Math.floor(t.slot / 3);
  if (t.state === 'dead' && Math.floor(t.dieT * 18) % 2) return;
  ctx.save();
  ctx.beginPath();
  if (row === 0) ctx.rect(r.cx - 20, 54, 40, 46);
  else ctx.rect(r.cx - 34, ROW_Y[row] - 70, 68, 70);
  ctx.clip();
  const wave = Math.floor(game.t * 4) % 2;
  const white = t.flash > 0;
  const bob = t.state === 'hold' ? (Math.floor(t.age * 4) % 2 ? 1 : 0) : 0;
  const cx = Math.round(r.cx);
  const fy = Math.round(r.feet) + bob;
  if (t.kind === 'donut') {
    const f = Math.floor(game.t * 4) % 2;
    ctx.drawImage(donutSprite(white), cx - 20, fy - 36 - f);
  } else {
    ctx.drawImage(personSprite(t.kind, wave, white), cx - OX, fy - OY);
  }
  const warn = t.state === 'hold' && t.warned && isEnemy(t.kind);
  if (warn) {
    const big = Math.floor(t.age * 20) % 2;
    const mx = cx + 35 * r.s;
    const my = fy - 21 * r.s;
    D(mx, my, big ? 7 : 5, ORANGE[2]);
    D(mx, my, big ? 4 : 3, YEL[2]);
    D(mx, my, 1, WHITE);
    line(mx - 10, my, mx + 10, my, YEL[3]);
    line(mx, my - 10, mx, my + 10, YEL[3]);
  }
  ctx.restore();
  if (warn) txt('!', cx, r.top - 20, RED[2], 2, 1, INK);
  if (t.maxHp > 1 && t.state !== 'dead') {
    for (let i = 0; i < t.maxHp; i++) {
      R(cx - (t.maxHp * 7) / 2 + i * 7, r.top - 10, 6, 4, i < t.hp ? RED[1] : BLACK[0]);
      if (i < t.hp) R(cx - (t.maxHp * 7) / 2 + i * 7, r.top - 10, 6, 1, RED[3]);
    }
  }
}

// ---- HUD ----

function bevel(x: number, y: number, w: number, h: number, base: string, hi: string, lo: string) {
  R(x, y, w, h, base);
  R(x, y, w, 1, hi);
  R(x, y, 1, h, hi);
  R(x, y + h - 1, w, 1, lo);
  R(x + w - 1, y, 1, h, lo);
}

function badge(cx: number, cy: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 ? 4.5 : 10;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = YEL[1];
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const qx = cx + (x - cx) * 0.82;
    const qy = cy + (y - cy) * 0.82;
    if (i) ctx.lineTo(qx, qy);
    else ctx.moveTo(qx, qy);
  });
  ctx.closePath();
  ctx.fill();
  D(cx, cy, 3, YEL[3]);
  D(cx, cy, 1, ORANGE[1]);
}

const RELOAD = { x: 112, y: 270, w: 62, h: 40 };
let revolver: HTMLCanvasElement | null = null;
function revolverSprite() {
  if (!revolver) {
    revolver = outlined(40, 60, () => {
      RS(16, 2, 8, 30, GRAY);
      R(19, 0, 2, 4, GRAY[3]);
      RS(11, 28, 18, 14, GRAY);
      for (let i = 0; i < 3; i++) D(14 + i * 6, 35, 1, BLACK[0]);
      RS(13, 40, 14, 6, GRAY);
      RS(14, 44, 12, 14, BROWN);
      for (let y = 46; y < 57; y += 3) R(16, y, 8, 1, BROWN[0]);
      R(11, 40, 3, 6, GRAY[0]);
    });
  }
  return revolver;
}

function hud() {
  const g = game;
  const gr = ctx.createLinearGradient(0, 0, 0, 42);
  gr.addColorStop(0, 'rgba(8,6,24,0.92)');
  gr.addColorStop(1, 'rgba(8,6,24,0.35)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, PW, 42);
  const room = PW - 14 - g.lives * 20 - 8;
  let sc = 3;
  while (sc > 1 && tw(String(g.score), sc) > room) sc--;
  txt(String(g.score), 8, 6, WHITE, sc, 0, INK);
  txt(g.stageName, 8, 31, YEL[2], 1, 0, INK);
  if (g.mult > 1) txt(`x${g.mult}`, 100, 31, GREEN[3], 1, 0, INK);
  for (let i = 0; i < g.lives; i++) badge(PW - 14 - i * 19, 14);

  const by = SCENE_BOTTOM;
  R(0, by, PW, PH - by, '#0e0b22');
  for (let y = by; y < PH; y += 2) R(0, y, PW, 1, '#15102e');
  R(0, by, PW, 2, '#4a3a8a');
  R(0, by + 2, PW, 1, '#2a2058');
  for (let i = 0; i < MAG; i++) {
    const have = i < g.ammo && g.reloadT <= 0;
    const x = 8 + i * 11;
    bevel(x, 282, 8, 24, have ? YEL[1] : '#2a2540', have ? YEL[3] : '#3a3458', have ? YEL[0] : '#15102a');
    R(x, 296, 8, 10, have ? ORANGE[1] : '#201a38');
    if (have) R(x + 1, 283, 2, 12, '#ffffff55');
  }
  if (g.reloadT > 0) txt('RELOADING', 10, 270, WHITE, 1, 0, INK);
  const low = g.ammo <= 1 && g.reloadT <= 0;
  const flash = low && Math.floor(g.t * 6) % 2 === 1;
  bevel(RELOAD.x, RELOAD.y, RELOAD.w, RELOAD.h, flash ? RED[1] : '#3a2f8a', flash ? RED[3] : '#8a7ae0', flash ? RED[0] : '#1a1450');
  R(RELOAD.x + 2, RELOAD.y + 2, RELOAD.w - 4, 2, '#ffffff30');
  txt('RELOAD', RELOAD.x + RELOAD.w / 2, RELOAD.y + 16, WHITE, 1, 1, INK);
  // revolver, aimed at the last shot
  const gx = 90;
  const gy = 322;
  const a = Math.max(-1.0, Math.min(1.0, Math.atan2(g.aim.y - gy, g.aim.x - gx) + Math.PI / 2));
  ctx.save();
  ctx.translate(gx, gy - 6 + g.recoil * 5);
  ctx.rotate(a);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(revolverSprite(), -20, -54);
  ctx.restore();
  if (g.recoil > 0.45) {
    D(gx + Math.sin(a) * 52, gy - 6 - Math.cos(a) * 52, 6, ORANGE[2]);
    D(gx + Math.sin(a) * 52, gy - 6 - Math.cos(a) * 52, 3, YEL[3]);
  }
}

function panel(x: number, y: number, w: number, h: number) {
  R(x - 2, y - 2, w + 4, h + 4, INK);
  bevel(x, y, w, h, '#1d2b53', '#6a8ad8', '#0a1030');
  for (let j = 2; j < h - 2; j += 2) R(x + 2, y + j, w - 4, 1, '#223466');
}
function dimScene() {
  ctx.fillStyle = 'rgba(6,4,18,0.72)';
  ctx.fillRect(0, 0, PW, SCENE_BOTTOM);
}

function draw() {
  const g = game;
  ctx = mainCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const L = layers(g.stage % 3);
  ctx.save();
  if (g.shake > 0.1) ctx.translate(Math.round((Math.random() - 0.5) * 6 * g.shake), Math.round((Math.random() - 0.5) * 6 * g.shake));
  ctx.drawImage(L.back, 0, 0);
  for (let row = 0; row < 3; row++) {
    for (const t of g.targets) if (Math.floor(t.slot / 3) === row) drawTarget(t);
    ctx.drawImage(L.front[row], 0, 0);
  }
  for (const s of g.shots) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    if (s.t < 0.09) {
      D(x, y, 7, ORANGE[2]);
      D(x, y, 4, YEL[3]);
      D(x, y, 2, WHITE);
      line(x - 12, y, x + 12, y, YEL[3]);
      line(x, y - 12, x, y + 12, YEL[3]);
    } else if (s.t < 0.7) {
      D(x, y, 2, '#000000');
      P(x - 1, y - 1, GRAY[2]);
      line(x - 5, y - 5, x - 3, y - 3, '#8a8aa0');
      line(x + 5, y - 5, x + 3, y - 3, '#8a8aa0');
    }
  }
  for (const p of g.pops) {
    if (p.life < 0.25 && Math.floor(p.life * 30) % 2) continue;
    const col = p.color === '#ff6a5a' ? RED[2] : p.color === '#ffe08a' ? YEL[2] : p.color === '#7fe0c4' ? GREEN[3] : p.color === '#ff9a8a' ? PINK[2] : WHITE;
    txt(p.text, p.x, p.y - 4, col, p.size >= 12 ? 2 : 1, 1, INK);
  }
  ctx.restore();

  if (g.hurtT > 0) {
    const a = Math.min(1, g.hurtT * 2.2);
    ctx.fillStyle = `rgba(255,20,60,${0.3 * a})`;
    ctx.fillRect(0, 0, PW, SCENE_BOTTOM);
    const vg = ctx.createRadialGradient(PW / 2, 150, 60, PW / 2, 150, 190);
    vg.addColorStop(0, 'rgba(255,0,40,0)');
    vg.addColorStop(1, `rgba(255,0,40,${0.7 * a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, PW, SCENE_BOTTOM);
  }

  if (g.phase !== 'title') hud();
  if (g.bannerT > 0 && g.phase === 'play') banner(g.banner, PW / 2, 66, YEL[2]);

  if (g.phase === 'title') {
    dimScene();
    ctx.fillStyle = 'rgba(6,4,18,0.5)';
    ctx.fillRect(0, 0, PW, SCENE_BOTTOM);
    R(0, SCENE_BOTTOM, PW, PH - SCENE_BOTTOM, '#0e0b22');
    txt('BADGE', PW / 2, 44, YEL[2], 5, 1, INK);
    txt('BUSTERS', PW / 2, 88, PINK[2], 4, 1, INK);
    txt('HE WAS A LOOSE CANNON.', PW / 2, 130, WHITE);
    txt('SHE WAS A BY-THE-BOOK ROOKIE.', PW / 2, 142, WHITE);
    txt('YOU ARE A FINGER.', PW / 2, 154, GREEN[3]);
    txt('TAP THE CROOKS.', PW / 2, 180, WHITE);
    txt('SPARE THE CIVILIANS.', PW / 2, 192, WHITE);
    txt('GRAB THE DONUTS. RELOAD OFTEN.', PW / 2, 204, WHITE);
    if (Math.floor(g.t * 2.5) % 2) txt('TAP TO START', PW / 2, 232, YEL[3], 2, 1, INK);
    if (g.best > 0) txt(`BEST ${g.best}`, PW / 2, 252, SK[2], 1, 1, INK);
  } else if (g.phase === 'card') {
    dimScene();
    panel(10, 60, PW - 20, 150);
    txt(`STAGE ${g.stage + 1}`, PW / 2, 74, YEL[2], 2, 1, INK);
    fit(g.stageName, PW / 2, 100, WHITE, 3, PW - 40);
    R(24, 126, PW - 48, 1, '#6a8ad8');
    wrapText(g.def.blurb, PW / 2, 138, 25, CREAM[1]);
    if (g.cardT > 0.5 && Math.floor(g.t * 2.5) % 2) txt('TAP TO BEGIN', PW / 2, 190, YEL[3], 1, 1, INK);
  } else if (g.phase === 'clear') {
    dimScene();
    panel(10, 56, PW - 20, 158);
    fit('CASE CLOSED!', PW / 2, 72, GREEN[3], 3, PW - 40);
    fit(`${g.def.boss} IS IN CUFFS`, PW / 2, 108, WHITE, 1, PW - 40);
    txt(`BONUS +${g.clearBonus}`, PW / 2, 134, YEL[2], 2, 1, INK);
    txt(`${g.lives} BADGES LEFT`, PW / 2, 160, CREAM[1], 1, 1, INK);
    if (g.cardT > 1.2 && Math.floor(g.t * 2.5) % 2) txt('TAP FOR THE NEXT CASE', PW / 2, 192, YEL[3], 1, 1, INK);
  } else if (g.phase === 'over') {
    ctx.globalAlpha = Math.min(1, g.deadFor / 0.4);
    dimScene();
    txt('YOU ARE', PW / 2, 56, PINK[2], 3, 1, INK);
    fit('SUSPENDED', PW / 2, 84, RED[2], 4, PW - 16);
    panel(14, 124, PW - 28, 90);
    txt('SCORE', 52, 134, '#9aaae8', 1, 1, null);
    txt('BEST', 128, 134, '#9aaae8', 1, 1, null);
    fit(String(g.score), 52, 148, WHITE, 2, 66, INK);
    fit(String(g.best), 128, 148, YEL[2], 2, 66, INK);
    fit(`BUSTED ${g.kills}`, PW / 2, 174, CREAM[1], 1, 130, null);
    fit(`STAGE ${g.stage + 1}`, PW / 2, 186, CREAM[1], 1, 130, null);
    if (g.newBest) txt('NEW BEST!', PW / 2, 200, GREEN[3], 1, 1, INK);
    if (g.deadFor > 0.8 && Math.floor(g.t * 2.5) % 2) txt('TAP TO GO AGAIN', PW / 2, 236, YEL[3], 1, 1, INK);
    ctx.globalAlpha = 1;
  }

  out.imageSmoothingEnabled = false;
  out.drawImage(px, 0, 0, PW * k, PH * k);
  if (crt) {
    out.fillStyle = 'rgba(0,0,0,0.20)';
    for (let y = 0; y < PH; y++) out.fillRect(0, y * k + Math.ceil(k * 0.6), PW * k, Math.max(1, Math.floor(k * 0.4)));
  }
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
el('crt').addEventListener('pointerdown', (e) => e.stopPropagation());
el('crt').addEventListener('click', () => {
  crt = !crt;
  try {
    localStorage.setItem('cop16-crt', crt ? '1' : '0');
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
