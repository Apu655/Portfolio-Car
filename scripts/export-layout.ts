// Writes the district layout (src/world/district/layout.ts) to JSON for the Blender scripts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as layout from '../src/world/district/layout';

const out = fileURLToPath(new URL('../assets/build/layout.json', import.meta.url));
mkdirSync(fileURLToPath(new URL('../assets/build/', import.meta.url)), { recursive: true });
const data = Object.fromEntries(Object.entries(layout).filter(([, value]) => typeof value !== 'function'));
writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`[layout] wrote ${out}`);
