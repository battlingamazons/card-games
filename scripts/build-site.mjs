import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appsDir = path.join(root, 'apps');
const siteDir = path.join(root, 'site');

rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });

// The static landing page (no build step) forms the site root.
cpSync(path.join(appsDir, 'landing'), siteDir, { recursive: true });

// Every other app's build output goes under a subfolder named after it.
for (const name of readdirSync(appsDir)) {
  if (name === 'landing') continue;
  const dist = path.join(appsDir, name, 'dist');
  if (!existsSync(dist)) continue;
  cpSync(dist, path.join(siteDir, name), { recursive: true });
  console.log(`copied ${name}/dist -> site/${name}`);
}
