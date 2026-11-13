import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc8f0"/><stop offset="1" stop-color="#fff6d6"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#sky)"/>
  <path d="M0 400 Q130 300 260 380 T512 350 V512 H0Z" fill="#8fc86a"/>
  <rect y="450" width="512" height="62" fill="#4f9a38"/>
  <g transform="translate(150 120)"><circle cx="-14" r="34" fill="#e0453b"/><circle cx="14" r="34" fill="#e0453b"/><rect x="-3" y="-52" width="7" height="18" fill="#5a3a24"/><ellipse cx="22" cy="-42" rx="14" ry="7" transform="rotate(-25 22 -42)" fill="#4f9a38"/></g>
  <g transform="translate(360 190)"><circle cx="-14" r="30" fill="#ffc531"/><circle cx="14" r="30" fill="#ffc531"/><rect x="-3" y="-46" width="7" height="16" fill="#5a3a24"/></g>
  <g transform="translate(256 400)">
    <path d="M-100 -112 Q0 -230 100 -112" stroke="#8a5a2a" stroke-width="12" fill="none"/>
    <path d="M-120 -112 H120 L96 0 H-96Z" fill="#c8894a"/>
    <g stroke="#8a5a2a" stroke-width="5"><path d="M-112 -78H112M-104 -42H104M-98 -8H98M-60 -112L-52 0M0 -112V0M60 -112L52 0"/></g>
    <rect x="-128" y="-124" width="256" height="20" rx="6" fill="#e0a860"/>
  </g>
</svg>
`;

await generateIcons(svg, 'public');
