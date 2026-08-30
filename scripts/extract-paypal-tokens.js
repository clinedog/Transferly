/**
 * Extract CSS custom properties (design tokens) from the PayPal sandbox mirror.
 * The script scans every *.css file under the mirror directory, parses it with
 * PostCSS, collects all `--*` variables, and writes a JSON file that can be
 * consumed by Style Dictionary, Tailwind, or any other token generator.
 *
 * Usage (run after a fresh HTTrack mirror):
 *   node scripts/extract-paypal-tokens.js
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const postcssSafeParser = require('postcss-safe-parser');

// Mirror root – the repository currently stores the sandbox under
// `paypal_mirror/www.sandbox.paypal.com`.  If you ever rename the folder
// (e.g., to `httrack_mirror`), just update this constant.
const MIRROR_ROOT = path.resolve(
  __dirname,
  '..',
  'paypal_mirror',
  'www.sandbox.paypal.com',
  'us', // the US‑focused sub‑folder contains the actual UI assets
  'webapps',
  'mpp'
);
const OUTPUT_JSON = path.resolve(__dirname, '..', 'tokens', 'paypal.json');

/** Recursively collect all .css files under a directory */
function collectCssFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectCssFiles(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.css')) acc.push(full);
  }
  return acc;
}

function extractTokensFromCss(cssContent) {
  const root = postcss.parse(cssContent, { parser: postcssSafeParser });
  const tokens = {};
  root.walkDecls(decl => {
    const prop = decl.prop.trim();
    if (prop.startsWith('--')) {
      // Keep the raw value – downstream tools can decide to resolve var() chains
      tokens[prop] = decl.value.trim();
    }
  });
  return tokens;
}

function main() {
  const cssFiles = collectCssFiles(MIRROR_ROOT);
  const allTokens = {};
  for (const file of cssFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const tokens = extractTokensFromCss(content);
    Object.assign(allTokens, tokens);
  }
  // Ensure the output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(allTokens, null, 2), 'utf8');
  console.log('✅ Extracted', Object.keys(allTokens).length, 'tokens to', OUTPUT_JSON);
}

main();
