import './style.css';
import { DashGame, GY, H, PX, W } from './game/engine';
import type { Obs } from './game/engine';
import { Sound } from './sound';

const app = document.querySelector<HTMLDivElement>('#app')!;
const game = new DashGame();
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

type RGB = [number, number, number];
interface Pal {
  top: RGB;
  mid: RGB;
  bot: RGB;
  far: RGB;
  near: RGB;
  sand: RGB;
  sandTop: RGB;
}
const PALS: Pal[] = [
  { top: [43, 74, 138], mid: [232, 130, 106], bot: [255, 207, 138], far: [138, 90, 138], near: [90, 58, 110], sand: [217, 168, 98], sandTop: [236, 196, 128] }, // dusk
  { top: [74, 168, 232], mid: [138, 208, 240], bot: [255, 240, 200], far: [200, 148, 106], near: [168, 104, 63], sand: [232, 190, 120], sandTop: [246, 214, 150] }, // noon
  { top: [14, 18, 54], mid: [42, 42, 106], bot: [106, 90, 154], far: [58, 58, 122], near: [37, 37, 86], sand: [120, 100, 130], sandTop: [150, 130, 160] }, // night
];
const mix = (a: RGB, b: RGB, f: number): RGB => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

function palette(): { p: Record<keyof Pal, RGB>; night: number } {
  const cyc = (game.dist / 3500) % 3;
  const i = Math.floor(cyc);
  const f = cyc - i;
  const a = PALS[i];
  const b = PALS[(i + 1) % 3];
  const out = {} as Record<keyof Pal, RGB>;
  for (const k of Object.keys(a) as (keyof Pal)[]) out[k] = mix(a[k], b[k], f);
  const wn = (idx: number) => (i === idx ? 1 - f : (i + 1) % 3 === idx ? f : 0);
  return { p: out, night: wn(2) };
}

function wrap(v: number, span: number) {
  return ((v % span) + span) % span;
}

const STARS = Array.from({ length: 26 }, (_, i) => ({ x: (i * 67) % W, y: (i * 41) % 150, r: i % 3 === 0 ? 1.2 : 0.7 }));
const MESAS = [
  { x: 0, w: 70, h: 56, t: 52 },
  { x: 90, w: 44, h: 34, t: 38 },
  { x: 150, w: 90, h: 72, t: 70 },
  { x: 260, w: 52, h: 40, t: 46 },
  { x: 330, w: 80, h: 50, t: 60 },
];

function mesaLayer(span: number, scroll: number, hMul: number, color: string) {
  ctx.fillStyle = color;
  for (let rep = -1; rep < 2; rep++) {
    for (const m of MESAS) {
      const x = wrap(m.x - scroll, span) + rep * span - 40;
      const h = m.h * hMul;
      ctx.beginPath();
      ctx.moveTo(x, GY);
      ctx.lineTo(x + 5, GY - h);
      ctx.lineTo(x + m.t * hMul * 0.4 + m.w * 0.2, GY - h - 2);
      ctx.lineTo(x + m.w - 5, GY - h);
      ctx.lineTo(x + m.w, GY);
      ctx.fill();
    }
  }
}

function cloud(x: number, y: number, s: number, a: number) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 20 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.moveTo((x - 10 * s) + (11 * s), y + 2 * s);
  ctx.ellipse(x - 10 * s, y + 2 * s, 11 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.moveTo((x + 11 * s) + (12 * s), y + 2 * s);
  ctx.ellipse(x + 11 * s, y + 2 * s, 12 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function background() {
  const { p, night } = palette();
  const g = ctx.createLinearGradient(0, 0, 0, GY);
  g.addColorStop(0, css(p.top));
  g.addColorStop(0.6, css(p.mid));
  g.addColorStop(1, css(p.bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (night > 0.05) {
    ctx.fillStyle = `rgba(255,255,255,${night * 0.9})`;
    for (const s of STARS) ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  // sun / moon
  ctx.fillStyle = night > 0.5 ? 'rgba(235,235,255,0.9)' : 'rgba(255,240,200,0.85)';
  ctx.beginPath();
  ctx.arc(130, GY - 92, 20, 0, Math.PI * 2);
  ctx.fill();
  const sx = game.dist;
  for (const [cx, cy, s] of [[30, 70, 1], [120, 120, 0.7], [170, 40, 0.85]] as const) cloud(wrap(cx - sx * 0.03 * s, W + 60) - 20, cy, s, 0.22 * (1 - night * 0.6));
  mesaLayer(420, sx * 0.1, 1, css(p.far));
  mesaLayer(300, sx * 0.25, 0.55, css(p.near));
}

function ground() {
  const { p } = palette();
  ctx.fillStyle = css(p.sand);
  ctx.fillRect(0, GY, W, H - GY);
  ctx.fillStyle = css(p.sandTop);
  ctx.fillRect(0, GY, W, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  const off = wrap(game.dist, 20);
  for (let x = -20 - off; x < W + 20; x += 20) {
    ctx.fillRect(x + 4, GY + 16, 9, 2);
    ctx.fillRect(x + 12, GY + 34, 6, 2);
    ctx.fillRect(x - 2, GY + 52, 11, 2);
  }
  for (const o of game.obs) if (o.kind === 'pit') pit(o);
}

function pit(o: Obs) {
  ctx.fillStyle = '#0d0a1c';
  ctx.beginPath();
  ctx.moveTo(o.x, GY);
  ctx.lineTo(o.x + o.w, GY);
  ctx.lineTo(o.x + o.w - 5, H);
  ctx.lineTo(o.x + 5, H);
  ctx.fill();
  ctx.fillStyle = 'rgba(80,50,60,0.9)';
  ctx.fillRect(o.x - 2, GY, 3, 7);
  ctx.fillRect(o.x + o.w - 1, GY, 3, 7);
}

function obstacle(o: Obs) {
  const x = o.x;
  switch (o.kind) {
    case 'rock':
      ctx.fillStyle = '#7a7288';
      ctx.beginPath();
      ctx.moveTo(x, GY);
      ctx.lineTo(x + 2, GY - 9);
      ctx.lineTo(x + 8, GY - 14);
      ctx.lineTo(x + 15, GY - 10);
      ctx.lineTo(x + 18, GY);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(x + 4, GY - 8);
      ctx.lineTo(x + 8, GY - 13);
      ctx.lineTo(x + 11, GY - 9);
      ctx.fill();
      break;
    case 'cactus':
      cactus(x + 6.5, GY, 30);
      break;
    case 'cactus2':
      cactus(x + 6, GY, 26);
      cactus(x + 21, GY, 22);
      break;
    case 'bird':
      bird(x + 10, o.top + 6);
      break;
  }
}

function cactus(cx: number, base: number, h: number) {
  ctx.fillStyle = '#2f8a57';
  ctx.beginPath();
  ctx.roundRect(cx - 3.5, base - h, 7, h, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - 9, base - h * 0.62, 4, h * 0.3, 2);
  ctx.roundRect(cx - 9, base - h * 0.4, 8, 3.5, 2);
  ctx.roundRect(cx + 5, base - h * 0.78, 4, h * 0.32, 2);
  ctx.roundRect(cx + 1, base - h * 0.5, 8, 3.5, 2);
  ctx.fill();
  ctx.fillStyle = '#58c987';
  ctx.fillRect(cx - 1.5, base - h + 2, 1.5, h - 4);
  ctx.fillStyle = '#ffd1e0';
  ctx.fillRect(cx - 1, base - h - 1, 3, 2);
}

function bird(cx: number, cy: number) {
  const flap = Math.sin(game.t * 16);
  ctx.save();
  ctx.translate(cx, cy + Math.sin(game.t * 5) * 1.5);
  ctx.fillStyle = '#3a2a50';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // wings
  ctx.beginPath();
  ctx.moveTo(-1, -1);
  ctx.lineTo(3, -10 * flap - 3);
  ctx.lineTo(-8, -6 * flap - 1);
  ctx.closePath();
  ctx.fill();
  // head and beak (facing left)
  ctx.beginPath();
  ctx.arc(-8, -1, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(-10.5, -1.5);
  ctx.lineTo(-15, 0.5);
  ctx.lineTo(-10.5, 1.5);
  ctx.fill();
  ctx.fillStyle = '#ff6a6a';
  ctx.fillRect(-9.5, -2.5, 1.6, 1.6);
  ctx.fillStyle = '#3a2a50';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(14, -2);
  ctx.lineTo(14, 3);
  ctx.fill();
  ctx.restore();
}

function coin(x: number, y: number, ph: number) {
  const w = Math.abs(Math.cos(game.t * 5 + ph)) * 4 + 1;
  ctx.fillStyle = '#c98a14';
  ctx.beginPath();
  ctx.ellipse(x, y, w + 1, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd34a';
  ctx.beginPath();
  ctx.ellipse(x, y, w, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(x - w * 0.4, y - 2.5, Math.max(1, w * 0.3), 3);
}

function runner() {
  const g = game;
  const run = g.phase === 'over' ? 0 : g.t * 15;
  const sw = Math.sin(run);
  ctx.save();
  ctx.translate(PX, g.y);
  if (g.phase === 'over' && !g.fell) {
    ctx.translate(0, -10);
    ctx.rotate(g.spin);
    ctx.translate(0, 10);
  }
  const dark = '#3a2a50';
  if (g.sliding && g.grounded) {
    // sliding, feet first
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.lineTo(13, -3);
    ctx.stroke();
    ctx.fillStyle = '#2fb59a';
    ctx.beginPath();
    ctx.roundRect(-8, -10, 14, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(-10, -7, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8894a';
    ctx.beginPath();
    ctx.ellipse(-11, -10.5, 6, 1.8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(-8, -8, 1.6, 1.6);
    ctx.fillStyle = '#e0457b';
    ctx.beginPath();
    ctx.moveTo(-13, -6);
    ctx.lineTo(-22 - Math.sin(g.t * 20) * 2, -8);
    ctx.lineTo(-22, -4);
    ctx.fill();
  } else {
    const air = !g.grounded;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    // legs
    const l1 = air ? [-5, -4] : [sw * 7, 0];
    const l2 = air ? [6, -6] : [-sw * 7, 0];
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(l1[0], l1[1]);
    ctx.moveTo(0, -12);
    ctx.lineTo(l2[0], l2[1] + (air ? 0 : -Math.max(0, -sw) * 3));
    ctx.stroke();
    // arm (behind torso colour)
    ctx.strokeStyle = '#1e8c76';
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(air ? 8 : -sw * 7 + 1, air ? -26 : -14);
    ctx.stroke();
    // torso
    ctx.fillStyle = '#2fb59a';
    ctx.beginPath();
    ctx.roundRect(-5, -24, 10, 13, 3);
    ctx.fill();
    // scarf
    ctx.fillStyle = '#e0457b';
    ctx.beginPath();
    ctx.moveTo(-3, -24);
    ctx.lineTo(-14 - Math.sin(g.t * 22) * 1.5, -25 + Math.sin(g.t * 17) * 2);
    ctx.lineTo(-12, -21);
    ctx.lineTo(-3, -21);
    ctx.fill();
    // head
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(1, -29, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8894a';
    ctx.beginPath();
    ctx.ellipse(1, -32, 8.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1, -34.5, 5, 3.2, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(3, -29.5, 1.8, 1.8);
  }
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
  ctx.save();
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 6 * g.shake, (Math.random() - 0.5) * 6 * g.shake);
  background();
  ground();
  for (const o of g.obs) obstacle(o);
  for (const c of g.coinList) coin(c.x, c.y, c.ph);
  for (const d of g.dust) {
    ctx.fillStyle = `rgba(240,220,180,${Math.max(0, d.life * 1.6)})`;
    ctx.fillRect(d.x, d.y - 1, 2, 2);
  }
  runner();
  ctx.restore();

  if (g.phase === 'play') {
    text(String(g.score), W / 2, 36, 32, '#fff');
    coin(W - 40, 70, 0);
    text(`×${g.coins}`, W - 31, 70, 12, '#ffe08a', '#1a1030', 'left');
    text(`${g.meters} m`, 10, 70, 12, '#fff', '#1a1030', 'left');
    if (g.playT < 7) {
      ctx.globalAlpha = Math.min(1, (7 - g.playT) / 2) * 0.55;
      text('▼ SLIDE', 36, GY + 44, 11, '#fff');
      text('JUMP ▲', 118, GY + 44, 11, '#fff');
      ctx.globalAlpha = 1;
    }
  }

  if (g.phase === 'title') {
    text('CANYON', W / 2, 62, 26, '#ffe08a');
    text('DASH', W / 2, 92, 30, '#fff');
    text('tap to run', W / 2, 150, 14, '#fff');
    text('right: jump (hold = higher)', W / 2, 286, 9, '#fff', '#1a1030');
    text('left or swipe: slide', W / 2, 300, 9, '#fff', '#1a1030');
    if (g.best > 0) text(`best ${g.best}`, W / 2, 124, 12, '#ffd0a0');
  } else if (g.phase === 'over') {
    const k = Math.min(1, g.deadFor / 0.35);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * -10);
    text(g.fell ? 'FELL IN!' : 'OUCH!', W / 2, 62, 26, '#ff9a8a');
    ctx.fillStyle = 'rgba(20,16,48,0.84)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 58, 84, 116, 84, 10);
    ctx.fill();
    text('SCORE', W / 2 - 30, 98, 9, '#bfe3f5', 'transparent');
    text('BEST', W / 2 + 30, 98, 9, '#bfe3f5', 'transparent');
    text(String(g.score), W / 2 - 30, 120, 19, '#fff');
    text(String(g.best), W / 2 + 30, 120, 19, '#ffe08a');
    text(`${g.meters} m  ·  ${g.coins} coins`, W / 2, 148, 10, '#fff', 'transparent');
    if (g.newBest) text('NEW BEST!', W / 2, 161, 9, '#7fe0c4', 'transparent');
    if (g.deadFor > 0.6) text('tap to run again', W / 2, 196, 12, '#fff');
    ctx.restore();
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ---- input ----

const held = new Map<number, 'jump' | 'slide'>();
const swipeY = new Map<number, number>();
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const r = canvas.getBoundingClientRect();
  const left = (e.clientX - r.left) / r.width < 0.4;
  if (game.phase !== 'play') {
    game.press();
    renderBar();
    return;
  }
  swipeY.set(e.pointerId, e.clientY);
  if (left) {
    held.set(e.pointerId, 'slide');
    game.slide();
  } else {
    held.set(e.pointerId, 'jump');
    game.press();
  }
});
canvas.addEventListener('pointermove', (e) => {
  const y0 = swipeY.get(e.pointerId);
  if (y0 !== undefined && game.phase === 'play' && e.clientY - y0 > 26) {
    swipeY.delete(e.pointerId);
    game.slide();
  }
});
function up(e: PointerEvent) {
  swipeY.delete(e.pointerId);
  if (held.get(e.pointerId) === 'jump') game.release();
  held.delete(e.pointerId);
}
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    sound.unlock();
    game.press();
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    sound.unlock();
    game.slide();
  } else if (e.code === 'Enter') {
    sound.unlock();
    game.press();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') game.release();
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

(window as unknown as { __game: DashGame }).__game = game;
