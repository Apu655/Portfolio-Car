// Builds every 3D model from the Blender scripts:
//   layout.ts → assets/build/layout.json → Blender (headless) → raw .glb → gltf-transform (meshopt) → public/models
//
//   npm run assets:build              # all models
//   npm run assets:build -- car props # only some
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const build = `${root}assets/build`;
const out = `${root}public/models`;
const only = process.argv.slice(2);

function findBlender() {
  const candidates = [process.env.BLENDER_PATH, '/Applications/Blender.app/Contents/MacOS/Blender', '/usr/bin/blender', '/usr/local/bin/blender'];
  const found = candidates.find((c) => c && existsSync(c));
  if (!found) {
    console.error(
      'Blender was not found. Install it from https://www.blender.org/download/ (free, 4.2 or newer),\n' +
        'or set BLENDER_PATH to the Blender executable, then run `npm run assets:build` again.',
    );
    process.exit(1);
  }
  return found;
}

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] }).toString();

mkdirSync(out, { recursive: true });
process.stdout.write(run('npx', ['tsx', 'scripts/export-layout.ts']));

const blender = findBlender();
const log = run(blender, ['--background', '--factory-startup', '--python', 'assets/blender/build_all.py', '--', `${build}/layout.json`, build, ...only]);
const built = [...log.matchAll(/^\[assets\] (\S+)/gm)].map((m) => m[1]);
if (log.includes('Traceback')) {
  console.error(log);
  process.exit(1);
}

for (const name of built) {
  run('npx', ['gltf-transform', 'optimize', `${build}/${name}.glb`, `${out}/${name}.glb`, '--compress', 'meshopt', '--texture-compress', 'webp', '--simplify', 'false', '--flatten', 'false', '--join', 'false',
    // Keep material and node names: the runtime drives lights by material name and finds markers by node name.
    '--palette', 'false', '--prune', 'false']);
  const raw = statSync(`${build}/${name}.glb`).size / 1024;
  const optimized = statSync(`${out}/${name}.glb`).size / 1024;
  console.log(`[assets] ${name.padEnd(14)} ${raw.toFixed(1).padStart(8)} KB raw → ${optimized.toFixed(1).padStart(8)} KB`);
}

execFileSync('node', ['scripts/check-budget.mjs', '--models'], { cwd: root, stdio: 'inherit' });
