// Storage: valid records go to output/books.json keyed by product_url;
// invalid ones go to output/errors.json with their reasons — never into books.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Write the run's records. Each file is replaced, never appended to, so
 * running the scraper twice produces the same records — not double.
 * @param {{valid: object[], invalid: {raw: object, reasons: string[]}[], outDir?: string, scopeComplete?: boolean}} args
 *   scopeComplete: false when the crawler did not cover the full scoped crawl
 *   (e.g. a catalogue page failed) — then the previous books.json is preserved
 *   instead of being clobbered by an empty or partial result; errors.json
 *   still reflects this run.
 * @returns {{valid: number, invalid: number, replacedBooks: boolean}} counts actually written
 */
export function storeRecords({ valid, invalid, outDir = 'output', scopeComplete = true } = {}) {
  mkdirSync(outDir, { recursive: true });

  // Identity is the absolute product_url: the same book twice counts once.
  const byUrl = new Map();
  for (const record of valid) {
    if (!byUrl.has(record.product_url)) byUrl.set(record.product_url, record);
  }

  const replacedBooks = scopeComplete;
  if (scopeComplete) {
    writeFileSync(join(outDir, 'books.json'), JSON.stringify([...byUrl.values()], null, 2) + '\n');
  }
  writeFileSync(join(outDir, 'errors.json'), JSON.stringify(invalid, null, 2) + '\n');

  return { valid: byUrl.size, invalid: invalid.length, replacedBooks };
}
