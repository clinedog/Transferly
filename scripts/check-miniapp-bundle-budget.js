const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'miniapp', 'dist', 'assets');

const budgets = {
  totalJsBytes: Number(process.env.MINIAPP_BUNDLE_MAX_JS_BYTES || 2_000_000),
  totalJsGzipBytes: Number(process.env.MINIAPP_BUNDLE_MAX_JS_GZIP_BYTES || 700_000),
  totalCssBytes: Number(process.env.MINIAPP_BUNDLE_MAX_CSS_BYTES || 400_000),
  singleAssetBytes: Number(process.env.MINIAPP_BUNDLE_MAX_ASSET_BYTES || 900_000)
};

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function addResult(results, name, pass, detail) {
  results.push({ name, pass, detail });
}

function listAssets() {
  if (!fs.existsSync(assetsDir)) {
    return [];
  }

  return fs
    .readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.join(assetsDir, entry.name);
      const content = fs.readFileSync(filePath);
      return {
        name: entry.name,
        bytes: content.byteLength,
        gzipBytes: zlib.gzipSync(content).byteLength
      };
    });
}

const results = [];
const assets = listAssets();
const jsAssets = assets.filter((asset) => asset.name.endsWith('.js'));
const cssAssets = assets.filter((asset) => asset.name.endsWith('.css'));
const totalJsBytes = jsAssets.reduce((sum, asset) => sum + asset.bytes, 0);
const totalJsGzipBytes = jsAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
const totalCssBytes = cssAssets.reduce((sum, asset) => sum + asset.bytes, 0);
const largestAsset = assets.reduce((largest, asset) => (asset.bytes > largest.bytes ? asset : largest), { bytes: 0 });

addResult(
  results,
  'miniapp dist assets exist',
  assets.length > 0,
  'Run npm run build --prefix miniapp before checking bundle budgets.'
);
addResult(
  results,
  'miniapp total JS budget',
  totalJsBytes <= budgets.totalJsBytes,
  `${formatBytes(totalJsBytes)} of ${formatBytes(budgets.totalJsBytes)}`
);
addResult(
  results,
  'miniapp gzipped JS budget',
  totalJsGzipBytes <= budgets.totalJsGzipBytes,
  `${formatBytes(totalJsGzipBytes)} of ${formatBytes(budgets.totalJsGzipBytes)}`
);
addResult(
  results,
  'miniapp total CSS budget',
  totalCssBytes <= budgets.totalCssBytes,
  `${formatBytes(totalCssBytes)} of ${formatBytes(budgets.totalCssBytes)}`
);
addResult(
  results,
  'miniapp single asset budget',
  largestAsset.bytes <= budgets.singleAssetBytes,
  largestAsset.name ? `${largestAsset.name}: ${formatBytes(largestAsset.bytes)}` : 'No assets found.'
);

const failed = results.filter((result) => !result.pass);

results.forEach((result) => {
  console.log(`${result.pass ? 'OK' : 'FAIL'} ${result.name} - ${result.detail}`);
});

if (failed.length > 0) {
  console.error(`Mini App bundle budget failed: ${failed.length} check(s) did not pass.`);
  process.exitCode = 1;
}
