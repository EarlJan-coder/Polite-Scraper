// TDD tests for discovery (src/discover.js) — Task 2.
// Fixture tests use committed HTML; crawl tests pre-seed a temp cache dir so
// no test ever touches the real site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

import { extractBookLinks, findNextPage, crawlCatalog } from '../src/discover.js';

const PAGE1_FIXTURE = 'test/fixtures/catalogue-page-1.html';
const REAL_PREFIX = 'https://books.toscrape.com/catalogue/';

function loadFixture(path) {
  return cheerio.load(readFileSync(path, 'utf8'));
}

// Synthetic three-page catalogue with a deliberate cross-page duplicate.
const SYNTHETIC = {
  'catalogue-page-1.html': `
    <ol class="row">
      <li><article class="product_pod"><h3><a href="../book/alpha_1/index.html">Alpha</a></h3></article></li>
      <li><article class="product_pod"><h3><a href="../book/beta_2/index.html">Beta</a></h3></article></li>
    </ol>
    <li class="next"><a href="page-2.html">next</a></li>`,
  'catalogue-page-2.html': `
    <ol class="row">
      <li><article class="product_pod"><h3><a href="../book/beta_2/index.html">Beta</a></h3></article></li>
      <li><article class="product_pod"><h3><a href="../book/gamma_3/index.html">Gamma</a></h3></article></li>
    </ol>
    <li class="next"><a href="page-3.html">next</a></li>`,
  'catalogue-page-3.html': `
    <ol class="row">
      <li><article class="product_pod"><h3><a href="../book/delta_4/index.html">Delta</a></h3></article></li>
    </ol>
    <li class="next"><a href="page-4.html">next</a></li>`,
  'catalogue-page-4.html': `
    <ol class="row">
      <li><article class="product_pod"><h3><a href="../book/epsilon_5/index.html">Epsilon</a></h3></article></li>
    </ol>`,
};

function seedCache(files) {
  const dir = mkdtempSync(join(tmpdir(), 'polite-scraper-discover-'));
  for (const [name, html] of Object.entries(files)) {
    writeFileSync(join(dir, name), `<html><body>${html}</body></html>`);
  }
  return dir;
}

test('extractBookLinks resolves every relative href to an absolute catalogue URL', () => {
  const $ = loadFixture(PAGE1_FIXTURE);
  const pageUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  const links = extractBookLinks($, pageUrl);
  assert.equal(links.length, 20, 'page 1 holds 20 books');
  assert.equal(new Set(links).size, 20, 'no duplicates within a page');
  for (const link of links) {
    assert.ok(link.startsWith(REAL_PREFIX), `not absolute/on-site: ${link}`);
  }
  assert.ok(links.includes(`${REAL_PREFIX}a-light-in-the-attic_1000/index.html`));
});

test('findNextPage returns the absolute URL of the next catalogue page', () => {
  const $ = loadFixture(PAGE1_FIXTURE);
  const next = findNextPage($, 'https://books.toscrape.com/catalogue/page-1.html');
  assert.equal(next, `${REAL_PREFIX}page-2.html`);
});

test('crawlCatalog stops at maxPages even when a next link exists', async () => {
  const { 'catalogue-page-4.html': _notSeeded, ...firstThree } = SYNTHETIC;
  const dir = seedCache(firstThree);
  try {
    const { pageUrls, bookUrls, sourcePageByBookUrl } = await crawlCatalog({
      startUrl: 'https://fake.test/catalogue/page-1.html',
      maxPages: 3,
      cacheDir: dir,
    });
    assert.equal(pageUrls.length, 3, 'exactly 3 pages crawled');
    assert.equal(pageUrls[0], 'https://fake.test/catalogue/page-1.html');
    // provenance: each book knows which catalogue page it was discovered on
    assert.equal(
      sourcePageByBookUrl.get('https://fake.test/book/alpha_1/index.html'),
      'https://fake.test/catalogue/page-1.html',
    );
    assert.equal(
      sourcePageByBookUrl.get('https://fake.test/book/delta_4/index.html'),
      'https://fake.test/catalogue/page-3.html',
    );
    assert.ok(!existsSync(join(dir, 'catalogue-page-4.html')), 'page 4 must never be fetched');
    // duplicate beta_2 across pages 1 and 2 counts once
    assert.deepEqual(
      [...bookUrls].sort(),
      [
        'https://fake.test/book/alpha_1/index.html',
        'https://fake.test/book/beta_2/index.html',
        'https://fake.test/book/delta_4/index.html',
        'https://fake.test/book/gamma_3/index.html',
      ].sort(),
      '4 unique book URLs from 3 pages with one duplicate',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('crawlCatalog stops when the catalogue itself says there is no next page', async () => {
  const dir = seedCache({
    'catalogue-page-1.html': SYNTHETIC['catalogue-page-1.html'],
    // final page: books but no next link
    'catalogue-page-2.html': `
      <ol class="row">
        <li><article class="product_pod"><h3><a href="../book/gamma_3/index.html">Gamma</a></h3></article></li>
      </ol>`,
  });
  try {
    const { pageUrls } = await crawlCatalog({
      startUrl: 'https://fake.test/catalogue/page-1.html',
      maxPages: 10,
      cacheDir: dir,
    });
    assert.equal(pageUrls.length, 2, 'crawl ends when next link disappears');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
