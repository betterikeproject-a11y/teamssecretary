// ============================================================
// src/routes/bot.js
// POST /api/messages — Bot Framework adapter entry point.
// Bot Framework calls this endpoint for every Teams message.
// ============================================================

const express = require('express');
const { BotFrameworkAdapter } = require('botbuilder');
const { HernaniAutomationBot } = require('../bot/botHandler');

const router = express.Router();

// Initialise the Bot Framework adapter with Azure app credentials
const adapter = new BotFrameworkAdapter({
  appId:       process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD,
});

// Global error handler for the adapter
adapter.onTurnError = async (context, error) => {
  console.error('Unhandled bot turn error:', error);
  await context.sendActivity('❌ An unexpected error occurred. Please try again.');
};

const bot = new HernaniAutomationBot();

// Handle every incoming message from Teams
router.post('/', (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

module.exports = router;
