import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, logAudit } from '../database/init';
import { detectContext, getRelevantKnowledge, streamChat } from '../services/aiService';
import { exportChatAsDocx, generateChatHTML } from '../services/exportService';
import type { ExportMessage } from '../services/exportService';

const router = Router();

// GET /api/chat/conversations
router.get('/conversations', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const convos = db.prepare(`
      SELECT id, title, mode, starred, archived, message_count, last_message, created_at, updated_at
      FROM conversations WHERE archived = 0
      ORDER BY updated_at DESC
    `).all();
    res.json({ conversations: convos });
  } finally { db.close(); }
});

// POST /api/chat/conversations
router.post('/conversations', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const id = uuidv4();
    const { title = 'New Chat', mode = 'rfi' } = req.body;
    db.prepare(`INSERT INTO conversations (id, title, mode) VALUES (?, ?, ?)`).run(id, title, mode);
    res.status(201).json({ id, title, mode });
  } finally { db.close(); }
});

// GET /api/chat/conversations/:id/messages
router.get('/conversations/:id/messages', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const msgs = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json({ conversation: convo, messages: msgs });
  } finally { db.close(); }
});

// PATCH /api/chat/conversations/:id
router.patch('/conversations/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { title, starred, archived, mode } = req.body;
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: (string | number)[] = [];
    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (starred !== undefined) { sets.push('starred = ?'); params.push(starred ? 1 : 0); }
    if (archived !== undefined) { sets.push('archived = ?'); params.push(archived ? 1 : 0); }
    if (mode !== undefined) { sets.push('mode = ?'); params.push(mode); }
    params.push(req.params.id);
    db.prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json({ message: 'Updated' });
  } finally { db.close(); }
});

// DELETE /api/chat/conversations/:id
router.delete('/conversations/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } finally { db.close(); }
});

// POST /api/chat/message — main streaming endpoint
router.post('/message', async (req: Request, res: Response) => {
  const { conversationId, content, files, mode = 'rfi' } = req.body;
  if (!content || !conversationId) {
    return res.status(400).json({ error: 'conversationId and content required' });
  }

  const db = getDb();
  try {
    // Ensure conversation exists
    let convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as { title: string; message_count: number } | undefined;
    if (!convo) {
      db.prepare('INSERT INTO conversations (id, title, mode) VALUES (?, ?, ?)').run(conversationId, 'New Chat', mode);
      convo = { title: 'New Chat', message_count: 0 };
    }

    // Save user message
    const userMsgId = uuidv4();
    db.prepare(`INSERT INTO messages (id, conversation_id, role, content, files) VALUES (?, ?, 'user', ?, ?)`).run(
      userMsgId, conversationId, content, files ? JSON.stringify(files) : null
    );

    // Auto-title after first message
    if (convo.message_count === 0) {
      const autoTitle = content.length > 60 ? content.substring(0, 57) + '...' : content;
      db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(autoTitle, conversationId);
    }

    // Get conversation history (last 20 messages for context)
    const history = db.prepare(`
      SELECT role, content FROM messages 
      WHERE conversation_id = ? AND id != ?
      ORDER BY created_at DESC LIMIT 20
    `).all(conversationId, userMsgId) as Array<{ role: string; content: string }>;

    const historyOrdered = history.reverse();

    // Detect context
    const context = detectContext(content);

    db.close();

    // Stream the response
    const aiMsgId = uuidv4();
    let fullContent = '';
    let tokensUsed = 0;

    try {
      const result = await streamChat(
        [...historyOrdered, { role: 'user', content }],
        context,
        mode,
        res
      );
      fullContent = result.content;
      tokensUsed = result.tokensUsed;
    } catch (streamErr) {
      console.error('Streaming error:', streamErr);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'AI generation failed' });
      }
    }

    // Save AI response
    const db2 = getDb();
    try {
      db2.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, detected_vendor, detected_country, detected_vertical, tokens_used)
        VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)
      `).run(
        aiMsgId, conversationId, fullContent,
        context.vendor || null, context.country || null, context.vertical || null, tokensUsed
      );

      db2.prepare(`
        UPDATE conversations SET 
          message_count = message_count + 2,
          last_message = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(fullContent.substring(0, 100), conversationId);

      // Update token stats
      const curTokens = db2.prepare("SELECT value FROM settings WHERE key = 'total_tokens'").get() as { value: string } | undefined;
      const curCalls = db2.prepare("SELECT value FROM settings WHERE key = 'total_api_calls'").get() as { value: string } | undefined;
      db2.prepare("UPDATE settings SET value = ? WHERE key = 'total_tokens'").run(String((parseInt(curTokens?.value || '0') + tokensUsed)));
      db2.prepare("UPDATE settings SET value = ? WHERE key = 'total_api_calls'").run(String((parseInt(curCalls?.value || '0') + 1)));
    } finally { db2.close(); }

    logAudit('chat_message', 'conversation', conversationId, `Vendor: ${context.vendor}, Country: ${context.country}`);

  } catch (err) {
    const db3 = getDb();
    db3.close();
    console.error('Chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Chat failed' });
    }
  }
});

// GET /api/chat/conversations/:id/export
router.get('/conversations/:id/export', async (req: Request, res: Response) => {
  const { format = 'docx' } = req.query;
  const db = getDb();
  try {
    const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as { title: string } | undefined;
    if (!convo) return res.status(404).json({ error: 'Not found' });

    const msgs = db.prepare(`
      SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(req.params.id) as Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>;

    const exportMsgs: ExportMessage[] = msgs.map(m => ({
      role: m.role, content: m.content, timestamp: m.created_at,
    }));

    if (format === 'docx') {
      const buffer = await exportChatAsDocx(convo.title, exportMsgs);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${convo.title.replace(/[^a-z0-9]/gi, '_')}.docx"`);
      res.send(buffer);
    } else if (format === 'html') {
      const html = generateChatHTML(convo.title, exportMsgs);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${convo.title.replace(/[^a-z0-9]/gi, '_')}.html"`);
      res.send(html);
    } else if (format === 'markdown') {
      const md = exportMsgs.map(m =>
        `## ${m.role === 'user' ? '👤 You' : '🤖 Assistant'} — ${new Date(m.timestamp).toLocaleString()}\n\n${m.content}\n\n---\n`
      ).join('\n');
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${convo.title.replace(/[^a-z0-9]/gi, '_')}.md"`);
      res.send(md);
    } else {
      res.status(400).json({ error: 'Invalid format. Use docx, html, or markdown' });
    }
  } finally { db.close(); }
});

export default router;
