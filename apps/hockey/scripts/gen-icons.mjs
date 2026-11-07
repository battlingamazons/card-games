import { generateIcons } from '../../../packages/shared/scripts/gen-icons-lib.mjs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0a2f48"/>
  <rect x="120" y="50" width="272" height="412" rx="36" fill="#1a6a8a" stroke="#d8e6ee" stroke-width="10"/>
  <rect x="196" y="44" width="120" height="14" fill="#ff5a5a"/>
  <rect x="196" y="454" width="120" height="14" fill="#ff5a5a"/>
  <line x1="120" y1="256" x2="392" y2="256" stroke="#ffffff" stroke-opacity="0.6" stroke-width="6"/>
  <circle cx="256" cy="256" r="52" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="6"/>
  <circle cx="256" cy="140" r="38" fill="#ff5a5a" stroke="#7a1a1a" stroke-width="8"/>
  <circle cx="256" cy="140" r="16" fill="#ff9a9a"/>
  <circle cx="256" cy="376" r="38" fill="#4ad0ff" stroke="#0f4a66" stroke-width="8"/>
  <circle cx="256" cy="376" r="16" fill="#b8ecff"/>
  <circle cx="300" cy="278" r="18" fill="#10131f" stroke="#ffffff" stroke-width="4"/>
</svg>
`;

await generateIcons(svg, 'public');
