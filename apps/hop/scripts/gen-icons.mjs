import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b4a8a"/><stop offset="0.6" stop-color="#e8826a"/><stop offset="1" stop-color="#ffcf8a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#sky)"/>
  <circle cx="380" cy="360" r="70" fill="#fff0c8" opacity="0.9"/>
  <rect x="48" y="0" width="92" height="190" fill="#58c7ae"/>
  <rect x="34" y="170" width="120" height="40" fill="#7fe0c4"/>
  <rect x="48" y="360" width="92" height="152" fill="#58c7ae"/>
  <rect x="34" y="340" width="120" height="40" fill="#7fe0c4"/>
  <rect x="380" y="0" width="92" height="130" fill="#58c7ae"/>
  <rect x="366" y="110" width="120" height="40" fill="#7fe0c4"/>
  <path d="M0 470 H512 V512 H0Z" fill="#d9b36a"/><path d="M0 462 H512 V478 H0Z" fill="#7ac24a"/>
  <g transform="translate(262 250) rotate(-14) scale(7)">
    <path d="M-5 0 L-14 -4 L-12 0 L-14 5Z" fill="#c24a6a"/>
    <ellipse cx="0" cy="0" rx="9" ry="7.5" fill="#ffb347"/>
    <ellipse cx="1" cy="3" rx="6" ry="3.5" fill="#fff0c2"/>
    <path d="M-1 -6.5 L-3 -12 L1 -8 L3 -13 L4 -6.5Z" fill="#e0457b"/>
    <ellipse cx="-3" cy="2" rx="6" ry="3.2" transform="rotate(-20 -3 2)" fill="#e0457b"/>
    <circle cx="4.5" cy="-2.5" r="3" fill="#fff"/><circle cx="5.3" cy="-2.5" r="1.4" fill="#1a1030"/>
    <path d="M7.5 0 L13 1.5 L7.5 4Z" fill="#3b2a6a"/>
  </g>
</svg>
`;

await generateIcons(svg, 'public');
