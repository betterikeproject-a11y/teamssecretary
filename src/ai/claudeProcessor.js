// ============================================================
// src/ai/claudeProcessor.js
// Sends user input to Claude and parses structured output.
// Each input type has its own dedicated prompt.
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = 'claude-sonnet-4-6';

// ── Prompts ──────────────────────────────────────────────────

const PROMPTS = {

  meeting: (text) => `
You are a meeting assistant. Analyse the following meeting transcript and return a JSON object.

Transcript:
"""
${text}
"""

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "title": "Short descriptive meeting title (max 8 words)",
  "summary": "2-4 sentence summary of what was discussed",
  "decisions": ["list of key decisions made"],
  "actionItems": ["list of action items with owner if mentioned"],
  "attendees": ["list of attendee names if mentioned"],
  "tags": ["2-4 lowercase topic tags"]
}
`.trim(),

  task: (text) => `
You are a task manager assistant. Extract task details from the following message and return a JSON object.

Message:
"""
${text}
"""

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "title": "Short task title (max 8 words)",
  "summary": "One sentence describing what needs to be done",
  "priority": "high | medium | low (infer from urgency language)",
  "dueDate": "Due date as a readable string if mentioned, otherwise null",
  "tags": ["1-3 lowercase category tags"]
}
`.trim(),

  note: (text) => `
You are a note-taking assistant. Clean up and organise the following note and return a JSON object.

Note:
"""
${text}
"""

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "title": "Short descriptive title (max 8 words)",
  "summary": "The cleaned-up, well-written version of the note",
  "tags": ["2-4 lowercase topic tags"]
}
`.trim(),

  idea: (text) => `
You are a creative ideas assistant. Analyse the following idea and return a JSON object.

Idea:
"""
${text}
"""

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "title": "Catchy short title for the idea (max 8 words)",
  "summary": "2-3 sentences expanding on the idea and its potential value",
  "tags": ["2-4 lowercase topic tags"]
}
`.trim(),

};

// ── Main processor ───────────────────────────────────────────

/**
 * Send text to Claude for the given input type.
 * Returns a normalised result object.
 *
 * @param {'meeting'|'task'|'note'|'idea'} type
 * @param {string} rawText
 * @returns {Promise<object>}
 */
async function processInput(type, rawText) {
  const promptFn = PROMPTS[type] || PROMPTS.note;
  const prompt   = promptFn(rawText);

  const message = await client.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0]?.text?.trim();

  let parsed;
  try {
    // Strip any accidental markdown code fences
    const clean = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    console.error('Claude returned non-JSON:', raw);
    // Fallback — wrap raw text so the app still functions
    parsed = {
      title:   `${type.charAt(0).toUpperCase() + type.slice(1)} — ${new Date().toLocaleDateString()}`,
      summary: raw || rawText.slice(0, 300),
      tags:    [type],
    };
  }

  // Normalise: ensure required fields exist
  return {
    title:    parsed.title    || 'Untitled',
    summary:  parsed.summary  || '',
    tags:     Array.isArray(parsed.tags) ? parsed.tags : [],
    priority: parsed.priority || null,
    dueDate:  parsed.dueDate  || null,
    // Meeting-specific extras stored in summary as formatted text
    ...(type === 'meeting' && {
      summary: formatMeetingSummary(parsed),
    }),
  };
}

/**
 * Combine all meeting fields into a rich summary string for storage.
 */
function formatMeetingSummary(parsed) {
  let out = parsed.summary || '';

  if (parsed.decisions?.length) {
    out += '\n\n**Decisions:**\n' + parsed.decisions.map(d => `• ${d}`).join('\n');
  }
  if (parsed.actionItems?.length) {
    out += '\n\n**Action Items:**\n' + parsed.actionItems.map(a => `• ${a}`).join('\n');
  }
  if (parsed.attendees?.length) {
    out += '\n\n**Attendees:** ' + parsed.attendees.join(', ');
  }
  return out.trim();
}

module.exports = { processInput };
