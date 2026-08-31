import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Renders one SVG design to every standard PWA/iOS icon size and writes the
 * PNGs to the given output paths.
 *
 * @param {string} svg - SVG source, ideally on a 512x512 viewBox.
 * @param {string} outDir - directory the icons/ subfolder and touch icons go into (usually an app's `public/`).
 */
export async function generateIcons(svg, outDir) {
  mkdirSync(`${outDir}/icons`, { recursive: true });

  const targets = [
    { file: `${outDir}/icons/icon-192.png`, size: 192 },
    { file: `${outDir}/icons/icon-512.png`, size: 512 },
    { file: `${outDir}/icons/icon-maskable-512.png`, size: 512 },
    { file: `${outDir}/apple-touch-icon.png`, size: 180 },
    { file: `${outDir}/favicon-32.png`, size: 32 },
  ];

  for (const t of targets) {
    mkdirSync(dirname(t.file), { recursive: true });
    await sharp(Buffer.from(svg)).resize(t.size, t.size).png().toFile(t.file);
    console.log('wrote', t.file);
  }
}
