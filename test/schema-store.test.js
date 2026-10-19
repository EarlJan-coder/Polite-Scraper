// TDD tests for schema/normalization (src/schema.js) and storage (src/store.js) — Task 4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { normalizeRecord } from '../src/schema.js';
import { storeRecords } from '../src/store.js';

// The exact sample record from TASK.md, before cleaning.
const RAW_GOOD = {
  title: 'A Light in the Attic',
  product_url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html',
  price_text: '£51.77',
  availability_text: 'In stock (22 available)',
  rating_text: 'Three',
  description: 'To his mother’s dismay, Sam’s days of pencil-scribbling...',
  source_page: 'https://books.toscrape.com/catalogue/page-1.html',
  fetched_at: '2026-08-06T10:00:00Z',
};

function tmpOut() {
  return mkdtempSync(join(tmpdir(), 'polite-scraper-store-'));
}

test('normalizeRecord accepts a good raw record and adds price_gbp next to price_text', () => {
  const result = normalizeRecord(RAW_GOOD);
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(result.record.price_gbp, 51.77);
  assert.equal(result.record.price_text, '£51.77', 'raw value is kept beside the clean value');
  assert.equal(result.record.rating_text, 'Three');
});

test('normalizeRecord rejects a garbage price with a reason instead of NaN', () => {
  const result = normalizeRecord({ ...RAW_GOOD, price_text: 'cheap' });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.length > 0);
  assert.match(result.reasons.join(' '), /price_gbp/);
});

test('normalizeRecord accepts a null description — never invents text', () => {
  const result = normalizeRecord({ ...RAW_GOOD, description: null });
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(result.record.description, null);
});

test('normalizeRecord rejects a rating outside One..Five', () => {
  const result = normalizeRecord({ ...RAW_GOOD, rating_text: 'Six' });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' '), /rating_text/);
});

test('storeRecords dedupes by product_url and re-running replaces instead of appending', () => {
  const outDir = tmpOut();
  try {
    const a = { ...RAW_GOOD, price_gbp: 51.77 };
    const b = { ...RAW_GOOD, price_gbp: 51.77 }; // same product_url — counts once
    const c = { ...RAW_GOOD, product_url: 'https://books.toscrape.com/catalogue/other_1/index.html', price_gbp: 10.0 };
    const first = storeRecords({ valid: [a, b, c], invalid: [], outDir });
    assert.equal(first.valid, 2);
    // run it again — same records, not more
    const second = storeRecords({ valid: [a, b, c], invalid: [], outDir });
    assert.equal(second.valid, 2);
    const books = JSON.parse(readFileSync(join(outDir, 'books.json'), 'utf8'));
    assert.equal(books.length, 2, 'twice-run must not produce 4 records');
    const urls = books.map((r) => r.product_url);
    assert.equal(new Set(urls).size, 2, 'no duplicate product_url in output');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('storeRecords keeps the previous books.json when the run did not cover the full scope', () => {
  const outDir = tmpOut();
  try {
    const good = [{ ...RAW_GOOD, price_gbp: 51.77 }];
    storeRecords({ valid: good, invalid: [], outDir, scopeComplete: true });
    const before = readFileSync(join(outDir, 'books.json'), 'utf8');

    // A later run with broken discovery (e.g. catalogue page 1 failed) must not
    // clobber the last good output — re-running a failed job has to be safe.
    const result = storeRecords({
      valid: [],
      invalid: [{ raw: { ...RAW_GOOD, price_text: 'cheap' }, reasons: ['price_gbp: bad'] }],
      outDir,
      scopeComplete: false,
    });
    const after = readFileSync(join(outDir, 'books.json'), 'utf8');
    assert.equal(after, before, 'previous good books.json must be preserved');
    assert.equal(result.replacedBooks, false, 'report needs to know books were not replaced');
    const errors = JSON.parse(readFileSync(join(outDir, 'errors.json'), 'utf8'));
    assert.equal(errors.length, 1, 'errors.json still reflects this run');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('storeRecords routes invalid records to errors.json with their reasons, never to books.json', () => {
  const outDir = tmpOut();
  try {
    const bad = { ...RAW_GOOD, price_text: 'cheap' };
    const invalid = [{ raw: bad, reasons: ['price_gbp: Expected number, received NaN'] }];
    storeRecords({ valid: [{ ...RAW_GOOD, price_gbp: 51.77 }], invalid, outDir });

    const books = JSON.parse(readFileSync(join(outDir, 'books.json'), 'utf8'));
    assert.equal(books.length, 1);
    assert.ok(books.every((r) => r.price_text !== 'cheap'), 'bad record must not be in books.json');

    const errors = JSON.parse(readFileSync(join(outDir, 'errors.json'), 'utf8'));
    assert.equal(errors.length, 1);
    assert.equal(errors[0].raw.price_text, 'cheap');
    assert.match(errors[0].reasons.join(' '), /price_gbp/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
