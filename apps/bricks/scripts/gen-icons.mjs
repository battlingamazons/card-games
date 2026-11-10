import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const hues = ['#ff5a9a', '#ff9a4a', '#ffd34a', '#5ae08a', '#4ac8e8'];
let bricks = '';
hues.forEach((c, r) => {
  for (let i = 0; i < 5; i++) {
    bricks += `<rect x="${52 + i * 82}" y="${70 + r * 46}" width="76" height="40" rx="9" fill="${c}"/><rect x="${58 + i * 82}" y="${75 + r * 46}" width="64" height="9" rx="4" fill="#fff" opacity="0.3"/>`;
  }
});
const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a5e"/><stop offset="1" stop-color="#0f0a26"/></linearGradient></defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  ${bricks}
  <circle cx="300" cy="360" r="20" fill="#fff6d6"/>
  <rect x="190" y="430" width="150" height="26" rx="13" fill="#8ad0ff"/>
</svg>
`;

await generateIcons(svg, 'public');
