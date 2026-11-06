import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const card = (x, y, rot, label, glyph, color) => `
  <rect x="${x}" y="${y}" width="190" height="270" rx="18" fill="#fdfdfd" stroke="#1a1a1a" stroke-width="6" transform="rotate(${rot} ${x + 95} ${y + 135})"/>
  <text x="${x + 95}" y="${y + 135}" transform="rotate(${rot} ${x + 95} ${y + 135})" font-family="Georgia, 'Times New Roman', serif" font-size="170" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central">${label}</text>
  <text x="${x + 95}" y="${y + 225}" transform="rotate(${rot} ${x + 95} ${y + 135})" font-family="Georgia, 'Times New Roman', serif" font-size="56" fill="${color}" text-anchor="middle" dominant-baseline="central">${glyph}</text>`;

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0b6b4a"/>
  <rect x="40" y="40" width="432" height="432" rx="60" fill="#0a2f3d" opacity="0.55"/>
  ${card(90, 120, -12, 'A', '♠', '#1a1a1a')}
  ${card(235, 105, 10, 'K', '♥', '#c0102a')}
  <text x="256" y="455" font-family="Georgia, serif" font-weight="bold" font-size="52" fill="#d4af37" text-anchor="middle">21</text>
</svg>
`;

await generateIcons(svg, 'public');
