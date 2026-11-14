import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dcc6"/><stop offset="1" stop-color="#e0b894"/></linearGradient>
    <radialGradient id="body" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#b6f0d8"/><stop offset="1" stop-color="#6fd3a8"/></radialGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <rect y="380" width="512" height="132" fill="#c8894a"/>
  <path d="M150 215 L175 110 L250 175Z" fill="#5fc79a"/><path d="M362 215 L337 110 L262 175Z" fill="#5fc79a"/>
  <ellipse cx="256" cy="300" rx="150" ry="140" fill="url(#body)"/>
  <ellipse cx="256" cy="350" rx="85" ry="62" fill="#e6fbf2"/>
  <path d="M170 255 Q190 225 212 255" stroke="#2a1a3a" stroke-width="12" fill="none" stroke-linecap="round"/>
  <path d="M300 255 Q322 225 342 255" stroke="#2a1a3a" stroke-width="12" fill="none" stroke-linecap="round"/>
  <ellipse cx="165" cy="290" rx="22" ry="13" fill="#ff6e8c" opacity="0.5"/><ellipse cx="347" cy="290" rx="22" ry="13" fill="#ff6e8c" opacity="0.5"/>
  <path d="M226 300 Q256 335 286 300" stroke="#2a1a3a" stroke-width="11" fill="none" stroke-linecap="round"/>
  <path d="M410 120 c-14 -22 -44 -4 -26 18 l26 24 26 -24 c18 -22 -12 -40 -26 -18z" fill="#ff5a8a"/>
</svg>
`;

await generateIcons(svg, 'public');
