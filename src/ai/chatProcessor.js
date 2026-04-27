// src/ai/chatProcessor.js
// Conversational Claude processor for the web assistant chat tab.

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = 'claude-sonnet-4-6';

const BASE_SYSTEM_PROMPT = `You are a personal productivity assistant for a software professional named Hernani.
You help him be more organised, productive, and effective at his work.

Your responsibilities:
1. Answer questions, give advice, and have helpful conversations.
2. When the user shares something worth remembering — an idea, task, note, or meeting summary — save it automatically.
3. When a file is uploaded, analyse its contents and help the user understand or act on it.
4. Use the user's previously saved items (provided below) as context to give more relevant answers.

Saving rules:
- Save ONE item per turn at most. Do not save trivial greetings or small talk.
- Save when the user: shares an idea, mentions a task/action item, takes a note, describes a meeting, or uploads a meaningful file.
- Choose type: "meeting" for transcripts/summaries, "task" for action items, "note" for general notes/info, "idea" for creative or strategic thoughts.
- Priority: "high" for urgent/important items, "medium" for normal, "low" for someday/maybe, null if not applicable.

You MUST return ONLY valid JSON with no markdown fences and no text outside the JSON object:
{
  "reply": "Your conversational response (markdown allowed inside this string)",
  "shouldSave": true or false,
  "item": {
    "type": "meeting | task | note | idea",
    "title": "Short descriptive title (max 8 words)",
    "content": "The full raw text being saved",
    "summary": "Clean 1-3 sentence summary",
    "tags": ["1-3 lowercase tags"],
    "priority": "high | medium | low | null"
  }
}
If shouldSave is false, set item to null.`;

async function processChat({ message, fileContent = '', recentItems = [], conversationHistory = [] }) {
  // Build system prompt with recent items context
  let system = BASE_SYSTEM_PROMPT;
  if (recentItems.length > 0) {
    const lines = recentItems.map(i => {
      const date = new Date(i.created_at).toISOString().slice(0, 10);
      return `- [${i.type}] "${i.title}" (${date})${i.summary ? ': ' + i.summary.slice(0, 120) : ''}`;
    }).join('\n');
    system += `\n\nRecently saved items (for context — do not re-save these):\n${lines}`;
  }

  // Build user content — prepend file content if present
  const userContent = fileContent
    ? `[File uploaded]\n\n${fileContent}\n\n---\n\n${message || 'Please analyse this file.'}`
    : message;

  // Assemble full messages array (history + new turn)
  const messages = [
    ...conversationHistory,
    { role: 'user', content: userContent },
  ];

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    system,
    messages,
  });

  const raw = response.content[0]?.text?.trim() || '';

  let parsed;
  try {
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    console.error('chatProcessor: non-JSON response:', raw);
    parsed = { reply: raw || 'Sorry, something went wrong.', shouldSave: false, item: null };
  }

  return {
    reply:      parsed.reply      || '',
    shouldSave: parsed.shouldSave === true,
    item:       parsed.item       || null,
  };
}

module.exports = { processChat };
