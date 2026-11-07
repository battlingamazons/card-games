import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#05070f"/>
  <g fill="none" stroke-linejoin="round">
    <polygon points="110,130 180,110 250,130 226,176 180,230 134,176" fill="#ff5ea8"/>
    <circle cx="180" cy="160" r="14" fill="#10131f"/>
    <polygon points="330,120 392,108 440,150 392,200 330,190 296,150" fill="#ffd23f" transform="translate(-10 0)"/>
    <circle cx="364" cy="152" r="16" fill="#10131f"/>
    <polygon points="256,236 330,290 256,344 182,290" stroke="#6bffb8" stroke-width="14"/>
    <circle cx="256" cy="290" r="20" fill="#6bffb8"/>
    <polygon points="256,372 322,462 256,440 190,462" fill="#4ad0ff"/>
    <polygon points="256,400 270,436 242,436" fill="#e9fbff"/>
  </g>
</svg>
`;

await generateIcons(svg, 'public');
