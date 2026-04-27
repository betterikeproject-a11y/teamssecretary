// ============================================================
// src/db/queries.js
// All database read/write operations in one place.
// ============================================================

const { pool } = require('./client');

/**
 * Insert a new item into the database.
 * @param {{ type, title, content, summary, tags, priority }} item
 * @returns {Promise<object>} The inserted row
 */
async function saveItem({ type, title, content, summary, tags = [], priority = null }) {
  const { rows } = await pool.query(
    `INSERT INTO items (type, title, content, summary, tags, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [type, title, content, summary, tags, priority]
  );
  return rows[0];
}

/**
 * Fetch all items, newest first.
 * Optionally filter by type.
 * @param {string|null} type
 * @returns {Promise<object[]>}
 */
async function getItems(type = null) {
  if (type) {
    const { rows } = await pool.query(
      'SELECT * FROM items WHERE type = $1 ORDER BY created_at DESC',
      [type]
    );
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM items ORDER BY created_at DESC');
  return rows;
}

/**
 * Fetch a single item by ID.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function getItemById(id) {
  const { rows } = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Delete an item by ID.
 * @param {number} id
 * @returns {Promise<boolean>} true if deleted
 */
async function deleteItem(id) {
  const { rowCount } = await pool.query('DELETE FROM items WHERE id = $1', [id]);
  return rowCount > 0;
}

// --- Timesheet Queries ---

async function saveTimesheetEntry({ date, week_number, schedule, billable_to, project_task, time_in, time_out, notes }) {
  const { rows } = await pool.query(
    `INSERT INTO timesheet_entries (date, week_number, schedule, billable_to, project_task, time_in, time_out, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [date, week_number, schedule, billable_to, project_task, time_in, time_out, notes]
  );
  return rows[0];
}

async function getTimesheetEntries() {
  const { rows } = await pool.query('SELECT * FROM timesheet_entries ORDER BY date DESC, time_in DESC');
  return rows;
}

async function deleteTimesheetEntry(id) {
  const { rowCount } = await pool.query('DELETE FROM timesheet_entries WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { 
  saveItem, getItems, getItemById, deleteItem,
  saveTimesheetEntry, getTimesheetEntries, deleteTimesheetEntry
};
