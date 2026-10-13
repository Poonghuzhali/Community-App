const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const BOOLEAN_COLUMNS = new Set([
  'is_active',
  'is_occupied',
  'is_blocked',
  'is_pinned',
  'is_read',
]);

/**
 * Rewrite the small set of PostgreSQL expressions still used in services
 * into SQLite. Placeholders stay as $1 so they can be rebound to ?.
 */
function translateSql(sql) {
  let s = sql;
  s = s.replace(
    /NOW\(\)\s*\+\s*\(\s*(\$\d+)\s*\|\|\s*' minutes'\s*\)::interval/gi,
    "date_add(now(), '+' || $1 || ' minutes')"
  );
  s = s.replace(/NOW\(\)\s*([+-])\s*INTERVAL\s+'([^']+)'/gi, (_, sign, spec) => {
    return `date_add(now(), '${sign}${spec.trim()}')`;
  });
  s = s.replace(/(\b[\w.]+)::date\b/gi, 'substr($1, 1, 10)');
  s = s.replace(/::\s*(?:int|integer|text|uuid|timestamptz|timestamp|smallint|bigint|numeric|boolean|jsonb)\b/gi, '');
  s = s.replace(/\bILIKE\b/g, 'LIKE');
  s = replaceOutsideStrings(s, /\bTRUE\b/g, '1');
  s = replaceOutsideStrings(s, /\bFALSE\b/g, '0');
  return s;
}

function replaceOutsideStrings(sql, pattern, replacement) {
  return sql
    .split(/('(?:[^']|'')*')/g)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(pattern, replacement)))
    .join('');
}

/** `$1` can repeat; SQLite `?` is positional, so duplicate the bound value. */
function toPositional(sql, params = []) {
  const ordered = [];
  const text = sql.replace(/\$(\d+)/g, (_, n) => {
    const value = params[Number(n) - 1];
    ordered.push(value === undefined ? null : value);
    return '?';
  });
  return { text, params: ordered.map(bindValue) };
}

function bindValue(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function addInterval(base, spec) {
  const d = new Date(base || Date.now());
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid timestamp: ${base}`);
  const body = String(spec).trim().replace(/^[+-]/, '');
  const sign = String(spec).trim().startsWith('-') ? -1 : 1;
  const re = /(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours|day|days)/gi;
  let match;
  let found = false;
  while ((match = re.exec(body))) {
    found = true;
    const amount = sign * Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('minute')) d.setUTCMinutes(d.getUTCMinutes() + amount);
    else if (unit.startsWith('hour')) d.setUTCHours(d.getUTCHours() + amount);
    else d.setUTCDate(d.getUTCDate() + amount);
  }
  if (!found) throw new Error(`Unsupported interval: ${spec}`);
  return d.toISOString();
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (BOOLEAN_COLUMNS.has(key) && (value === 0 || value === 1)) out[key] = Boolean(value);
    else if (key === 'data' && typeof value === 'string' && /^[[{]/.test(value)) {
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
    } else out[key] = value;
  }
  return out;
}

function createDb(filename) {
  if (!filename) {
    throw new Error('SQLITE_PATH is not set.');
  }
  fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const database = new DatabaseSync(path.resolve(filename));
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA journal_mode = WAL');
  database.function('now', { deterministic: false }, () => new Date().toISOString());
  database.function('gen_random_uuid', { deterministic: false }, () => crypto.randomUUID());
  database.function('date_add', { deterministic: true }, (base, spec) => addInterval(base, spec));

  function execute(text, params = []) {
    const translated = translateSql(text);
    const positional = toPositional(translated, params);
    const stmt = database.prepare(positional.text);
    const returnsRows = /^\s*(select|with)\b/i.test(positional.text) || /\breturning\b/i.test(positional.text);
    if (returnsRows) {
      const rows = stmt.all(...positional.params).map(normalizeRow);
      return { rows, rowCount: rows.length };
    }
    const info = stmt.run(...positional.params);
    return { rows: [], rowCount: Number(info.changes || 0) };
  }

  const db = {
    file: path.resolve(filename),

    async query(text, params) {
      return execute(text, params);
    },

    async many(text, params) {
      return execute(text, params).rows;
    },

    async one(text, params) {
      return execute(text, params).rows[0] || null;
    },

    async scalar(text, params) {
      const row = execute(text, params).rows[0];
      if (!row) return null;
      return row[Object.keys(row)[0]];
    },

    /** Run a multi-statement script (migrations and seed files). */
    async exec(script) {
      database.exec(translateSql(script));
    },

    async tx(fn) {
      database.exec('BEGIN');
      try {
        const result = await fn(db);
        database.exec('COMMIT');
        return result;
      } catch (err) {
        database.exec('ROLLBACK');
        throw err;
      }
    },

    async close() {
      database.close();
    },
  };

  return db;
}

module.exports = { createDb, translateSql, addInterval };
