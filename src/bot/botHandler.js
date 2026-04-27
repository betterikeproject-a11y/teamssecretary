// ============================================================
// src/bot/botHandler.js
// Handles all incoming Teams messages via Bot Framework.
// Detects input type, routes to Claude, saves to DB, replies.
// ============================================================

const { ActivityHandler, MessageFactory } = require('botbuilder');
const { processInput }  = require('../ai/claudeProcessor');
const { saveItem }      = require('../db/queries');

// Keywords/patterns used to detect input type from raw message text
const TRANSCRIPT_SIGNALS = [
  /transcript/i,
  /meeting notes/i,
  /attendees:/i,
  /action items:/i,
  /discussed:/i,
  /\d{1,2}:\d{2}\s?(am|pm)/i,  // timestamps like 10:30 AM
];

const TASK_SIGNALS = [
  /^(todo|task|remind me|action)[\s:]/i,
  /\bdue\b.*(today|tomorrow|monday|tuesday|wednesday|thursday|friday|\d{1,2}\/\d{1,2})/i,
  /\bneed to\b/i,
  /\bmust\b/i,
];

const IDEA_SIGNALS = [
  /^idea[\s:]/i,
  /^what if\b/i,
  /^could we\b/i,
  /^i was thinking/i,
];

/**
 * Detect the input type from the message text.
 * Returns 'meeting' | 'task' | 'note' | 'idea'
 */
function detectInputType(text) {
  if (TRANSCRIPT_SIGNALS.some(r => r.test(text))) return 'meeting';
  if (TASK_SIGNALS.some(r => r.test(text)))        return 'task';
  if (IDEA_SIGNALS.some(r => r.test(text)))         return 'idea';
  return 'note'; // default fallback
}

class HernaniAutomationBot extends ActivityHandler {
  constructor() {
    super();

    // Handle incoming messages
    this.onMessage(async (context, next) => {
      const rawText = context.activity.text?.trim();

      // Ignore empty messages
      if (!rawText) {
        await next();
        return;
      }

      // Let the user know we're processing
      await context.sendActivity(MessageFactory.text('⏳ Processing your input…'));

      try {
        const type   = detectInputType(rawText);
        const result = await processInput(type, rawText);

        // Persist to database
        await saveItem({
          type,
          title:   result.title,
          content: rawText,
          summary: result.summary,
          tags:    result.tags    || [],
          priority:result.priority || null,
        });

        // Build a friendly reply for Teams
        const reply = buildReply(type, result);
        await context.sendActivity(MessageFactory.text(reply));

      } catch (err) {
        console.error('Bot processing error:', err);
        await context.sendActivity(
          MessageFactory.text('❌ Something went wrong while processing your input. Please try again.')
        );
      }

      await next();
    });

    // Greet user when they first open the chat
    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(
            '👋 Hi! I\'m **Hernani Automation Assistant**.\n\n' +
            'Send me:\n' +
            '• A **meeting transcript** → I\'ll summarise decisions & action items\n' +
            '• A **task** (e.g. "Task: review report by Friday") → I\'ll capture it with priority & due date\n' +
            '• A **note** or **idea** → I\'ll clean it up and tag it\n\n' +
            'Everything is saved to your personal dashboard. 🗂️'
          ));
        }
      }
      await next();
    });
  }
}

/**
 * Format a Teams-friendly reply based on processed result.
 */
function buildReply(type, result) {
  const icon = { meeting: '📋', task: '✅', note: '📝', idea: '💡' }[type] || '📌';
  const label = type.charAt(0).toUpperCase() + type.slice(1);

  let reply = `${icon} **${label} captured: "${result.title}"**\n\n`;

  if (result.summary) {
    reply += `**Summary:**\n${result.summary}\n\n`;
  }

  if (result.priority) {
    const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' }[result.priority] || '';
    reply += `**Priority:** ${priorityIcon} ${result.priority}\n`;
  }

  if (result.dueDate) {
    reply += `**Due:** ${result.dueDate}\n`;
  }

  if (result.tags?.length) {
    reply += `**Tags:** ${result.tags.map(t => `#${t}`).join(' ')}\n`;
  }

  reply += '\n_Saved to your dashboard ✓_';
  return reply;
}

module.exports = { HernaniAutomationBot };
