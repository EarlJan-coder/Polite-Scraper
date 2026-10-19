// The run report: a few honest numbers written at the end of every run, so a
// scraper can never fail silently for weeks.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { getHttpStats } from './http.js';

export function createReporter() {
  const startedMs = Date.now();
  const started_at = new Date(startedMs).toISOString();
  let valid_records = 0;
  let invalid_records = 0;
  let failed_pages = 0;

  return {
    addValid(n = 1) {
      valid_records += n;
    },
    addInvalid(n = 1) {
      invalid_records += n;
    },
    failedPage() {
      failed_pages += 1;
    },
    /**
     * Write output/run-report.json and return the report object.
     * pages_fetched = pages that came over the network this run;
     * cache_hits = pages served from the local cache.
     */
    write(reportPath = 'output/run-report.json') {
      const http = getHttpStats();
      const report = {
        started_at,
        duration_ms: Date.now() - startedMs,
        pages_fetched: http.network,
        cache_hits: http.cache,
        valid_records,
        invalid_records,
        failed_pages,
      };
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
      return report;
    },
  };
}
