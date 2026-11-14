import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc8f0"/><stop offset="1" stop-color="#d6f0fa"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#sky)"/>
  <circle cx="400" cy="110" r="42" fill="#fff2a8"/>
  <path d="M0 250 Q130 190 260 240 T512 220 V512 H0Z" fill="#8fd070"/>
  <rect y="300" width="512" height="212" fill="#6cbc4c"/>
  <g fill="#7a4a28"><rect x="40" y="320" width="200" height="150" rx="22"/><rect x="272" y="320" width="200" height="150" rx="22"/></g>
  <g fill="#4a2a14" opacity="0.5"><rect x="56" y="360" width="168" height="8"/><rect x="56" y="400" width="168" height="8"/><rect x="288" y="360" width="168" height="8"/><rect x="288" y="400" width="168" height="8"/></g>
  <!-- carrot -->
  <g transform="translate(140 372)">
    <ellipse cx="-22" cy="-50" rx="10" ry="34" fill="#3a8a2c" transform="rotate(-20 -22 -50)"/>
    <ellipse cx="22" cy="-50" rx="10" ry="34" fill="#3a8a2c" transform="rotate(20 22 -50)"/>
    <ellipse cx="0" cy="-58" rx="11" ry="40" fill="#4fa83a"/>
    <path d="M-30 -10 L30 -10 L0 60Z" fill="#ff8c1e"/>
  </g>
  <!-- tomato -->
  <g transform="translate(372 360)">
    <path d="M0 10 Q-14 -50 0 -90" stroke="#3a8a2c" stroke-width="8" fill="none"/>
    <ellipse cx="-30" cy="-60" rx="26" ry="12" fill="#4fa83a" transform="rotate(-20 -30 -60)"/>
    <circle cx="-22" cy="-14" r="34" fill="#e63228"/><circle cx="26" cy="-38" r="28" fill="#e63228"/>
    <ellipse cx="-34" cy="-26" rx="8" ry="6" fill="#ffffff" opacity="0.45"/>
  </g>
  <rect y="470" width="512" height="42" fill="#4f9a38"/>
</svg>
`;

await generateIcons(svg, 'public');
