// Final verification — run only after all stages are built and tested.
// Checks the shipped evidence: output files, README sections, and git history.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const failures = [];
function check(name, ok, detail = '') {
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

// --- output/books.json: 60 clean records with provenance ---
const books = JSON.parse(readFileSync('output/books.json', 'utf8'));
check('books.json has 60 records', books.length === 60, `got ${books.length}`);
check('product_url is unique', new Set(books.map((b) => b.product_url)).size === books.length);
const RATINGS = ['One', 'Two', 'Three', 'Four', 'Five'];
for (const b of books) {
  for (const f of [
    'title',
    'product_url',
    'price_text',
    'availability_text',
    'rating_text',
    'source_page',
    'fetched_at',
  ]) {
    if (typeof b[f] !== 'string' || !b[f]) check(`record ${b.product_url} has ${f}`);
  }
  if (typeof b.price_gbp !== 'number' || !(b.price_gbp > 0))
    check(`record ${b.product_url} has numeric price_gbp`);
  if (!(b.description === null || typeof b.description === 'string'))
    check(`record ${b.product_url} description must be string or null`);
  if (!RATINGS.includes(b.rating_text)) check(`record ${b.product_url} rating_text`);
  if (!b.product_url.startsWith('https://books.toscrape.com/'))
    check(`record ${b.product_url} not on-site`);
}
check('price_text kept beside price_gbp', books.every((b) => /[£\d]/.test(b.price_text)));

// --- output/errors.json: none from the clean run ---
const errors = JSON.parse(readFileSync('output/errors.json', 'utf8'));
check('errors.json is empty after clean run', Array.isArray(errors) && errors.length === 0);

// --- output/run-report.json: seven honest numbers from the clean run ---
const report = JSON.parse(readFileSync('output/run-report.json', 'utf8'));
for (const f of [
  'started_at',
  'duration_ms',
  'pages_fetched',
  'cache_hits',
  'valid_records',
  'invalid_records',
  'failed_pages',
]) {
  check(`run-report has ${f}`, f in report);
}
check('report: 60 valid', report.valid_records === 60, `${report.valid_records}`);
check('report: 0 failed pages on clean run', report.failed_pages === 0, `${report.failed_pages}`);
check('report: 0 invalid', report.invalid_records === 0, `${report.invalid_records}`);

// --- README: every required section, plus the real run-report paste ---
const readme = readFileSync('README.md', 'utf8');
for (const s of [
  'Target classification',
  'no robots file found',
  'How to run',
  'npm install',
  'Record schema',
  'price_gbp',
  'Politeness rules',
  'FlyRankInternship-A9/1.0',
  'Limitation',
  'Why no browser',
  'Ethics note',
  '"started_at"',
  '"valid_records"',
]) {
  check(`README contains: ${s}`, readme.includes(s));
}
check('README run-report placeholder replaced', !readme.includes('RUN_REPORT'));

// --- git: sample outputs committed, cache ignored, stage messages present ---
const tracked = execSync('git ls-files', { encoding: 'utf8' });
check('cache/ files are NOT committed', !tracked.split('\n').some((f) => f.startsWith('cache/')));
check('output/books.json is committed', tracked.includes('output/books.json'));
check('output/run-report.json is committed', tracked.includes('output/run-report.json'));
const log = execSync('git log --format=%s', { encoding: 'utf8' });
for (const msg of [
  'Stage 0: classify scraping target',
  'Stage 1: fetch and cache HTML',
  'Stage 2: discover three catalogue pages',
  'Stage 3: extract book details',
  'Stage 4: validate normalized records',
  'Stage 5: survive failures, report the run',
  'Stage 6: publish scraper evidence — then push everything',
]) {
  check(`commit message present: ${msg}`, log.includes(msg));
}

if (failures.length) {
  console.error(`FINAL VERIFICATION: ${failures.length} FAILED`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('FINAL VERIFICATION: all checks passed (60 records, report, README, git evidence)');
