import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const card = (x, y, rot, glyph, color) => `
  <rect x="${x}" y="${y}" width="120" height="170" rx="12" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="5" transform="rotate(${rot} ${x + 60} ${y + 85})"/>
  <text x="${x + 60}" y="${y + 85}" transform="rotate(${rot} ${x + 60} ${y + 85})" font-family="Georgia, 'Times New Roman', serif" font-size="78" fill="${color}" text-anchor="middle" dominant-baseline="central">${glyph}</text>`;

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#3a1450"/>
  <rect x="40" y="60" width="432" height="392" rx="40" fill="#2a0d3a"/>
  ${card(70, 190, -18, '♠', '#1a1a1a')}
  ${card(160, 170, -8, '♥', '#c0102a')}
  ${card(250, 165, 4, '♦', '#c0102a')}
  ${card(335, 180, 14, '♣', '#1a1a1a')}
  <text x="256" y="120" font-family="Georgia, serif" font-weight="bold" font-size="46" fill="#d4af37" text-anchor="middle">JACKS OR BETTER</text>
</svg>
`;

await generateIcons(svg, 'public');
