// Task 0 scaffold verification: files exist, README is UTF-8 and carries the
// required Target classification + robots.txt outcome, package.json is ESM.
import { readFileSync, existsSync } from 'node:fs';

const readme = readFileSync('README.md');
if (readme[0] === 0xff || readme[1] === 0xfe) throw new Error('README.md is UTF-16');
const text = readme.toString('utf8');
for (const s of [
  'Target classification',
  'no robots file found',
  'books.toscrape.com',
  'Web Scraping Sandbox',
  'first 3 catalogue pages',
]) {
  if (!text.includes(s)) throw new Error(`README.md missing: ${s}`);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.type !== 'module' || !pkg.scripts?.start) throw new Error('package.json wrong');

const gitignore = readFileSync('.gitignore', 'utf8');
if (!gitignore.includes('cache/') || !gitignore.includes('node_modules/'))
  throw new Error('.gitignore missing cache/ or node_modules/');

if (!existsSync('src/index.js')) throw new Error('src/index.js missing');

console.log('Task 0 scaffold checks: OK');
