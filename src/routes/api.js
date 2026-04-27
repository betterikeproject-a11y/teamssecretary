// ============================================================
// src/routes/api.js
// REST API consumed by the web dashboard.
// ============================================================

const express = require('express');
const { 
  getItems, getItemById, deleteItem,
  saveTimesheetEntry, getTimesheetEntries, deleteTimesheetEntry
} = require('../db/queries');

const router = express.Router();

// Middleware to check if email is allowed
// We expect ALLOWED_EMAILS to be a comma-separated list in .env (e.g. "me@example.com,boss@example.com")
const authMiddleware = (req, res, next) => {
  const email = req.headers['x-user-email'];
  const allowedStr = process.env.ALLOWED_EMAILS || '';
  const allowedEmails = allowedStr.split(',').map(e => e.trim().toLowerCase());

  if (!email || !allowedEmails.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized email address' });
  }
  next();
};

// POST /api/auth — check if email is valid
router.post('/auth', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const allowedStr = process.env.ALLOWED_EMAILS || '';
  const allowedEmails = allowedStr.split(',').map(e => e.trim().toLowerCase());

  if (allowedEmails.includes(email.toLowerCase())) {
    return res.json({ success: true });
  } else {
    return res.status(403).json({ error: 'Unauthorized email address' });
  }
});

// Protect all following routes with the auth middleware
router.use(authMiddleware);

// --- Original Bot Items API ---

// GET /api/items — fetch all, optionally filtered by ?type=
router.get('/items', async (req, res) => {
  try {
    const { type } = req.query;
    const validTypes = ['meeting', 'task', 'note', 'idea'];

    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const items = await getItems(type || null);
    res.json(items);
  } catch (err) {
    console.error('GET /api/items error:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/items/:id — fetch single item
router.get('/items/:id', async (req, res) => {
  try {
    const id   = parseInt(req.params.id, 10);
    const item = await getItemById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    console.error('GET /api/items/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// DELETE /api/items/:id — remove an item
router.delete('/items/:id', async (req, res) => {
  try {
    const id      = parseInt(req.params.id, 10);
    const deleted = await deleteItem(id);
    if (!deleted) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/items/:id error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// GET /api/stats — counts per type for the dashboard header
router.get('/stats', async (req, res) => {
  try {
    const all = await getItems();
    const stats = { meeting: 0, task: 0, note: 0, idea: 0, total: all.length };
    for (const item of all) {
      if (stats[item.type] !== undefined) stats[item.type]++;
    }
    res.json(stats);
  } catch (err) {
    console.error('GET /api/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// --- Timesheet API ---

// GET /api/timesheet — fetch all timesheet entries
router.get('/timesheet', async (req, res) => {
  try {
    const entries = await getTimesheetEntries();
    res.json(entries);
  } catch (err) {
    console.error('GET /api/timesheet error:', err);
    res.status(500).json({ error: 'Failed to fetch timesheet entries' });
  }
});

// POST /api/timesheet — create new timesheet entry
router.post('/timesheet', async (req, res) => {
  try {
    const { date, week_number, schedule, billable_to, project_task, time_in, time_out, notes } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const newEntry = await saveTimesheetEntry({ 
      date, week_number, schedule, billable_to, project_task, time_in, time_out, notes 
    });
    res.status(201).json(newEntry);
  } catch (err) {
    console.error('POST /api/timesheet error:', err);
    res.status(500).json({ error: 'Failed to save timesheet entry' });
  }
});

// DELETE /api/timesheet/:id — remove timesheet entry
router.delete('/timesheet/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await deleteTimesheetEntry(id);
    if (!deleted) return res.status(404).json({ error: 'Timesheet entry not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/timesheet/:id error:', err);
    res.status(500).json({ error: 'Failed to delete timesheet entry' });
  }
});

module.exports = router;
