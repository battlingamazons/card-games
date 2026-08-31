import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0b6b3a"/>
  <rect x="96" y="72" width="220" height="300" rx="18" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="6" transform="rotate(-10 206 222)"/>
  <text x="206" y="222" transform="rotate(-10 206 222)" font-family="Georgia, 'Times New Roman', serif" font-size="150" fill="#c0102a" text-anchor="middle" dominant-baseline="central">♥</text>
  <rect x="200" y="140" width="220" height="300" rx="18" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="6" transform="rotate(8 310 290)"/>
  <text x="310" y="290" transform="rotate(8 310 290)" font-family="Georgia, 'Times New Roman', serif" font-size="150" fill="#1a1a1a" text-anchor="middle" dominant-baseline="central">♠</text>
</svg>
`;

await generateIcons(svg, 'public');
