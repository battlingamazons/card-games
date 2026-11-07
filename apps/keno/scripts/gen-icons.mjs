import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

// A 5x4 grid of numbered balls, with a few marked as hits.
const hits = new Set([2, 6, 9, 13, 17]);
const picks = new Set([2, 9, 13, 14]);
let cells = '';
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 5; c++) {
    const i = r * 5 + c;
    const x = 72 + c * 76;
    const y = 150 + r * 76;
    const fill = hits.has(i) && picks.has(i) ? '#2fa84f' : hits.has(i) ? '#3a7be0' : '#16306a';
    const stroke = picks.has(i) ? '#d4af37' : '#4a6ab0';
    cells += `<rect x="${x}" y="${y}" width="64" height="64" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${picks.has(i) ? 6 : 3}"/>`;
    cells += `<text x="${x + 32}" y="${y + 33}" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="central">${i * 4 + 3}</text>`;
  }
}

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0b2a5a"/>
  <text x="256" y="112" font-family="Georgia, serif" font-weight="bold" font-size="76" fill="#d4af37" text-anchor="middle">KENO</text>
  ${cells}
</svg>
`;

await generateIcons(svg, 'public');
