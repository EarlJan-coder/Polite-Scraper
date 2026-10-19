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
 * Returns { pageUrls: string[], bookUrls: string[] }.
 */
export async function crawlCatalog({
  startUrl = CATALOGUE_URL,
  maxPages = MAX_PAGES,
  cacheDir = 'cache',
} = {}) {
  const pageUrls = [];
  const bookUrls = new Set();
  let nextUrl = startUrl;

  while (nextUrl && pageUrls.length < maxPages) {
    const pageUrl = nextUrl;
    const cachePath = join(cacheDir, `catalogue-page-${pageUrls.length + 1}.html`);
    const { html } = await fetchPage(pageUrl, cachePath);
    const $ = cheerio.load(html);

    pageUrls.push(pageUrl);
    for (const link of extractBookLinks($, pageUrl)) bookUrls.add(link);
    nextUrl = findNextPage($, pageUrl);
  }

  return { pageUrls, bookUrls: [...bookUrls] };
}
