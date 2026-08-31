import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0b6b3a"/>
  <rect x="140" y="210" width="170" height="230" rx="16" fill="#082c1a" opacity="0.4" transform="rotate(-14 225 325)"/>
  <rect x="120" y="190" width="170" height="230" rx="16" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="6" transform="rotate(-14 205 305)"/>
  <text x="205" y="305" transform="rotate(-14 205 305)" font-family="Georgia, 'Times New Roman', serif" font-size="110" fill="#1a1a1a" text-anchor="middle" dominant-baseline="central">♣</text>
  <rect x="240" y="160" width="170" height="230" rx="16" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="6" transform="rotate(10 325 275)"/>
  <text x="325" y="275" transform="rotate(10 325 275)" font-family="Georgia, 'Times New Roman', serif" font-size="110" fill="#c0102a" text-anchor="middle" dominant-baseline="central">♥</text>
</svg>
`;

await generateIcons(svg, 'public');
