// TDD tests for the retry policy and run report (src/http.js, src/report.js) — Task 5.
// No test touches the real site; the stats test runs against a local server.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { shouldRetry, fetchPage, getHttpStats, resetHttpStats } from '../src/http.js';
import { createReporter } from '../src/report.js';

test('shouldRetry: retries timeouts and 5xx exactly once', () => {
  assert.equal(shouldRetry(null, 1), true, 'timeout on first attempt → retry');
  assert.equal(shouldRetry(500, 1), true, '500 on first attempt → retry');
  assert.equal(shouldRetry(503, 1), true, '503 on first attempt → retry');
  assert.equal(shouldRetry(500, 2), false, 'second attempt → no more retries');
  assert.equal(shouldRetry(null, 2), false, 'timeout twice → give up');
});

test('shouldRetry: never retries a 404 or a 403', () => {
  assert.equal(shouldRetry(404, 1), false, 'the page does not exist — asking again will not create it');
  assert.equal(shouldRetry(403, 1), false, 'the site said no — asking again is how a polite robot becomes a pest');
  assert.equal(shouldRetry(400, 1), false, 'other 4xx are final too');
});

test('createReporter writes a run report with all seven honest numbers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'polite-scraper-report-'));
  try {
    resetHttpStats();
    const reporter = createReporter();
    reporter.addValid(59);
    reporter.addInvalid(1);
    reporter.failedPage();
    const reportPath = join(dir, 'run-report.json');
    reporter.write(reportPath);

    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    for (const field of [
      'started_at',
      'duration_ms',
      'pages_fetched',
      'cache_hits',
      'valid_records',
      'invalid_records',
      'failed_pages',
    ]) {
      assert.ok(field in report, `report missing field: ${field}`);
    }
    assert.equal(report.valid_records, 59);
    assert.equal(report.invalid_records, 1);
    assert.equal(report.failed_pages, 1);
    assert.equal(typeof report.duration_ms, 'number');
    assert.ok(report.duration_ms >= 0);
    assert.ok(Number.isFinite(Date.parse(report.started_at)), 'started_at must be ISO-parseable');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pages_fetched counts network fetches and cache_hits counts cache reads', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'polite-scraper-stats-'));
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>stats</html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    resetHttpStats();
    await fetchPage(`${base}/one`, join(dir, 'one.html')); // network
    await fetchPage(`${base}/one`, join(dir, 'one.html')); // cache
    assert.deepEqual(getHttpStats(), { network: 1, cache: 1 });

    const reportPath = join(dir, 'run-report.json');
    createReporter().write(reportPath);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(report.pages_fetched, 1);
    assert.equal(report.cache_hits, 1);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
