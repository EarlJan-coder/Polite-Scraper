// Polite-Scraper entry point.
import { crawlCatalog } from './discover.js';

// Stage 2: follow the catalogue's own "next" link through the first 3 pages
// and collect every unique book link.
const { pageUrls, bookUrls } = await crawlCatalog();

console.log(`catalogue pages crawled: ${pageUrls.length}`);
console.log(`unique book links found: ${bookUrls.length}`);
