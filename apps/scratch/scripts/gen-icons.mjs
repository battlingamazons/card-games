import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const spot = (x, y, scratched, glyph) => `
  <rect x="${x}" y="${y}" width="104" height="104" rx="18" fill="${scratched ? '#fffbe8' : 'url(#silver)'}" stroke="#7a6a2a" stroke-width="5"/>
  ${scratched ? `<text x="${x + 52}" y="${y + 56}" font-family="Georgia, serif" font-size="70" font-weight="bold" fill="#c0102a" text-anchor="middle" dominant-baseline="central">${glyph}</text>` : ''}`;

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8ecef"/><stop offset="0.5" stop-color="#a9b2b9"/><stop offset="1" stop-color="#dfe4e8"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2fa84f"/><stop offset="1" stop-color="#176a32"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#1a3a2a"/>
  <rect x="56" y="56" width="400" height="400" rx="34" fill="url(#card)" stroke="#d4af37" stroke-width="8"/>
  <text x="256" y="118" font-family="Georgia, serif" font-weight="bold" font-size="44" fill="#ffe08a" text-anchor="middle">LUCKY 7s</text>
  ${spot(86, 160, true, '7')}${spot(204, 160, true, '7')}${spot(322, 160, false)}
  ${spot(86, 284, false)}${spot(204, 284, true, '7')}${spot(322, 284, false)}
  <path d="M300 420 q40 -50 90 -30" stroke="#ffffff" stroke-opacity="0.5" stroke-width="10" fill="none" stroke-linecap="round"/>
</svg>
`;

await generateIcons(svg, 'public');
