// TDD tests for extraction (src/extract.js) — Task 3.
// Fixture = one real cached detail page; synthetic HTML for the null-description
// and missing-product-area cases. No test touches the real site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

import { extractRawRecord, bookCachePath } from '../src/extract.js';

const FIXTURE = 'test/fixtures/book-a-light-in-the-attic.html';
const PRODUCT_URL = 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html';
const SOURCE_PAGE = 'https://books.toscrape.com/catalogue/page-1.html';
const FETCHED_AT = '2026-08-06T10:00:00Z';

function loadFixture(path) {
  return cheerio.load(readFileSync(path, 'utf8'));
}

test('extractRawRecord returns the exact raw record from a real book page', () => {
  const $ = loadFixture(FIXTURE);
  const record = extractRawRecord($, {
    productUrl: PRODUCT_URL,
    sourcePage: SOURCE_PAGE,
    fetchedAt: FETCHED_AT,
  });
  assert.deepEqual(record, {
    title: 'A Light in the Attic',
    product_url: PRODUCT_URL,
    price_text: '£51.77',
    availability_text: 'In stock (22 available)',
    rating_text: 'Three',
    description: record.description, // checked below
    source_page: SOURCE_PAGE,
    fetched_at: FETCHED_AT,
  });
  assert.equal(typeof record.description, 'string');
  assert.ok(record.description.length > 50, 'fixture book has a real description');
});

test('description is null when the page has no description section — never invented', () => {
  const $ = cheerio.load(`
    <article class="product_page">
      <div class="product_main">
        <h1>Untitled Book</h1>
        <p class="price_color">£10.00</p>
        <p class="availability">In stock (1 available)</p>
        <p class="star-rating One"></p>
      </div>
    </article>`);
  const record = extractRawRecord($, {
    productUrl: 'https://books.toscrape.com/catalogue/untitled-book_1/index.html',
    sourcePage: 'https://books.toscrape.com/catalogue/page-1.html',
    fetchedAt: FETCHED_AT,
  });
  assert.equal(record.description, null);
});

test('throws when the product area is missing instead of scraping the whole document', () => {
  const $ = cheerio.load('<html><body><p class="price_color">£99.99</p></body></html>');
  assert.throws(
    () =>
      extractRawRecord($, {
        productUrl: 'https://books.toscrape.com/catalogue/x_1/index.html',
        sourcePage: 'https://books.toscrape.com/catalogue/page-1.html',
        fetchedAt: FETCHED_AT,
      }),
    /product area/,
  );
});

test('bookCachePath maps a product URL to its cache file path', () => {
  assert.equal(bookCachePath(PRODUCT_URL), 'cache/a-light-in-the-attic_1000.html');
  assert.equal(
    bookCachePath('https://books.toscrape.com/catalogue/sipping-the-stars_999/index.html'),
    'cache/sipping-the-stars_999.html',
  );
});
