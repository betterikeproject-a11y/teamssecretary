// ============================================================
// src/db/client.js
// PostgreSQL client (via pg) + schema initialisation.
// Railway injects DATABASE_URL automatically.
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Use SSL whenever a remote DATABASE_URL is set (Neon, Railway, etc.)
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
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

    CREATE TABLE IF NOT EXISTS timesheet_entries (
      id           SERIAL PRIMARY KEY,
      date         DATE NOT NULL,
      week_number  INT,
      schedule     VARCHAR(50),
      billable_to  VARCHAR(255),
      project_task VARCHAR(255),
      time_in      TIME,
      time_out     TIME,
      notes        TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { pool, initDb };
