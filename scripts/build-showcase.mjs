// Resizes the portfolio's own screenshots and logos (assets/My Items/) into web-sized files in public/showcase/,
// for the gate screens, panels, and quick view. Uses macOS `sips`; run again after replacing an image.
//
//   node scripts/build-showcase.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = `${root}assets/My Items`;
const out = `${root}public/showcase`;
mkdirSync(out, { recursive: true });

/** [source, output name, longest side in px] */
const IMAGES = [
  ['projects/MovieSite.png', 'movie-site.jpg', 1024],
  ['projects/TicketSystem.png', 'railway-system.jpg', 1024],
  ['projects/LearningPlatform.png', 'learning-platform.jpg', 1024],
  ['projects/Ecommerce.png', 'ecommerce.jpg', 1024],
  ['projects/imageGenerator.png', 'image-generator.jpg', 1024],
  ['projects/InstaClone.png', 'instagram-clone.jpg', 1024],
  ['projects/linkedIn.png', 'linkedin-clone.jpg', 1024],
  ['AgentAIConversation.png', 'secarely-chat.jpg', 1024],
  ['experience/Metlife_logo.jpeg', 'metlife-logo.jpg', 256],
  ['experience/sysonex_logo.jpeg', 'sysonex-logo.jpg', 256],
  ['experience/brac-university-logo.png', 'brac-logo.png', 256],
];

for (const [from, name, size] of IMAGES) {
  const target = `${out}/${name}`;
  const format = name.endsWith('.png') ? ['-s', 'format', 'png'] : ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72'];
  execFileSync('sips', ['-Z', String(size), ...format, `${src}/${from}`, '--out', target], { stdio: 'ignore' });
  console.log(`[showcase] ${name.padEnd(22)} ${(statSync(target).size / 1024).toFixed(1)} KB`);
}
