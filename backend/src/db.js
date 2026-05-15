import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || `${__dirname}/../data/mining.db`;

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS pools (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unique_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS pool_hashrates (
    pool_slug TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    hashrate REAL NOT NULL,
    PRIMARY KEY (pool_slug, timestamp)
  );

  CREATE TABLE IF NOT EXISTS crypto_prices (
    coin_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    price_usd REAL NOT NULL,
    PRIMARY KEY (coin_id, timestamp)
  );

  CREATE TABLE IF NOT EXISTS correlations (
    pool_slug TEXT NOT NULL,
    coin_id TEXT NOT NULL,
    correlation REAL NOT NULL,
    sample_count INTEGER NOT NULL,
    computed_at INTEGER NOT NULL,
    PRIMARY KEY (pool_slug, coin_id)
  );
`);

export default db;
