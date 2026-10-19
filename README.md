# Polite-Scraper

A polite, cache-first scraper for **Books to Scrape**, built for the internship assignment in `TASK.md`.

## Target classification

- **Which site:** `https://books.toscrape.com/` — the Books to Scrape catalogue, part of toscrape.com.
- **Why this site:** toscrape.com describes itself as a "Web Scraping Sandbox", and its Books entry says: "A fictional bookstore that desperately wants to be scraped. It's a safe place for beginners learning web scraping and for developers validating their scraping technologies as well." (read with our own eyes on 2026-10-19). That sentence on their own page is our permission.
- **How much:** the first 3 catalogue pages only — about 60 of the site's 1000 books.
- **What data:** one record per book: title, product URL, price, availability, rating, description — plus provenance (`source_page` and `fetched_at` on every record).
- **Why that is appropriate here:** the site exists explicitly for scraping practice, so a sandbox built to be scraped is the only kind of target this assignment touches.

## robots.txt check

`GET https://books.toscrape.com/robots.txt` on 2026-10-19 returned **HTTP 404 → "no robots file found"**. A missing file is not permission — it is just a missing file.

## How to run

**Lane:** Node.js 22 + npm. No browser, no framework — built-in `fetch`, [Cheerio](https://github.com/cheeriojs/cheerio) for parsing, [Zod](https://zod.dev) for the schema.

```bash
npm install
node src/index.js
```

The first run downloads the pages and fills `cache/`; later runs read the cache instead of asking the site again. Output lands in `output/books.json`, `output/errors.json`, and `output/run-report.json`.

## Record schema

Every record in `output/books.json` (validated with Zod before it is stored):

```json
{
  "title": "A Light in the Attic",
  "product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "price_text": "£51.77",
  "price_gbp": 51.77,
  "availability_text": "In stock (22 available)",
  "rating_text": "Three",
  "description": "…or null when the page has none",
  "source_page": "https://books.toscrape.com/catalogue/page-1.html",
  "fetched_at": "2026-08-06T10:00:00.000Z"
}
```

- `price_text` is the raw text exactly as the page shows it; `price_gbp` is the same value as a real number — raw and clean live side by side.
- `product_url` is the record's identity: the same book twice counts once, so re-running produces the same records, never double.
- Records that fail the schema go to `output/errors.json` with the reason — they never enter `books.json`.

## Politeness rules the scraper follows

- **User-Agent:** `FlyRankInternship-A9/1.0 (+https://github.com/EarlJan-coder/Polite-Scraper)` — it names us and links back to this repo.
- **Delay:** at least 500 ms between real requests; cached pages need no delay because they never leave this computer.
- **Timeout:** every request gives up after 10 seconds — never waits forever.
- **Status check:** only HTTP 200 counts as a page; anything else is a failed fetch, not HTML to parse.
- **Retries:** one retry for timeouts and 5xx; never a retry for 404 or 403.
- **Cache:** `cache/` is read before the network is touched and is git-ignored — the site feels at most one visit per page.

## Limitation

It covers only the first 3 catalogue pages — 60 of the site's 1000 books — because that is the scope this assignment set, and `output/` reflects exactly that slice.

## Why no browser

The data is already in the HTML the server sends, so a browser would only add cost.

## Ethics note

Use an official API when one exists — it is faster, stabler, and the publisher's intended interface. Never bypass logins, paywalls, or blocks: if a site says no, take the no. Collect only what you need, identify yourself honestly, and leave the site as you found it.

## Run report

Pasted verbatim from `output/run-report.json` after the final verification run — this is the first full run, which fetched the 59 book pages it did not already hold (a re-run shows `pages_fetched: 0`, `cache_hits: 63`):

```json
{
  "started_at": "2026-10-19T11:14:56.735Z",
  "duration_ms": 53263,
  "pages_fetched": 59,
  "cache_hits": 4,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```
