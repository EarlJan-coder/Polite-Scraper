// Discovery: find every book link on a catalogue page and follow the
// catalogue's own "next" link until the pages run out (or maxPages).
import * as cheerio from 'cheerio';
import { join } from 'node:path';

import { CATALOGUE_URL, MAX_PAGES } from './config.js';
import { fetchPage } from './http.js';

/** Absolute URLs of every book link on one catalogue page. */
export function extractBookLinks($, pageUrl) {
  return $('ol.row .product_pod h3 a')
    .map((_, el) => new URL($(el).attr('href'), pageUrl).href)
    .get();
}

/** Absolute URL of the catalogue's own next-page link, or null at the end. */
export function findNextPage($, pageUrl) {
  const href = $('li.next a').attr('href');
  return href ? new URL(href, pageUrl).href : null;
}

/**
 * Crawl up to maxPages catalogue pages starting at startUrl.
 * Follows the site's own next links (no hardcoded page URLs), deduplicates
 * book links, and caches every page under cacheDir.
 * Returns { pageUrls, bookUrls, sourcePageByBookUrl } — the map records which
 * catalogue page each book was first discovered on (provenance for records).
 */
export async function crawlCatalog({
  startUrl = CATALOGUE_URL,
  maxPages = MAX_PAGES,
  cacheDir = 'cache',
  reporter = null,
} = {}) {
  const pageUrls = [];
  const bookUrls = new Set();
  const sourcePageByBookUrl = new Map();
  let nextUrl = startUrl;

  while (nextUrl && pageUrls.length < maxPages) {
    const pageUrl = nextUrl;
    const cachePath = join(cacheDir, `catalogue-page-${pageUrls.length + 1}.html`);
    let html;
    try {
      ({ html } = await fetchPage(pageUrl, cachePath));
    } catch (err) {
      // One broken catalogue page is logged and skipped — it must not kill the run.
      console.error(`catalogue page failed: ${pageUrl} — ${err.message}`);
      reporter?.failedPage();
      break; // without this page we cannot follow its next link
    }
    const $ = cheerio.load(html);

    pageUrls.push(pageUrl);
    for (const link of extractBookLinks($, pageUrl)) {
      if (!sourcePageByBookUrl.has(link)) sourcePageByBookUrl.set(link, pageUrl);
      bookUrls.add(link);
    }
    nextUrl = findNextPage($, pageUrl);
  }

  return { pageUrls, bookUrls: [...bookUrls], sourcePageByBookUrl };
}
