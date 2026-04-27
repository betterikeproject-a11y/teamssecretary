// ============================================================
// server.js — Entry point
// Starts Express, registers routes, and initialises the DB.
// ============================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { initDb }    = require('./src/db/client');
const botRoute      = require('./src/routes/bot');
const apiRoute      = require('./src/routes/api');
const chatRoute     = require('./src/routes/chat');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve the dashboard static files from src/dashboard
app.use(express.static(path.join(__dirname, 'src/dashboard')));

// ── Routes ───────────────────────────────────────────────────
// Bot Framework requires POST /api/messages
app.use('/api/messages', botRoute);

// REST API for the dashboard
app.use('/api', apiRoute);

// Assistant chat API
app.use('/api/chat', chatRoute);

// Catch-all → serve dashboard index for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'src/dashboard/index.html'));
});

// ── Start ────────────────────────────────────────────────────
(async () => {
  try {
    await initDb();
    console.log('✅ Database initialised');
    app.listen(PORT, () => console.log(`🤖 Hernani Automation Assistant running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();
