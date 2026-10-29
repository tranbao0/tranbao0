import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shapeCalendar, topLanguages, isCounted, utcDate, shapeActivity, loadActivity, checkActivity, altText, cleanAlt, IGNORED_LANGUAGES, OUTRO_ALT } from '../src/activity.mjs';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));

const day = (date, count, level, weekday) => ({ date, contributionCount: count, contributionLevel: level, weekday });

test('shapeCalendar maps the GitHub levels to numbers 0 to 4', () => {
  const calendar = {
    totalContributions: 9,
    weeks: [{
      contributionDays: [
        day('2026-01-04', 0, 'NONE', 0),
        day('2026-01-05', 1, 'FIRST_QUARTILE', 1),
        day('2026-01-06', 2, 'SECOND_QUARTILE', 2),
        day('2026-01-07', 3, 'THIRD_QUARTILE', 3),
        day('2026-01-08', 3, 'FOURTH_QUARTILE', 4),
      ],
    }],
  };
  const { total, weeks } = shapeCalendar(calendar);
  assert.equal(total, 9);
  assert.deepEqual(weeks[0].map((d) => d.level), [0, 1, 2, 3, 4]);
  assert.deepEqual(weeks[0][1], { date: '2026-01-05', count: 1, level: 1, weekday: 1 });
});

test('shapeCalendar labels the first week of each month and drops a cramped partial month at the left edge', () => {
  const week = (date) => ({ contributionDays: [day(date, 0, 'NONE', 0)] });
  const calendar = {
    totalContributions: 0,
    weeks: [week('2025-10-26'), week('2025-11-02'), week('2025-11-09'), week('2025-11-16'), week('2025-11-23'), week('2025-11-30'), week('2025-12-07')],
  };
  const { months } = shapeCalendar(calendar);
  assert.deepEqual(months, [{ col: 1, label: 'NOV' }, { col: 6, label: 'DEC' }]);
});

test('shapeCalendar keeps a first label that has room', () => {
  const week = (date) => ({ contributionDays: [day(date, 0, 'NONE', 0)] });
  const calendar = {
    totalContributions: 0,
    weeks: [week('2025-10-12'), week('2025-10-19'), week('2025-10-26'), week('2025-11-02')],
  };
  assert.deepEqual(shapeCalendar(calendar).months, [{ col: 0, label: 'OCT' }, { col: 3, label: 'NOV' }]);
});

test('topLanguages drops markup, style, data and script glue', () => {
  const result = topLanguages([{ HTML: 900, CSS: 800, SQL: 700, Shell: 600, Dockerfile: 500, Makefile: 400, PowerShell: 300, Batchfile: 200, Java: 100 }]);
  assert.deepEqual(result.map((l) => l.name), ['Java']);
  assert.equal(result[0].percent, 100);
});

test('topLanguages sums bytes over repos, sorts and keeps the top five', () => {
  const repos = [
    { Java: 100, Python: 50, C: 10 },
    { Java: 100, TypeScript: 70, Swift: 5, Go: 4, Rust: 3 },
    {},
  ];
  const result = topLanguages(repos);
  assert.deepEqual(result.map((l) => [l.name, l.bytes]), [['Java', 200], ['TypeScript', 70], ['Python', 50], ['C', 10], ['Swift', 5]]);
});

test('topLanguages computes percent from all programming bytes, not only the top five', () => {
  const result = topLanguages([{ A: 50, B: 30, C: 10, D: 5, E: 3, F: 2 }]);
  assert.deepEqual(result.map((l) => l.percent), [50, 30, 10, 5, 3]);
});

test('topLanguages breaks ties by name and handles no data', () => {
  assert.deepEqual(topLanguages([{ B: 5, A: 5 }]).map((l) => l.name), ['A', 'B']);
  assert.deepEqual(topLanguages([]), []);
  assert.deepEqual(topLanguages([{ HTML: 5 }]), []);
});

test('the ignore list covers the languages the spec names', () => {
  for (const name of ['HTML', 'CSS', 'SCSS', 'SQL', 'PLpgSQL', 'TSQL', 'Shell', 'PowerShell', 'Batchfile', 'Dockerfile', 'Makefile']) {
    assert.ok(IGNORED_LANGUAGES.has(name), name);
  }
});

test('isCounted keeps only public, non-fork, non-archived repos', () => {
  assert.equal(isCounted({ fork: false, archived: false, private: false }), true);
  assert.equal(isCounted({ fork: true, archived: false, private: false }), false);
  assert.equal(isCounted({ fork: false, archived: true, private: false }), false);
  assert.equal(isCounted({ fork: false, archived: false, private: true }), false);
});

test('utcDate gives the UTC calendar day', () => {
  assert.equal(utcDate(new Date('2026-10-28T23:59:59-07:00')), '2026-10-29');
  assert.equal(utcDate(new Date('2026-10-28T00:00:00Z')), '2026-10-28');
});

test('the saved fixture shapes into a full page model', async () => {
  const data = await loadActivity({ ACTIVITY_FIXTURE: here('../fixtures/activity.json') });
  assert.equal(data.weeks.length, 53);
  assert.ok(data.weeks.slice(0, -1).every((w) => w.length === 7));
  assert.equal(data.languages.length, 5);
  assert.match(data.copyDate, /^\d{4}-\d{2}-\d{2}$/);
  const raw = JSON.parse(await readFile(here('../fixtures/activity.json'), 'utf8'));
  assert.deepEqual(data, shapeActivity(raw));
  const sum = data.weeks.flat().reduce((a, d) => a + d.count, 0);
  assert.equal(sum, data.total);
});

test('the edge-case fixtures pass the sanity checks and keep their promise', async () => {
  const load = (name) => loadActivity({ ACTIVITY_FIXTURE: here(`../fixtures/${name}.json`) });
  const big = await load('activity-12345');
  assert.equal(big.total, 12345);
  assert.equal(big.weeks.flat().reduce((a, d) => a + d.count, 0), 12345);
  const jupyter = await load('activity-jupyter');
  assert.ok(jupyter.languages.some((l) => l.name === 'Jupyter Notebook'));
  const zero = await load('activity-zero');
  assert.equal(zero.total, 0);
  assert.ok(zero.weeks.flat().every((d) => d.count === 0 && d.level === 0));
});

const goodData = () => ({
  total: 610,
  weeks: Array.from({ length: 53 }, () => []),
  languages: [{ name: 'Java', bytes: 1, percent: 100 }],
  copyDate: '2026-10-28',
});

test('checkActivity accepts a year of weeks, a language and an integer total', () => {
  assert.doesNotThrow(() => checkActivity(goodData()));
  assert.doesNotThrow(() => checkActivity({ ...goodData(), total: 0 }));
  assert.doesNotThrow(() => checkActivity({ ...goodData(), weeks: goodData().weeks.slice(0, 52) }));
});

test('checkActivity throws when there are fewer than 52 weeks', () => {
  assert.throws(() => checkActivity({ ...goodData(), weeks: goodData().weeks.slice(0, 51) }), /weeks/);
  assert.throws(() => checkActivity({ ...goodData(), weeks: [] }), /weeks/);
});

test('checkActivity throws when there are no languages', () => {
  assert.throws(() => checkActivity({ ...goodData(), languages: [] }), /languages/);
});

test('checkActivity throws when the total is not an integer', () => {
  for (const total of [undefined, null, '610', 610.5, NaN, Infinity, -1]) {
    assert.throws(() => checkActivity({ ...goodData(), total }), /total/, String(total));
  }
});

test('loadActivity fails on a calendar that is too short', async () => {
  const raw = JSON.parse(await readFile(here('../fixtures/activity.json'), 'utf8'));
  raw.calendar.weeks = raw.calendar.weeks.slice(0, 20);
  const file = join(await mkdtemp(join(tmpdir(), 'activity-')), 'short.json');
  await writeFile(file, JSON.stringify(raw));
  await assert.rejects(loadActivity({ ACTIVITY_FIXTURE: file }), /weeks/);
});

test('altText names the page, the total, the languages and the date', () => {
  const data = {
    ...goodData(),
    total: 624,
    languages: [
      { name: 'TypeScript', percent: 44 }, { name: 'Python', percent: 23 }, { name: 'Java', percent: 18 },
      { name: 'JavaScript', percent: 9 }, { name: 'Swift', percent: 6 },
    ],
  };
  assert.equal(
    altText(data),
    'Track 05, Activity. 624 contributions in the last year. Top languages: TypeScript 44%, Python 23%, Java 18%, JavaScript 9%, Swift 6%. Copied 2026-10-28. '
      + 'Track 06, Outro: Thanks to Neverland. And to everyone who read this far. See you at the next comeback. '
      + 'Tracklist: 01 We code Intro, 02 Member Profile, 03 Credits, 04 Title Track, 05 Activity, 06 Outro: Thanks to Neverland. Copyright 2026 Bao Tran.',
  );
});

test('altText keeps only letters, digits, spaces and the characters , . % : + # -', () => {
  const data = { ...goodData(), languages: [{ name: 'C++', percent: 50 }, { name: 'F*"<b>x</b>', percent: 30 }, { name: 'Objective-C', percent: 20 }, { name: 'Jupyter Notebook', percent: 1 }] };
  const alt = altText(data);
  assert.match(alt, /^[A-Za-z0-9 ,.%:+#-]+$/);
  assert.ok(alt.includes('C++ 50%'));
  assert.ok(alt.includes('Objective-C 20%'));
  assert.ok(alt.includes('Jupyter Notebook 1%'));
  assert.ok(!alt.includes('<') && !alt.includes('"') && !alt.includes('*'));
});

test('altText uses the singular for one contribution and handles zero', () => {
  assert.match(altText({ ...goodData(), total: 1 }), /1 contribution in the last year/);
  assert.match(altText({ ...goodData(), total: 0 }), /0 contributions in the last year/);
});

test('cleanAlt strips quotes, markup, line breaks and dashes that are not plain hyphens', () => {
  assert.equal(cleanAlt('a"b<c>d\ne\u2014f  g'), 'abcde' + 'f g');
  assert.equal(cleanAlt('  x  '), 'x');
});

test('the page builds elements with textContent and never uses innerHTML', async () => {
  const html = await readFile(here('../pages/activity.html'), 'utf8');
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(html));
});

test('loadActivity asks for a token when there is no fixture', async () => {
  await assert.rejects(loadActivity({}), /GITHUB_TOKEN/);
});

test('the outro words in the alt text use only the allowed characters and name every track', () => {
  assert.match(OUTRO_ALT, /^[A-Za-z0-9 ,.%:+#-]+$/);
  for (const track of ['We code', 'Member Profile', 'Credits', 'Title Track', 'Activity', 'Outro: Thanks to Neverland']) assert.ok(OUTRO_ALT.includes(track), track);
});

test('the alt text of the worst case stays within the limit of the daily job', async () => {
  const longest = { ...goodData(), total: 1234567, languages: Array.from({ length: 5 }, () => ({ name: 'Jupyter Notebook'.padEnd(40, 'x'), percent: 100 })) };
  assert.ok(altText(longest).length <= 800);
});

test('the daily job checks the same outro words and the size of the spread', async () => {
  const workflow = await readFile(here('../../.github/workflows/activity.yml'), 'utf8');
  const flat = workflow.replace(/"\s*\n\s*r"/g, '');
  assert.ok(flat.includes(OUTRO_ALT.replace(/\./g, '\\.')), 'the workflow template holds the outro words');
  assert.ok(workflow.includes('height != 750'), 'the workflow checks the height of the spread');
  const page = await readFile(here('../pages/activity.html'), 'utf8');
  assert.ok(page.includes('#page { height: 750px; }'), 'the page is as tall as the daily job expects');
});

test('every alt text from the edge-case fixtures matches the form that the daily job expects', async () => {
  const form = new RegExp(
    String.raw`^Track 05, Activity\. \d{1,7} contributions? in the last year\. Top languages: [A-Za-z0-9 +#.-]{1,40} \d{1,3}%(, [A-Za-z0-9 +#.-]{1,40} \d{1,3}%){0,4}\. Copied \d{4}-\d{2}-\d{2}\. `
      + OUTRO_ALT.replace(/[.]/g, String.raw`\.`) + '$',
  );
  for (const name of ['activity', 'activity-12345', 'activity-jupyter', 'activity-zero']) {
    const alt = altText(await loadActivity({ ACTIVITY_FIXTURE: here(`../fixtures/${name}.json`) }));
    assert.match(alt, form, name);
    assert.ok(alt.length <= 800, name);
  }
});
