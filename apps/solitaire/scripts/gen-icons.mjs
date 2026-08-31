import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0b6b3a"/>
  <rect x="150" y="196" width="180" height="240" rx="16" fill="#082c1a" opacity="0.4"/>
  <rect x="130" y="176" width="180" height="240" rx="16" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="6"/>
  <text x="152" y="212" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#1a1a1a">A</text>
  <text x="220" y="296" font-family="Georgia, 'Times New Roman', serif" font-size="110" fill="#1a1a1a" text-anchor="middle" dominant-baseline="central">♠</text>
  <rect x="270" y="146" width="180" height="240" rx="16" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="6" transform="rotate(12 360 266)"/>
  <text x="292" y="182" transform="rotate(12 360 266)" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="#c0102a">K</text>
  <text x="360" y="266" transform="rotate(12 360 266)" font-family="Georgia, 'Times New Roman', serif" font-size="110" fill="#c0102a" text-anchor="middle" dominant-baseline="central">♦</text>
</svg>
`;

await generateIcons(svg, 'public');
