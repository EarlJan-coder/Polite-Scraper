// Polite HTTP layer: cache-first reads, honest user-agent, timeout, status
// check, a minimum gap between real network requests, and exactly one retry
// for timeouts and 5xx — never for 404/403.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  USER_AGENT,
  TIMEOUT_MS,
  DELAY_MS,
  MAX_ATTEMPTS,
  RETRY_PAUSE_MS,
} from './config.js';

export class FetchError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'FetchError';
    this.status = status; // HTTP status, or null for network-level failures (e.g. timeout)
  }
}

/**
 * Retry policy: one retry for timeouts and 5xx, never for 404 (it does not
 * exist) or 403 (the site said no), and never after the first retry.
 * @param {number|null} status HTTP status, or null for a timeout/network failure
 * @param {number} attempt 1-based attempt just made
 */
export function shouldRetry(status, attempt) {
  if (attempt >= MAX_ATTEMPTS) return false;
  if (status === null) return true; // timeout / network failure
  return status >= 500 && status <= 599;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Timestamp of the last real network request, for the politeness delay.
let lastNetworkAt = 0;

// How this run's pages were obtained: over the network vs from cache.
const stats = { network: 0, cache: 0 };
export function getHttpStats() {
  return { ...stats };
}
export function resetHttpStats() {
  stats.network = 0;
  stats.cache = 0;
}

/**
 * Fetch a page, reading from cache when possible.
 * Returns { html, fromCache, status }.
 * Throws FetchError on any status other than 200 after the allowed attempts.
 */
export async function fetchPage(url, cachePath) {
  if (existsSync(cachePath)) {
    stats.cache += 1;
    return { html: readFileSync(cachePath, 'utf8'), fromCache: true, status: 200 };
  }

  for (let attempt = 1; ; attempt += 1) {
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
      lastNetworkAt = Date.now();
      const failure = new FetchError(`request failed for ${url}: ${err.message}`, null);
      if (shouldRetry(null, attempt)) {
        await sleep(RETRY_PAUSE_MS);
        continue;
      }
      throw failure;
    } finally {
      clearTimeout(timer);
    }
    lastNetworkAt = Date.now();

    if (res.status !== 200) {
      if (shouldRetry(res.status, attempt)) {
        await sleep(RETRY_PAUSE_MS);
        continue;
      }
      throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
    }

    const html = await res.text();
    stats.network += 1;
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, html);
    return { html, fromCache: false, status: 200 };
  }
}
