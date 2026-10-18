// Download budgets for the 3D experience, measured as transfer size:
// gzip for JS and other text; actual bytes for already-compressed .glb / .webm / .mp3.
//
//   node scripts/check-budget.mjs --models   # models only (after assets:build)
//   node scripts/check-budget.mjs --audio    # audio only
//   node scripts/check-budget.mjs            # everything, after `npm run build`
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const MB = 1024 * 1024;
export const BUDGETS = { models: 3 * MB, audio: 2.5 * MB, total: 8 * MB };

const files = (dir, ext) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => ext.some((e) => f.endsWith(e))).map((f) => `${dir}/${f}`) : [];
const bytes = (paths) => paths.reduce((sum, p) => sum + statSync(p).size, 0);
const gzipped = (paths) => paths.reduce((sum, p) => sum + gzipSync(readFileSync(p)).length, 0);
const mb = (n) => `${(n / MB).toFixed(2)} MB`;

const args = new Set(process.argv.slice(2));
const all = args.size === 0;
let failed = false;
const check = (label, used, budget) => {
  const ok = used <= budget;
  failed ||= !ok;
  console.log(`[budget] ${label.padEnd(10)} ${mb(used).padStart(9)} / ${mb(budget)} ${ok ? 'ok' : 'OVER BUDGET'}`);
};

const models = bytes(files(`${root}public/models`, ['.glb']));
const audio = bytes(files(`${root}public/audio`, ['.webm', '.mp3']));
if (all || args.has('--models')) check('models', models, BUDGETS.models);
if (all || args.has('--audio')) check('audio', audio, BUDGETS.audio);

if (all) {
  const assets = `${root}dist/assets`;
  if (!existsSync(assets)) {
    console.error('[budget] dist/ not found — run `npm run build` first.');
    process.exit(1);
  }
  const js = files(assets, ['.js', '.css', '.wasm']);
  // Only one audio format is downloaded per browser, so count the larger of the two sets.
  const audioOneFormat = Math.max(bytes(files(`${root}public/audio`, ['.webm'])), bytes(files(`${root}public/audio`, ['.mp3'])));
  // Logos and screenshots on the gate screens (already-compressed JPEG/PNG).
  const showcase = bytes(files(`${root}public/showcase`, ['.jpg', '.png']));
  check('total', gzipped(js) + models + audioOneFormat + showcase, BUDGETS.total);
}

process.exit(failed ? 1 : 0);
