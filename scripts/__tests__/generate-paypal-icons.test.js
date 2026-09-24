/**
 * Unit test for the PayPal SVG icon generator.
 *
 * The test creates a tiny temporary PayPal‑mirror‑like directory containing two
 * SVG files, runs the generator with the `MIRROR_ROOT_OVERRIDE` env variable, and
 * verifies that a TypeScript file with the expected component exports is created.
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Path to the generated Icons file (same location as the real script uses)
const OUT_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  'miniapp',
  'src',
  'lib',
  'paypal',
  'Icons.tsx'
);

describe('generate-paypal-icons script', () => {
  const tempMirror = fs.mkdtempSync(path.join(os.tmpdir(), 'paypal-mirror-'));
  const originalOutput = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE) : null;

  // Minimal mock SVG assets – naming chosen to test the component‑name conversion
  const svgA = `<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`;
  const svgB = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="8"/></svg>`;

  test('generates a TS file with two React components', () => {
    // Set up a temporary mirror inside the test so we don't rely on beforeAll/afterAll
    const tempMirror = fs.mkdtempSync(path.join(os.tmpdir(), 'paypal-mirror-'));
    const iconsDir = path.join(tempMirror, 'icons');
    fs.mkdirSync(iconsDir, { recursive: true });
    const svgA = `<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`;
    const svgB = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="8"/></svg>`;
    fs.writeFileSync(path.join(iconsDir, 'test-1.svg'), svgA);
    fs.writeFileSync(path.join(iconsDir, 'test-2.svg'), svgB);

    // Run the generator, pointing at the temporary mirror via env var
    execSync('npm run generate:icons', {
      env: { ...process.env, MIRROR_ROOT_OVERRIDE: tempMirror },
      stdio: 'ignore',
    });

    // Verify the output file exists and contains the expected components
    assert.ok(fs.existsSync(OUT_FILE), 'Icons.tsx should be generated');
    const content = fs.readFileSync(OUT_FILE, 'utf8');
    assert.match(content, /export const Test1Icon/);
    assert.match(content, /export const Test2Icon/);

    // Clean up temporary files and restore the tracked generated artifact.
    try { fs.rmSync(tempMirror, { recursive: true, force: true }); } catch (_) {}
    try {
      if (originalOutput) {
        fs.writeFileSync(OUT_FILE, originalOutput);
      } else {
        fs.unlinkSync(OUT_FILE);
      }
    } catch (_) {}
  });
});
