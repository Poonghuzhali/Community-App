/**
 * Syntax gate for the Expo app: parses every .js/.jsx file with Babel so a
 * broken screen fails fast instead of crashing Metro at runtime.
 *   npm run lint
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.expo', 'dist', '.git']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      continue;
    }
    if (/\.(js|jsx)$/.test(entry.name)) files.push(path.join(dir, entry.name));
  }
}

walk(ROOT);

let failed = 0;
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (err) {
    failed += 1;
    console.error(`\n✖ ${path.relative(ROOT, file)}`);
    console.error(`  ${err.message}`);
  }
}

console.log(`\nChecked ${files.length} files • ${failed} with syntax errors`);
process.exit(failed ? 1 : 0);
