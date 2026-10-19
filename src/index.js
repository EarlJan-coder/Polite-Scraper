// Polite-Scraper entry point.
import * as cheerio from 'cheerio';

import { crawlCatalog } from './discover.js';
import { fetchPage } from './http.js';
import { extractRawRecord, bookCachePath } from './extract.js';
import { normalizeRecord } from './schema.js';
import { storeRecords } from './store.js';
import { createReporter } from './report.js';
import { MAX_PAGES } from './config.js';

// One made-up URL, used only on purpose (--demo-bad-url) to prove that a bad
// page is logged and skipped instead of killing the run. Never tests failure
// by hammering the real site: a single request, no retry on the 404.
const DEMO_BAD_URL = 'https://books.toscrape.com/catalogue/this-book-does-not-exist_999999/index.html';

const reporter = createReporter();

try {
  // Stage 2: follow the catalogue's own "next" link through the first 3 pages.
  const { pageUrls, bookUrls, sourcePageByBookUrl } = await crawlCatalog({ reporter });
  console.log(`catalogue pages crawled: ${pageUrls.length}`);
  console.log(`unique book links found: ${bookUrls.length}`);

  const targets = [...bookUrls];
  if (process.argv.includes('--demo-bad-url')) {
    targets.push(DEMO_BAD_URL);
    console.log('demo: injected one made-up book URL to prove one bad page cannot kill the run');
  }

  // Stage 3: open every book page and collect the raw records, with the same
  // politeness as the catalogue fetch (user-agent, timeout, status, delay).
  const rawRecords = [];
  for (const productUrl of targets) {
    const sourcePage = sourcePageByBookUrl.get(productUrl) ?? pageUrls[0] ?? null;
    try {
      const { html, fetchedAt } = await fetchPage(productUrl, bookCachePath(productUrl));
      const $ = cheerio.load(html);
      rawRecords.push(
        extractRawRecord($, {
          productUrl,
          sourcePage,
          fetchedAt, // when the fact was actually retrieved — the provenance receipt
        }),
      );
    } catch (err) {
      // One bad page is logged and skipped — the good records survive it.
      console.error(`book page failed: ${productUrl} — ${err.message}`);
      reporter.failedPage();
    }
  }
  console.log(`raw records extracted: ${rawRecords.length}`);

  // Stage 4: clean, validate, store. Records that fail the schema go to
  // errors.json with their reasons — they never sneak into books.json.
  const valid = [];
  const invalid = [];
  for (const raw of rawRecords) {
    const result = normalizeRecord(raw);
    if (result.ok) valid.push(result.record);
    else invalid.push({ raw, reasons: result.reasons });
  }

  // Only replace books.json when the crawl covered the full scope — a failed
  // run must never destroy the last good output.
  const scopeComplete = pageUrls.length === MAX_PAGES;
  const stored = storeRecords({ valid, invalid, scopeComplete });
  if (!scopeComplete) {
    console.error('incomplete catalogue crawl — kept the previous output/books.json');
  }
  reporter.addValid(stored.valid);
  reporter.addInvalid(stored.invalid);
  console.log(`valid records: ${stored.valid}, invalid: ${stored.invalid}`);
} finally {
  // Stage 5: every run ends by writing the honest numbers.
  const report = reporter.write();
  console.log(`run report: ${JSON.stringify(report)}`);
}
