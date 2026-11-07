/**
 * All the vector art, drawn in game pixels (the canvas is scaled up by the caller). Everything fits the
 * same hit boxes the engine uses, so the look can change without touching the rules.
 */

const TAU = Math.PI * 2;

function glow(c: CanvasRenderingContext2D, color: string, draw: () => void) {
  c.save();
  c.globalAlpha = 0.25;
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineWidth = 3;
  c.lineJoin = 'round';
  draw();
  c.restore();
}

export const ALIEN_COLORS = ['#ff5ea8', '#ffd23f', '#6bffb8'];

/**
 * Invader kinds: 0 dart (10 wide), 1 hex (11 wide), 2 diamond (12 wide), all 8 tall. `frame` flips on every march step.
 */
export function drawAlien(c: CanvasRenderingContext2D, kind: number, frame: number, x: number, y: number) {
  const color = ALIEN_COLORS[kind];
  c.save();
  c.translate(x, y);
  c.lineJoin = 'round';
  if (kind === 0) {
    const path = () => {
      c.beginPath();
      if (frame === 0) {
        c.moveTo(0, 1.5);
        c.lineTo(5, 0);
        c.lineTo(10, 1.5);
        c.lineTo(8, 5);
        c.lineTo(5, 8);
        c.lineTo(2, 5);
      } else {
        c.moveTo(0, 3);
        c.lineTo(5, 0);
        c.lineTo(10, 3);
        c.lineTo(8, 4.5);
        c.lineTo(5, 8);
        c.lineTo(2, 4.5);
      }
      c.closePath();
    };
    glow(c, color, () => {
      path();
      c.fill();
      c.stroke();
    });
    path();
    c.fillStyle = color;
    c.fill();
    c.fillStyle = '#10131f';
    c.beginPath();
    c.arc(5, 3.2, 1.1, 0, TAU);
    c.fill();
  } else if (kind === 1) {
    const path = () => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = 5.5 + Math.cos(a) * 5.3;
        const py = 4 + Math.sin(a) * 4;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    };
    glow(c, color, () => {
      path();
      c.fill();
      c.stroke();
    });
    path();
    c.fillStyle = color;
    c.fill();
    c.fillStyle = '#10131f';
    c.beginPath();
    c.arc(5.5, 4, frame === 0 ? 1.4 : 2.3, 0, TAU);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(1.5, 0.5 + frame);
    c.lineTo(0, 1.5 + frame);
    c.moveTo(9.5, 0.5 + frame);
    c.lineTo(11, 1.5 + frame);
    c.stroke();
  } else {
    const path = () => {
      c.beginPath();
      c.moveTo(6, 0);
      c.lineTo(12, 4);
      c.lineTo(6, 8);
      c.lineTo(0, 4);
      c.closePath();
    };
    glow(c, color, () => {
      path();
      c.fill();
      c.stroke();
    });
    path();
    c.lineWidth = 1.5;
    c.strokeStyle = color;
    c.stroke();
    c.fillStyle = color;
    c.beginPath();
    if (frame === 0) c.arc(6, 4, 2, 0, TAU);
    else c.rect(4.4, 2.4, 3.2, 3.2);
    c.fill();
  }
  c.restore();
}

/** The player's ship: a sleek arrowhead with an engine flame. 13x8. */
export function drawShip(c: CanvasRenderingContext2D, x: number, y: number, flame = true) {
  c.save();
  c.translate(x, y);
  c.lineJoin = 'round';
  const hull = () => {
    c.beginPath();
    c.moveTo(6.5, 0);
    c.lineTo(13, 8);
    c.lineTo(6.5, 6);
    c.lineTo(0, 8);
    c.closePath();
  };
  glow(c, '#4ad0ff', () => {
    hull();
    c.fill();
    c.stroke();
  });
  hull();
  c.fillStyle = '#4ad0ff';
  c.fill();
  c.fillStyle = '#e9fbff';
  c.beginPath();
  c.moveTo(6.5, 2);
  c.lineTo(7.8, 5.4);
  c.lineTo(5.2, 5.4);
  c.closePath();
  c.fill();
  if (flame) {
    c.fillStyle = '#ffb04a';
    const f = 1 + Math.floor(performance.now() / 70) % 2;
    c.fillRect(5.5, 6.2, 2, f);
  }
  c.restore();
}

/** The bonus ship: a glowing orb with a spinning ring. 16x7. */
export function drawBonusShip(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  c.save();
  c.translate(x + 8, y + 3.5);
  glow(c, '#ff5a7a', () => {
    c.beginPath();
    c.ellipse(0, 0, 8, 3.4, 0, 0, TAU);
    c.fill();
  });
  c.fillStyle = '#ff5a7a';
  c.beginPath();
  c.ellipse(0, 0, 7.6, 2.6, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#ffd0da';
  c.beginPath();
  c.ellipse(0, -1.4, 3.4, 2, 0, Math.PI, TAU);
  c.fill();
  // Running lights around the rim.
  for (let i = 0; i < 5; i++) {
    const on = (Math.floor(t * 8) + i) % 5 === 0;
    c.fillStyle = on ? '#ffffff' : '#7a2236';
    c.fillRect(-6.5 + i * 3.2, 1.1, 1.4, 1);
  }
  c.restore();
}

/** Expanding ring plus a few flying sparks. `t` is the age in seconds, `life` the total lifetime. */
export function drawBurst(c: CanvasRenderingContext2D, cx: number, cy: number, t: number, life: number, color: string, size: number) {
  const k = Math.min(1, t / life);
  c.save();
  c.globalAlpha = 1 - k;
  c.strokeStyle = color;
  c.lineWidth = 1.5 * (1 - k) + 0.5;
  c.beginPath();
  c.arc(cx, cy, 1 + k * size, 0, TAU);
  c.stroke();
  c.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.4;
    const r = k * size * 1.3;
    c.fillRect(cx + Math.cos(a) * r - 0.5, cy + Math.sin(a) * r - 0.5, 1.2, 1.2);
  }
  c.restore();
}

/** Brief flash where a shot dies against the ceiling or the ground. */
export function drawSpark(c: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
  const k = Math.min(1, t / 0.25);
  c.save();
  c.globalAlpha = 1 - k;
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1;
  const r = 1 + k * 4;
  c.beginPath();
  c.moveTo(cx - r, cy);
  c.lineTo(cx + r, cy);
  c.moveTo(cx, cy - r);
  c.lineTo(cx, cy + r);
  c.stroke();
  c.restore();
}

/** A fixed, dim starfield behind the action. */
export const STARS: { x: number; y: number; p: number }[] = (() => {
  let s = 12345;
  const r = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: 46 }, () => ({ x: Math.floor(r() * 224), y: 16 + Math.floor(r() * 220), p: r() * TAU }));
})();
