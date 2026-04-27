// src/routes/chat.js
// POST /api/chat        — plain text message
// POST /api/chat/upload — multipart file + optional message

const express  = require('express');
const multer   = require('multer');
const pdfParse = require('pdf-parse');

const { processChat }               = require('../ai/chatProcessor');
const { saveItem, getRecentItems }  = require('../db/queries');

const router = express.Router();

// Auth middleware (same logic as api.js)
const authMiddleware = (req, res, next) => {
  const email      = req.headers['x-user-email'];
  const allowedStr = process.env.ALLOWED_EMAILS || '';
  const allowed    = allowedStr.split(',').map(e => e.trim().toLowerCase());
  if (!email || !allowed.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized email address' });
  }
  next();
};
router.use(authMiddleware);

// Multer — memory storage, 10 MB limit, text/PDF files only
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(txt|md|csv|js|ts|json|py|pdf)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: txt, md, csv, js, ts, json, py, pdf'));
    }
  },
});

// ── POST /api/chat ────────────────────────────────────────────
router.post('/', express.json(), async (req, res) => {
  const { message, conversationHistory = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  try {
    const recentItems = await getRecentItems(20);
    const result      = await processChat({ message, fileContent: '', recentItems, conversationHistory });

    let savedItem = null;
    if (result.shouldSave && result.item) {
      const { type, title, content, summary, tags, priority } = result.item;
      if (type && title) {
        savedItem = await saveItem({
          type, title,
          content:  content  || message,
          summary:  summary  || '',
          tags:     Array.isArray(tags) ? tags : [],
          priority: priority || null,
        });
      }
    }

    res.json({ reply: result.reply, savedItem });
  } catch (err) {
    console.error('POST /api/chat error:', err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// ── POST /api/chat/upload ─────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const message = req.body.message?.trim() || '';

  let conversationHistory = [];
  try {
    if (req.body.conversationHistory) {
      conversationHistory = JSON.parse(req.body.conversationHistory);
    }
  } catch { /* keep empty array */ }

  try {
    // Extract text from file
    let fileContent = '';
    if (/\.pdf$/i.test(req.file.originalname)) {
      const pdfData = await pdfParse(req.file.buffer);
      fileContent   = pdfData.text;
    } else {
      fileContent = req.file.buffer.toString('utf-8');
    }

    // Truncate to ~50 000 chars to stay within token limits
    if (fileContent.length > 50000) {
      fileContent = fileContent.slice(0, 50000) + '\n\n[File truncated at 50,000 characters]';
    }

    const userMessage = message || `I've uploaded a file: ${req.file.originalname}`;
    const recentItems = await getRecentItems(20);
    const result      = await processChat({ message: userMessage, fileContent, recentItems, conversationHistory });

    let savedItem = null;
    if (result.shouldSave && result.item) {
      const { type, title, content, summary, tags, priority } = result.item;
      if (type && title) {
        savedItem = await saveItem({
          type, title,
          content:  content  || fileContent.slice(0, 2000),
          summary:  summary  || '',
          tags:     Array.isArray(tags) ? tags : [],
          priority: priority || null,
        });
      }
    }

    res.json({ reply: result.reply, savedItem, fileName: req.file.originalname });
  } catch (err) {
    console.error('POST /api/chat/upload error:', err);
    res.status(500).json({ error: 'File processing failed' });
  }
});

module.exports = router;
