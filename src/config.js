// Shared configuration for the polite scraper.
export const BASE_URL = 'https://books.toscrape.com/';
export const CATALOGUE_URL = 'https://books.toscrape.com/catalogue/page-1.html';
// An honest user-agent that names us and links back to the repo.
export const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/EarlJan-coder/Polite-Scraper)';
export const TIMEOUT_MS = 10_000; // a request gives up after 10 seconds
export const DELAY_MS = 500; // at least half a second between real requests
export const MAX_PAGES = 3; // first 3 catalogue pages only
