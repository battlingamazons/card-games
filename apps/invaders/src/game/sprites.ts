export const SHIELD_W = 22;
export const SHIELD_H = 16;

/** Cheap deterministic hash in [0, 1) so every boulder gets its own ragged outline. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A drifting boulder to hide behind: a lumpy ellipse with a ragged edge. 1 = solid. */
export function newShield(seed = 1): Uint8Array {
  const px = new Uint8Array(SHIELD_W * SHIELD_H);
  const cx = (SHIELD_W - 1) / 2;
  const cy = 8.5;
  for (let y = 0; y < SHIELD_H; y++) {
    for (let x = 0; x < SHIELD_W; x++) {
      const dx = (x - cx) / 11;
      const dy = (y - cy) / 8;
      const lump = (hash(x >> 1, y >> 1, seed) - 0.5) * 0.35;
      if (dx * dx + dy * dy + lump < 0.95) px[y * SHIELD_W + x] = 1;
    }
  }
  return px;
}

/** Texture tone for a boulder pixel, so the rock isn't a flat colour. */
export function rockTone(x: number, y: number, seed: number): 0 | 1 | 2 {
  const h = hash(x, y, seed + 40);
  return h < 0.18 ? 2 : h < 0.5 ? 1 : 0;
}
