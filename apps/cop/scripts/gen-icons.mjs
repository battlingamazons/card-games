import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const star = (cx, cy, r) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 ? r * 0.5 : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`;
  }
  return d + 'Z';
};

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1245"/><stop offset="1" stop-color="#c0308a"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#sky)"/>
  <g fill="#0a0618" opacity="0.55"><rect x="20" y="300" width="70" height="212"/><rect x="100" y="250" width="60" height="262"/><rect x="360" y="280" width="70" height="232"/><rect x="440" y="320" width="72" height="192"/></g>
  <circle cx="256" cy="250" r="140" fill="none" stroke="#ff5ab0" stroke-width="10" opacity="0.8"/>
  <path d="${star(256, 250, 118)}" fill="#ffc531" stroke="#7a5a10" stroke-width="8"/>
  <circle cx="256" cy="250" r="44" fill="#ffe08a" stroke="#7a5a10" stroke-width="6"/>
  <rect x="236" y="228" width="40" height="46" rx="10" fill="#7a5a10" opacity="0.6"/>
  <rect x="0" y="420" width="512" height="92" fill="#3a3a4a"/>
  <g transform="translate(130 450) rotate(-20)"><rect x="-6" y="-70" width="12" height="60" fill="#b0b0bc"/><rect x="-8" y="-30" width="16" height="16" fill="#7a7a88"/><rect x="-8" y="-14" width="16" height="30" rx="4" fill="#4a2a1a"/></g>
</svg>
`;

await generateIcons(svg, 'public');
