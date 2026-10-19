// Polite-Scraper entry point.
import { CATALOGUE_URL } from './config.js';
import { fetchPage } from './http.js';

// Stage 1: download the first catalogue page once and cache it.
const CATALOGUE_PAGE_1_CACHE = 'cache/catalogue-page-1.html';

const result = await fetchPage(CATALOGUE_URL, CATALOGUE_PAGE_1_CACHE);
console.log(`fetched ${CATALOGUE_URL} → status ${result.status}, fromCache: ${result.fromCache}`);
