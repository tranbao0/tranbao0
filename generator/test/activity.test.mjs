import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shapeCalendar, topLanguages, isCounted, utcDate, shapeActivity, loadActivity, IGNORED_LANGUAGES } from '../src/activity.mjs';

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
  const data = await loadActivity({ ACTIVITY_FIXTURE: new URL('../fixtures/activity.json', import.meta.url).pathname });
  assert.equal(data.weeks.length, 53);
  assert.ok(data.weeks.slice(0, -1).every((w) => w.length === 7));
  assert.equal(data.languages.length, 5);
  assert.match(data.copyDate, /^\d{4}-\d{2}-\d{2}$/);
  const raw = JSON.parse(await readFile(new URL('../fixtures/activity.json', import.meta.url), 'utf8'));
  assert.deepEqual(data, shapeActivity(raw));
  const sum = data.weeks.flat().reduce((a, d) => a + d.count, 0);
  assert.equal(sum, data.total);
});

test('loadActivity asks for a token when there is no fixture', async () => {
  await assert.rejects(loadActivity({}), /GITHUB_TOKEN/);
});
