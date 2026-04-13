// ============================================================
// src/db/client.js
// PostgreSQL client (via pg) + schema initialisation.
// Railway injects DATABASE_URL automatically.
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway Postgres requires SSL in production
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

/**
 * Create the items table if it does not already exist.
 * Called once at server startup.
 */
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id          SERIAL PRIMARY KEY,
      type        VARCHAR(20) NOT NULL CHECK (type IN ('meeting', 'task', 'note', 'idea')),
      title       TEXT        NOT NULL,
      content     TEXT,
      summary     TEXT,
      tags        TEXT[]      DEFAULT '{}',
      priority    VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high')),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { pool, initDb };
