/**
 * Generate a TypeScript React icon library from all SVG files present in the
 * PayPal sandbox mirror.  The output is written to
 * `miniapp/src/lib/paypal/Icons.tsx` and can be imported like:
 *   import { AccountIcon } from '@/lib/paypal/Icons';
 *
 * This script is safe to run repeatedly – it overwrites the target file with
 * the current set of SVGs found under the mirror.
 */

const fs = require('fs');
const path = require('path');

// Mirror path – collect SVGs from the entire PayPal mirror, not just a sub‑directory.
// The original script pointed at the sandbox MPP path, which does not contain the
// CDN‑served SVG icons (they reside under the `www.paypalobjects.com` domain).
// We now point to the root of the mirror so that all SVG assets are discovered.
// For testing we allow an override via the `MIRROR_ROOT_OVERRIDE` environment variable.
const MIRROR_ROOT = process.env.MIRROR_ROOT_OVERRIDE
  ? path.resolve(process.env.MIRROR_ROOT_OVERRIDE)
  : path.resolve(
      __dirname,
      '..',
      'paypal_mirror'
    );

// Target location inside the miniapp source tree
const OUT_FILE = path.resolve(
  __dirname,
  '..',
  'miniapp',
  'src',
  'lib',
  'paypal',
  'Icons.tsx'
);

/** Convert a file name to a PascalCase component name */
function componentName(file) {
  const base = path.basename(file, '.svg');
  // remove any leading numbers or hyphens, then PascalCase
  return base
    .replace(/^[^a-zA-Z]+/, '')
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') + 'Icon';
}

/** Recursively collect *.svg files */
function collectSvgs(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSvgs(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.svg')) acc.push(full);
  }
  return acc;
}

function main() {
  // Ensure a clean, deterministic output – remove any previous file.
  if (fs.existsSync(OUT_FILE)) {
    try {
      fs.unlinkSync(OUT_FILE);
    } catch (e) {
      console.error('⚠️ Could not remove existing Icons.tsx:', e);
      process.exit(1);
    }
  }

  const svgs = collectSvgs(MIRROR_ROOT);
  if (svgs.length === 0) {
    console.warn('⚠️ No SVG files found under the PayPal mirror – icons will not be generated.');
    return;
  }

  let content = `// AUTO‑GENERATED – DO NOT EDIT MANUALLY\n`;
  content += `import * as React from 'react';\n\n`;

  svgs.forEach(file => {
    const name = componentName(file);
    let svg = fs.readFileSync(file, 'utf8');
    // Strip XML declaration / DOCTYPE if present
    svg = svg.replace(/<\?xml[^>]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '').trim();
    // Inject props spread into the <svg> tag
    svg = svg.replace(/<svg([^>]*)>/, '<svg$1 {...props}>');
    content += `export const ${name} = (props: React.SVGProps<SVGSVGElement>) => (\n  ${svg}\n);\n\n`;
  });

  // Ensure directory exists
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, content, 'utf8');
  console.log('✅ Generated', svgs.length, 'icons to', OUT_FILE);
}

main();
