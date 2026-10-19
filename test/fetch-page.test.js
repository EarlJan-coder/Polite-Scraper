// TDD tests for fetchPage (src/http.js) — Task 1.
// All tests run against a local HTTP server; no test ever touches the real site.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fetchPage, FetchError } from '../src/http.js';
import { USER_AGENT, DELAY_MS } from '../src/config.js';

const hits = [];
const uaSeen = [];
const hitTimes = [];

const server = http.createServer((req, res) => {
  hits.push(req.url);
  uaSeen.push(req.headers['user-agent']);
  hitTimes.push(Date.now());
  if (req.url === '/page') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>catalogue</body></html>');
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});

let baseUrl;
let cacheDir;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  cacheDir = mkdtempSync(join(tmpdir(), 'polite-scraper-test-'));
});

test.after(() => {
  server.close();
  rmSync(cacheDir, { recursive: true, force: true });
});

test('fetchPage fetches a 200 page from network and writes the cache file', async () => {
  const cachePath = join(cacheDir, 'page.html');
  const result = await fetchPage(`${baseUrl}/page`, cachePath);
  assert.equal(result.status, 200);
  assert.equal(result.fromCache, false);
  assert.match(result.html, /<html>.*catalogue.*<\/html>/s);
  assert.ok(existsSync(cachePath), 'cache file should be written');
  assert.match(readFileSync(cachePath, 'utf8'), /catalogue/);
});

test('second call is served from cache without hitting the server', async () => {
  const cachePath = join(cacheDir, 'page.html');
  const hitsBefore = hits.length;
  const result = await fetchPage(`${baseUrl}/page`, cachePath);
  assert.equal(result.fromCache, true);
  assert.equal(result.status, 200);
  assert.equal(hits.length, hitsBefore, 'server must not be hit on cache read');
});

test('non-200 response rejects with FetchError carrying the status', async () => {
  const cachePath = join(cacheDir, 'missing.html');
  await assert.rejects(
    () => fetchPage(`${baseUrl}/missing`, cachePath),
    (err) => {
      assert.ok(err instanceof FetchError, `expected FetchError, got ${err}`);
      assert.equal(err.status, 404);
      return true;
    },
  );
  assert.equal(existsSync(cachePath), false, 'failed fetch must not write cache');
});

test('requests carry the honest User-Agent that names us', async () => {
  const hitsBefore = hits.length;
  await fetchPage(`${baseUrl}/page`, join(cacheDir, 'page2.html'));
  const uas = uaSeen.slice(hitsBefore);
  assert.ok(uas.length > 0, 'expected at least one request in this test');
  for (const ua of uas) assert.equal(ua, USER_AGENT);
});

test(`spaces real network requests at least ${DELAY_MS}ms apart`, async () => {
  const before = hitTimes.length;
  await fetchPage(`${baseUrl}/page`, join(cacheDir, 'gap-a.html'));
  await fetchPage(`${baseUrl}/page`, join(cacheDir, 'gap-b.html'));
  const [t1, t2] = hitTimes.slice(before);
  assert.ok(t1 && t2, 'expected two network hits in this test');
  assert.ok(t2 - t1 >= DELAY_MS - 50, `requests only ${t2 - t1}ms apart`);
});
