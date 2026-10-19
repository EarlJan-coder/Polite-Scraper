// Polite-Scraper entry point.
import * as cheerio from 'cheerio';

import { crawlCatalog } from './discover.js';
import { fetchPage } from './http.js';
import { extractRawRecord, bookCachePath } from './extract.js';
import { normalizeRecord } from './schema.js';
import { storeRecords } from './store.js';

// Stage 2: follow the catalogue's own "next" link through the first 3 pages.
const { pageUrls, bookUrls, sourcePageByBookUrl } = await crawlCatalog();
console.log(`catalogue pages crawled: ${pageUrls.length}`);
console.log(`unique book links found: ${bookUrls.length}`);

// Stage 3: open every book page and collect the raw records, with the same
// politeness as the catalogue fetch (user-agent, timeout, status, delay).
const rawRecords = [];
for (const productUrl of bookUrls) {
  const sourcePage = sourcePageByBookUrl.get(productUrl) ?? pageUrls[0];
  const { html } = await fetchPage(productUrl, bookCachePath(productUrl));
  const $ = cheerio.load(html);
  rawRecords.push(
    extractRawRecord($, {
      productUrl,
      sourcePage,
      fetchedAt: new Date().toISOString(),
    }),
  );
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

const stored = storeRecords({ valid, invalid });
console.log(`valid records: ${stored.valid}, invalid: ${stored.invalid}`);
