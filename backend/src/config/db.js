import dotenv from 'dotenv';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const explicitPort = process.env.PORT;
const explicitDb = process.env.DATABASE_URL;
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (explicitPort) process.env.PORT = explicitPort;
if (explicitDb) process.env.DATABASE_URL = explicitDb;

let connStr = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/poms';

// Check database engine: MySQL vs PostgreSQL
const isMySQL = connStr.startsWith('mysql:') || connStr.startsWith('mysql://');

let pool = null;
let query = null;
let withTransaction = null;

if (isMySQL) {
  const mysql = await import('mysql2/promise');

  // Parse MySQL URL
  let parsedUrl;
  try {
    parsedUrl = new URL(connStr);
  } catch (_) {
    parsedUrl = new URL('mysql://root:@localhost:3306/poms');
  }

  const mysqlConfig = {
    host: parsedUrl.hostname || 'localhost',
    port: parseInt(parsedUrl.port || '3306', 10),
    user: parsedUrl.username || 'root',
    password: decodeURIComponent(parsedUrl.password || ''),
    database: parsedUrl.pathname.replace(/^\//, '') || 'poms',
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
  };

  const mysqlPool = mysql.default.createPool(mysqlConfig);

  function translateSql(text, params = []) {
    let sql = text;

    // Handle transaction keywords
    if (/^\s*BEGIN\s*$/i.test(sql)) return { sql: 'START TRANSACTION', params: [] };
    if (/^\s*COMMIT\s*$/i.test(sql)) return { sql: 'COMMIT', params: [] };
    if (/^\s*ROLLBACK\s*$/i.test(sql)) return { sql: 'ROLLBACK', params: [] };

    // Clean Postgres typecasts (e.g. ::int, ::text[], ::numeric(5,2))
    sql = sql.replace(/::[a-zA-Z0-9_]+(?:\([0-9,\s]+\))?(\[\])?/g, '');

    // Case insensitive ILIKE -> LIKE
    sql = sql.replace(/\bILIKE\b/g, 'LIKE');

    // gen_random_uuid() -> UUID()
    sql = sql.replace(/\bgen_random_uuid\(\)/gi, 'UUID()');

    // JSON functions
    sql = sql.replace(/\bjsonb_build_object\b/gi, 'JSON_OBJECT');
    sql = sql.replace(/\bjson_build_object\b/gi, 'JSON_OBJECT');
    sql = sql.replace(/\bjsonb_agg\b/gi, 'JSON_ARRAYAGG');
    sql = sql.replace(/\bjson_agg\b/gi, 'JSON_ARRAYAGG');
    sql = sql.replace(/COALESCE\s*\(([^,]+),\s*'\s*\[\s*\]\s*'\)/gi, 'COALESCE($1, JSON_ARRAY())');
    sql = sql.replace(/COALESCE\s*\(([^,]+),\s*'\s*\{\s*\}\s*'\)/gi, 'COALESCE($1, JSON_OBJECT())');
    // string_agg(expr, sep) -> GROUP_CONCAT(expr SEPARATOR sep)
    sql = sql.replace(/\bstring_agg\s*\(([^,]+),\s*('[^']*')\)/gi, 'GROUP_CONCAT($1 SEPARATOR $2)');

    // date_trunc('day'|'month', now()) -> CURDATE() / DATE_FORMAT(...)
    sql = sql.replace(/date_trunc\s*\(\s*'day'\s*,\s*now\(\)\s*\)/gi, 'CURDATE()');
    sql = sql.replace(/date_trunc\s*\(\s*'month'\s*,\s*now\(\)\s*\)/gi, "DATE_FORMAT(NOW(), '%Y-%m-01')");

    // interval '<num> <unit>(s)' -> INTERVAL <num> <UNIT>
    sql = sql.replace(/interval\s*'([0-9]+)\s*([a-zA-Z]+?)s?'/gi, (match, num, unit) => {
      return `INTERVAL ${num} ${unit.toUpperCase().replace(/S$/, '')}`;
    });

    // to_char translation for MySQL DATE_FORMAT
    sql = sql.replace(/to_char\s*\(([^,]+),\s*'YYYY-MM-DD'\)/gi, "DATE_FORMAT($1, '%Y-%m-%d')");
    sql = sql.replace(/to_char\s*\(([^,]+),\s*'YYYY-MM'\)/gi, "DATE_FORMAT($1, '%Y-%m')");
    sql = sql.replace(/to_char\s*\(([^,]+),\s*'Mon'\)/gi, "DATE_FORMAT($1, '%b')");

    // Robust FILTER (WHERE ...) clause translation for MySQL
    let filterIdx = 0;
    while ((filterIdx = sql.search(/FILTER\s*\(/i)) !== -1) {
      let openParen = sql.indexOf('(', filterIdx);
      let depth = 1;
      let endParen = openParen + 1;
      while (endParen < sql.length && depth > 0) {
        if (sql[endParen] === '(') depth++;
        else if (sql[endParen] === ')') depth--;
        endParen++;
      }
      const filterClause = sql.substring(filterIdx, endParen);
      const innerWhere = filterClause.replace(/^FILTER\s*\(\s*WHERE\s+/i, '').replace(/\s*\)$/, '');

      const before = sql.substring(0, filterIdx).trimEnd();
      if (/count\s*\(\s*\*\s*\)$/i.test(before)) {
        const match = before.match(/count\s*\(\s*\*\s*\)$/i);
        const startAgg = before.lastIndexOf(match[0]);
        const replacement = `COUNT(CASE WHEN ${innerWhere} THEN 1 END)`;
        sql = sql.substring(0, startAgg) + replacement + sql.substring(endParen);
      } else if (/SUM\s*\(([^)]+)\)$/i.test(before)) {
        const match = before.match(/SUM\s*\(([^)]+)\)$/i);
        const startAgg = before.lastIndexOf(match[0]);
        const expr = match[1];
        const replacement = `SUM(CASE WHEN ${innerWhere} THEN ${expr} ELSE 0 END)`;
        sql = sql.substring(0, startAgg) + replacement + sql.substring(endParen);
      } else {
        sql = sql.substring(0, filterIdx) + sql.substring(endParen);
      }
    }
    sql = sql.replace(/JSON_ARRAYAGG\s*\(\s*DISTINCT\s+([a-zA-Z0-9_.]+)\s*\)/gi, 'JSON_ARRAYAGG($1)');

    // Backtick reserved keyword `key` in settings table
    sql = sql.replace(/\bsettings\s*\(\s*key\s*,/gi, 'settings (`key`,');
    sql = sql.replace(/\bINSERT\s+INTO\s+settings\s*\(\s*key\s*,/gi, 'INSERT INTO settings (`key`,');
    sql = sql.replace(/\bWHERE\s+key\s*=/gi, 'WHERE `key` =');
    sql = sql.replace(/\bWHERE\s+s\.key\s*=/gi, 'WHERE s.`key` =');

    // ON CONFLICT DO NOTHING -> INSERT IGNORE
    if (sql.match(/ON\s+CONFLICT[\s\S]*?DO\s+NOTHING/i)) {
      sql = sql.replace(/\bINSERT\s+INTO\s+/i, 'INSERT IGNORE INTO ');
      sql = sql.replace(/ON\s+CONFLICT[\s\S]*?DO\s+NOTHING/gi, '');
    }

    // ON CONFLICT (...) DO UPDATE SET ... = EXCLUDED.col -> ON DUPLICATE KEY UPDATE ... = VALUES(col)
    sql = sql.replace(/ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+UPDATE\s+SET/gi, 'ON DUPLICATE KEY UPDATE');
    sql = sql.replace(/\bEXCLUDED\.([a-zA-Z0-9_]+)/gi, 'VALUES($1)');

    // = ANY($X) -> IN ($X)
    sql = sql.replace(/=\s*ANY\s*\(\s*\$([0-9]+)\s*\)/gi, 'IN ($$$1)');

    // Postgres snapshots in purchaseOrders
    sql = sql.replace(/to_jsonb\(p\.\*\)\s*-\s*'attributes'/gi, "JSON_OBJECT('id', p.id, 'sku', p.sku, 'name', p.name, 'brand_id', p.brand_id, 'hsn_sac', p.hsn_sac)");
    sql = sql.replace(/to_jsonb\(b\.\*\)\s*-\s*'id'/gi, "JSON_OBJECT('brand_name', b.brand_name, 'brand_code', b.brand_code)");
    sql = sql.replace(/to_jsonb\(c\.\*\)/gi, "JSON_OBJECT('code', c.code, 'name', c.name, 'swatch_hex', c.swatch_hex)");

    // Check for RETURNING clause
    const returningMatch = sql.match(/\s+RETURNING\s+([\s\S]+)$/i);
    let returningCols = null;
    if (returningMatch) {
      returningCols = returningMatch[1].trim();
      sql = sql.slice(0, returningMatch.index).trim();
    }

    // Map positional parameters $1, $2, ... to ?
    let newParams = [];
    if (params && params.length > 0) {
      sql = sql.replace(/\$([0-9]+)/g, (match, num) => {
        const idx = parseInt(num, 10) - 1;
        newParams.push(params[idx]);
        return '?';
      });
    }

    return { sql: sql.trim(), params: newParams, returningCols };
  }

  async function executeOnConn(conn, text, params = []) {
    let { sql, params: mappedParams, returningCols } = translateSql(text, params);

    const isInsert = /^\s*INSERT(?:\s+IGNORE)?\s+INTO\s+/i.test(sql);
    const isUpdate = /^\s*UPDATE\s+/i.test(sql);
    let generatedId = null;

    if (isInsert && returningCols) {
      const tableMatch = sql.match(/^\s*INSERT(?:\s+IGNORE)?\s+INTO\s+([a-zA-Z0-9_`]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (tableMatch) {
        const colList = tableMatch[2].split(',').map(c => c.trim().replace(/`/g, ''));
        if (!colList.includes('id')) {
          generatedId = crypto.randomUUID();
          sql = sql.replace(
            /^\s*(INSERT(?:\s+IGNORE)?\s+INTO\s+[a-zA-Z0-9_`]+\s*)\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
            `$1(id, $2) VALUES (?, $3)`
          );
          mappedParams = [generatedId, ...mappedParams];
        }
      }
    }

    const [result] = await conn.query(sql, mappedParams);

    function sanitizeRows(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return rows;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== 'object') continue;
        for (const k of Object.keys(row)) {
          const val = row[k];
          if (typeof val === 'string' && val.length >= 2) {
            const first = val[0];
            const last = val[val.length - 1];
            if ((first === '[' && last === ']') || (first === '{' && last === '}')) {
              try {
                row[k] = JSON.parse(val);
              } catch (_) {}
            }
          }
        }
      }
      return rows;
    }

    if (returningCols) {
      if (isInsert) {
        const tableMatch = sql.match(/^\s*INSERT(?:\s+IGNORE)?\s+INTO\s+([a-zA-Z0-9_`]+)/i);
        const tableName = tableMatch ? tableMatch[1] : null;
        const targetId = generatedId || (params && params[0]);
        if (tableName && targetId) {
          const [rows] = await conn.query(`SELECT * FROM ${tableName} WHERE id = ?`, [targetId]);
          return { rows: sanitizeRows(rows), rowCount: rows.length };
        }
      } else if (isUpdate) {
        const tableMatch = sql.match(/^\s*UPDATE\s+([a-zA-Z0-9_`]+)/i);
        const tableName = tableMatch ? tableMatch[1] : null;
        // In most updates with RETURNING, the ID is the first or last param
        const idParam = params && (params[params.length - 1] || params[0]);
        if (tableName && idParam) {
          const [rows] = await conn.query(`SELECT * FROM ${tableName} WHERE id = ?`, [idParam]);
          return { rows: sanitizeRows(rows), rowCount: rows.length };
        }
      }
    }

    if (Array.isArray(result)) {
      return { rows: sanitizeRows(result), rowCount: result.length };
    } else {
      return { rows: [], rowCount: result ? (result.affectedRows || 0) : 0 };
    }
  }

  pool = {
    async query(text, params) {
      return executeOnConn(mysqlPool, text, params);
    },
    async connect() {
      const conn = await mysqlPool.getConnection();
      return {
        query: (text, params) => executeOnConn(conn, text, params),
        release: () => conn.release(),
      };
    },
    async end() {
      return mysqlPool.end();
    },
  };

  query = (text, params) => pool.query(text, params);

  withTransaction = async function(fn) {
    const client = await pool.connect();
    try {
      await client.query('START TRANSACTION');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

} else {
  // PostgreSQL Driver (pg)
  const pg = await import('pg');

  // Resilience: auto-correct accidental port 5433 to standard 5432 for localhost
  if (connStr.includes('localhost:5433') || connStr.includes('127.0.0.1:5433')) {
    connStr = connStr.replace(':5433', ':5432');
  }

  if (connStr.includes('postgresql://postgres@localhost') || connStr.includes('postgresql://postgres@127.0.0.1')) {
    connStr = connStr.replace('postgresql://postgres@', 'postgresql://postgres:postgres@');
  }

  let isLocal = false;
  try {
    const parsed = new URL(connStr);
    isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
  } catch (_) {
    isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');
  }

  const needsSsl = !isLocal || connStr.includes('sslmode=require') || connStr.includes('supabase') || connStr.includes('neon.tech');

  pool = new pg.default.Pool({
    connectionString: connStr,
    max: 10,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  });

  query = (text, params) => pool.query(text, params);

  withTransaction = async function(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };
}

export { pool, query, withTransaction };
