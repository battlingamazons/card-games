import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b4a8a"/><stop offset="0.6" stop-color="#e8826a"/><stop offset="1" stop-color="#ffcf8a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#sky)"/>
  <circle cx="370" cy="250" r="64" fill="#fff0c8" opacity="0.9"/>
  <path d="M0 360 L40 250 L200 245 L240 360Z" fill="#8a5a8a"/>
  <path d="M200 360 L260 290 L400 288 L440 360Z" fill="#5a3a6e"/>
  <rect y="360" width="512" height="152" fill="#d9a862"/><rect y="360" width="512" height="14" fill="#ecc480"/>
  <g transform="translate(236 372) scale(6.2)">
    <path d="M0 -12 L-6 0" stroke="#3a2a50" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M0 -12 L7 -3" stroke="#3a2a50" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M0 -21 L7 -22" stroke="#1e8c76" stroke-width="3.2" stroke-linecap="round"/>
    <rect x="-5" y="-24" width="10" height="13" rx="3" fill="#2fb59a"/>
    <path d="M-3 -24 L-16 -26 L-13 -21 L-3 -21Z" fill="#e0457b"/>
    <circle cx="1" cy="-29" r="5" fill="#f2c9a0"/>
    <ellipse cx="1" cy="-32" rx="8.5" ry="2" fill="#c8894a"/>
    <path d="M-4 -32 A5 3.2 0 0 1 6 -32Z" fill="#c8894a"/>
    <rect x="3" y="-29.5" width="1.8" height="1.8" fill="#1a1030"/>
  </g>
  <g fill="#2f8a57"><rect x="90" y="300" width="22" height="70" rx="10"/><rect x="66" y="320" width="14" height="30" rx="6"/><rect x="66" y="340" width="34" height="12" rx="5"/></g>
  <g transform="translate(400 330)"><ellipse rx="16" ry="20" fill="#c98a14"/><ellipse rx="13" ry="17" fill="#ffd34a"/></g>
</svg>
`;

await generateIcons(svg, 'public');
