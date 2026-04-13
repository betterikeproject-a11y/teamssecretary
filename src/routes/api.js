// ============================================================
// src/routes/api.js
// REST API consumed by the web dashboard.
//
// GET  /api/items          → all items (optionally ?type=meeting|task|note|idea)
// GET  /api/items/:id      → single item
// DELETE /api/items/:id    → delete item
// GET  /api/stats          → counts per type
// ============================================================

const express = require('express');
const { getItems, getItemById, deleteItem } = require('../db/queries');

const router = express.Router();

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

module.exports = router;
