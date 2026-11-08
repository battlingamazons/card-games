import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const die = (x, y, rot, pips) => {
  const P = { tl: [-26, -26], tr: [26, -26], ml: [-26, 0], mr: [26, 0], bl: [-26, 26], br: [26, 26], c: [0, 0] };
  const dots = pips.map((k) => `<circle cx="${P[k][0]}" cy="${P[k][1]}" r="11" fill="#1a1a1a"/>`).join('');
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-70" y="-70" width="140" height="140" rx="24" fill="#fdfdfb" stroke="#c0102a" stroke-width="7"/>${dots}</g>`;
};

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0b4a2a"/>
  <rect x="40" y="40" width="432" height="432" rx="64" fill="#0f6a3a" stroke="#d4af37" stroke-width="8"/>
  ${die(190, 230, -14, ['tl', 'tr', 'c', 'bl', 'br'])}
  ${die(330, 290, 12, ['tl', 'tr', 'ml', 'mr', 'bl', 'br'])}
  <text x="256" y="110" font-family="Georgia, serif" font-weight="bold" font-size="56" fill="#ffe08a" text-anchor="middle">CRAPS</text>
</svg>
`;

await generateIcons(svg, 'public');
