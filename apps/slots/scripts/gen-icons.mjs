import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const reel = (x) => `
  <rect x="${x}" y="170" width="120" height="190" rx="14" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="6"/>
  <text x="${x + 60}" y="268" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="bold" fill="#c0102a" text-anchor="middle" dominant-baseline="central">7</text>`;

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#7a1522"/>
  <rect x="50" y="110" width="412" height="300" rx="34" fill="#3a0d14"/>
  <rect x="60" y="120" width="392" height="280" rx="26" fill="none" stroke="#d4af37" stroke-width="8"/>
  ${reel(80)}${reel(196)}${reel(312)}
  <rect x="70" y="262" width="372" height="8" fill="#d4af37" opacity="0.7"/>
  <text x="256" y="85" font-family="Georgia, serif" font-weight="bold" font-size="52" fill="#d4af37" text-anchor="middle">JACKPOT</text>
  <circle cx="256" cy="455" r="12" fill="#d4af37"/><circle cx="206" cy="455" r="12" fill="#d4af37"/><circle cx="306" cy="455" r="12" fill="#d4af37"/>
</svg>
`;

await generateIcons(svg, 'public');
