// Builds the zine pages into ../assets/.
// Usage: node build.mjs [page ...]   (no argument builds every page except activity)
// The activity page reads live data from the GitHub API and needs GITHUB_TOKEN.
import { mkdir } from 'node:fs/promises';
import { openRenderer } from '@tranbao0/printshop/core/render';
import { assetsDir, buildCover, buildProjects, buildStatic } from './src/pages.mjs';
import { buildActivity } from './src/activity.mjs';

const card = (name, seed) => (r) => buildStatic(r, { file: `card-${name}.html`, out: `card-${name}.png`, seed, width: 800 });
const tag = (name, seed) => (r) => buildStatic(r, { file: `tag-${name}.html`, out: `tag-${name}.png`, seed, width: 800 });

const jobs = {
  cover: (r) => buildCover(r),
  'profile-credits': (r) => buildStatic(r, { file: 'profile-credits.html', out: 'profile-credits.png', seed: 202 }),
  projects: (r) => buildProjects(r),
  'card-weekrow': card('weekrow', 411),
  'card-songranking': card('songranking', 412),
  'tag-fan-letter': tag('fan-letter', 611),
  'tag-kofi': tag('kofi', 612),
  activity: (r) => buildActivity(r),
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(jobs).filter((name) => name !== 'activity');
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
