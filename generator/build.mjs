// Builds every static page and the animated cover into ../assets/.
// Usage: node build.mjs [cover] [profile]   (no argument builds everything)
import { mkdir } from 'node:fs/promises';
import { openRenderer } from './src/render.mjs';
import { assetsDir, buildCover, buildStatic } from './src/pages.mjs';

const jobs = {
  cover: (r) => buildCover(r),
  profile: (r) => buildStatic(r, { file: 'profile.html', out: 'member-profile.png', seed: 202 }),
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(jobs);
await mkdir(assetsDir, { recursive: true });
const renderer = await openRenderer();
try {
  for (const name of names) {
    if (!jobs[name]) throw new Error(`Unknown page: ${name}`);
    for (const f of await jobs[name](renderer)) console.log(`${(f.bytes / 1024).toFixed(1)} KB  ${f.path}`);
  }
} finally {
  await renderer.close();
}
