import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

// 12 alternating red/black wedges around a gold hub, one green wedge at the top.
const cx = 256, cy = 256, R = 190, r = 90;
const N = 13;
let wedges = '';
for (let i = 0; i < N; i++) {
  const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / N;
  const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
  const color = i === 0 ? '#1f8a3c' : i % 2 ? '#c0102a' : '#16171e';
  wedges += `<path d="M ${p(r, a0)} L ${p(R, a0)} A ${R} ${R} 0 0 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 0 0 ${p(r, a0)} Z" fill="${color}" stroke="#d4af37" stroke-width="3"/>`;
}

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0d3b2a"/>
  <circle cx="${cx}" cy="${cy}" r="214" fill="#5a3410" stroke="#d4af37" stroke-width="8"/>
  ${wedges}
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a1a1a" stroke="#d4af37" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="28" fill="#d4af37"/>
  <circle cx="${cx + 4}" cy="${cy - 150}" r="14" fill="#fdfdfd" stroke="#888" stroke-width="2"/>
</svg>
`;

await generateIcons(svg, 'public');
