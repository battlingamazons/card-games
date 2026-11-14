import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1008"/><stop offset="1" stop-color="#5a2a14"/></linearGradient>
    <radialGradient id="ball" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#f0c090"/><stop offset="0.5" stop-color="#a05a2a"/><stop offset="1" stop-color="#4a2410"/></radialGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <rect x="50" y="50" width="412" height="230" rx="30" fill="#c8893a"/>
  <rect x="68" y="68" width="376" height="194" rx="20" fill="#3a5ab0"/>
  <path d="M68 262 A260 260 0 0 1 444 262Z" fill="#f4efe0" opacity="0.9"/>
  <path d="M120 262 A200 200 0 0 1 392 262Z" fill="#c83a3a"/>
  <path d="M170 262 A140 140 0 0 1 342 262Z" fill="#f4efe0"/>
  <path d="M215 262 A90 90 0 0 1 297 262Z" fill="#3a5ab0"/>
  <g fill="#0a0404" stroke="#d8b060" stroke-width="6"><circle cx="256" cy="110" r="26"/><circle cx="150" cy="150" r="22"/><circle cx="362" cy="150" r="22"/><circle cx="256" cy="212" r="30"/></g>
  <circle cx="100" cy="100" r="16" fill="#0a0404" stroke="#e0453b" stroke-width="6"/><circle cx="412" cy="100" r="16" fill="#0a0404" stroke="#e0453b" stroke-width="6"/>
  <path d="M120 512 L200 300 H312 L392 512Z" fill="#c8924a"/>
  <path d="M200 300 Q256 270 312 300" stroke="#e8b060" stroke-width="14" fill="none"/>
  <circle cx="256" cy="420" r="58" fill="url(#ball)"/>
  <ellipse cx="236" cy="396" rx="16" ry="10" fill="#ffffff" opacity="0.55" transform="rotate(-35 236 396)"/>
</svg>
`;

await generateIcons(svg, 'public');
