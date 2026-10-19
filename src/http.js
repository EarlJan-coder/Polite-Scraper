// Polite HTTP layer: cache-first reads, honest user-agent, timeout, status
// check, and a minimum gap between real network requests.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { USER_AGENT, TIMEOUT_MS, DELAY_MS } from './config.js';

export class FetchError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'FetchError';
    this.status = status; // HTTP status, or null for network-level failures (e.g. timeout)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Timestamp of the last real network request, for the politeness delay.
let lastNetworkAt = 0;

/**
 * Fetch a page, reading from cache when possible.
 * Returns { html, fromCache, status }.
 * Throws FetchError on any status other than 200.
 */
export async function fetchPage(url, cachePath) {
  if (existsSync(cachePath)) {
    return { html: readFileSync(cachePath, 'utf8'), fromCache: true, status: 200 };
  }

  // Politeness: at least DELAY_MS between real requests. Cache misses only.
  const sinceLast = Date.now() - lastNetworkAt;
  if (sinceLast < DELAY_MS) await sleep(DELAY_MS - sinceLast);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } catch (err) {
    throw new FetchError(`request failed for ${url}: ${err.message}`, null);
  } finally {
    clearTimeout(timer);
  }
  lastNetworkAt = Date.now();

  if (res.status !== 200) {
    throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
  }

  const html = await res.text();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, html);
  return { html, fromCache: false, status: 200 };
}
