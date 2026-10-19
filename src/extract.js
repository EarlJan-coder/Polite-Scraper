// Extraction: pull the raw record for one book page.
// Every selector is scoped to the product area — never "the first thing that
// looks like a price" in the whole document.
import * as cheerio from 'cheerio';

/** Cache file path for a product URL: .../a-light-in-the-attic_1000/index.html → cache/a-light-in-the-attic_1000.html */
export function bookCachePath(productUrl) {
  const parts = new URL(productUrl).pathname.split('/').filter(Boolean);
  const at = parts.lastIndexOf('catalogue');
  const slug = at >= 0 && parts[at + 1] ? parts[at + 1] : parts[parts.length - 2] ?? 'book';
  return `cache/${slug}.html`;
}

const collapse = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Build the raw record for one book page.
 * @param {import('cheerio').CheerioAPI} $
 * @param {{productUrl: string, sourcePage: string, fetchedAt: string}} provenance
 * @returns raw record exactly as TASK.md specifies; description is null when absent.
 */
export function extractRawRecord($, { productUrl, sourcePage, fetchedAt }) {
  const area = $('article.product_page');
  if (area.length === 0) {
    throw new Error('no product area (article.product_page) found — refusing to scrape the whole document');
  }
  const main = area.find('.product_main').first();

  const ratingClass = main.find('.star-rating').attr('class') ?? '';
  const ratingMatch = ratingClass.match(/star-rating\s+(\w+)/);

  const desc = area.find('#product_description').next('p').first();

  return {
    title: collapse(main.find('h1').text()),
    product_url: productUrl,
    price_text: collapse(main.find('.price_color').text()),
    availability_text: collapse(area.find('.product_main .availability').text()),
    rating_text: ratingMatch ? ratingMatch[1] : '',
    description: desc.length > 0 ? desc.text().trim() : null,
    source_page: sourcePage,
    fetched_at: fetchedAt,
  };
}
