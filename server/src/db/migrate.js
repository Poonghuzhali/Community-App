const fs = require('fs');
const path = require('path');
const { createDb } = require('./pool');
const config = require('../config');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function migrate() {
  const db = createDb(config.sqlitePath);
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (now())
  )`);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const already = await db.one('SELECT name FROM schema_migrations WHERE name = $1', [file]);
    if (already) {
      console.log(`• skip  ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.tx(async (tx) => {
        await tx.exec(sql);
        await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      });
      console.log(`✓ apply ${file}`);
    } catch (err) {
      console.error(`✗ failed ${file}: ${err.message}`);
      await db.close();
      throw err;
    }
  }
  await db.close();
  console.log('Migrations complete.');
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrate };
