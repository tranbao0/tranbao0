// Builds the activity page: the contribution graph and the top languages of tranbao0.
// Live data comes from the GitHub API (needs GITHUB_TOKEN). ACTIVITY_FIXTURE=<file.json> builds from a saved file instead.
import { readFile } from 'node:fs/promises';
import { buildStatic } from './pages.mjs';

export const LOGIN = 'tranbao0';

const API = 'https://api.github.com';

const CALENDAR_QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel weekday } }
      }
    }
  }
}`;

// Markup, style, data and script glue are not counted as programming languages.
export const IGNORED_LANGUAGES = new Set([
  'HTML', 'CSS', 'SCSS', 'Sass', 'Less', 'SQL', 'PLpgSQL', 'TSQL', 'PLSQL',
  'Shell', 'PowerShell', 'Batchfile', 'Dockerfile', 'Makefile', 'CMake',
  'Jinja', 'Handlebars', 'EJS', 'Mustache', 'Pug', 'XSLT', 'TeX', 'Roff',
  'Jupyter Notebook', 'JSON', 'YAML', 'Markdown',
]);

const LEVELS = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Turns the GraphQL calendar into weeks of days with a numeric level (0 to 4) and a month label for each month start.
export function shapeCalendar(calendar) {
  const weeks = calendar.weeks.map((week) =>
    week.contributionDays.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: Math.max(0, LEVELS.indexOf(d.contributionLevel)),
      weekday: d.weekday,
    })),
  );
  const months = [];
  let last = -1;
  weeks.forEach((week, col) => {
    const month = Number(week[0].date.slice(5, 7)) - 1;
    if (month === last) return;
    last = month;
    months.push({ col, label: MONTHS[month] });
  });
  // A partial month at the left edge has no room for its label.
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift();
  return { total: calendar.totalContributions, weeks, months };
}

// Sums language bytes over all repos, drops non-programming languages and returns the top `limit` with a percent share.
export function topLanguages(byRepo, limit = 5) {
  const bytes = new Map();
  for (const languages of byRepo) {
    for (const [name, count] of Object.entries(languages)) {
      if (IGNORED_LANGUAGES.has(name)) continue;
      bytes.set(name, (bytes.get(name) || 0) + count);
    }
  }
  const sum = [...bytes.values()].reduce((a, b) => a + b, 0);
  return [...bytes]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, bytes: count, percent: Math.round((count / sum) * 100) }));
}

// Public, non-fork, non-archived repos owned by the user.
export const isCounted = (repo) => !repo.fork && !repo.archived && !repo.private;

export const utcDate = (now = new Date()) => now.toISOString().slice(0, 10);

// Everything the page needs, from the raw API answers.
export function shapeActivity({ calendar, languages, copyDate }) {
  return { ...shapeCalendar(calendar), languages: topLanguages(languages), copyDate };
}

async function api(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'profile-generator', ...init.headers },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return res.json();
}

export async function fetchRaw(token, login = LOGIN) {
  const graphql = await api(`${API}/graphql`, token, {
    method: 'POST',
    body: JSON.stringify({ query: CALENDAR_QUERY, variables: { login } }),
  });
  if (graphql.errors) throw new Error(`GitHub GraphQL: ${JSON.stringify(graphql.errors)}`);
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await api(`${API}/users/${login}/repos?type=owner&per_page=100&page=${page}`, token);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const counted = repos.filter(isCounted);
  const languages = await Promise.all(counted.map((r) => api(`${API}/repos/${r.full_name}/languages`, token)));
  return { calendar: graphql.data.user.contributionsCollection.contributionCalendar, languages, copyDate: utcDate() };
}

export async function loadActivity(env = process.env) {
  if (env.ACTIVITY_FIXTURE) return shapeActivity(JSON.parse(await readFile(env.ACTIVITY_FIXTURE, 'utf8')));
  if (!env.GITHUB_TOKEN) throw new Error('Set GITHUB_TOKEN, or set ACTIVITY_FIXTURE to a saved JSON file');
  return shapeActivity(await fetchRaw(env.GITHUB_TOKEN));
}

export async function buildActivity(renderer) {
  const data = await loadActivity();
  console.log(`Total contributions: ${data.total}`);
  console.log(`Top languages: ${data.languages.map((l) => `${l.name} ${l.percent}%`).join(', ')}`);
  return buildStatic(renderer, { file: 'activity.html', out: 'activity.png', seed: 505, width: 1600, data });
}
