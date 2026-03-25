import { Router, Request, Response } from 'express';
import { getDb } from '../database/init';

const knowledgeRouter = Router();
const adminRouter = Router();

// ===== KNOWLEDGE ROUTES =====

knowledgeRouter.get('/stats', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const docStats = db.prepare(`SELECT COUNT(*) as total_docs, SUM(CASE WHEN status='indexed' THEN 1 ELSE 0 END) as indexed_docs, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as error_docs, COUNT(DISTINCT COALESCE(region,'')) as regions, COUNT(DISTINCT COALESCE(vendor,'')) as vendors FROM documents`).get();
    const chunkCount = db.prepare('SELECT COUNT(*) as total FROM knowledge_chunks').get();
    const rfiStats = db.prepare(`SELECT COUNT(*) as total_rfis, COALESCE(AVG(confidence_score),0) as avg_confidence, SUM(tokens_used) as total_tokens FROM rfi_responses`).get();
    const convoStats = db.prepare('SELECT COUNT(*) as total_convos, SUM(message_count) as total_messages FROM conversations').get();
    const recentActivity = db.prepare(`
      SELECT 'document' as type, name as title, status, created_at FROM documents
      UNION ALL SELECT 'rfi' as type, title, status, created_at FROM rfi_responses
      UNION ALL SELECT 'chat' as type, title, 'active' as status, updated_at as created_at FROM conversations
      ORDER BY created_at DESC LIMIT 10
    `).all();
    const byVendor = db.prepare(`SELECT vendor, COUNT(*) as count FROM documents WHERE vendor IS NOT NULL GROUP BY vendor ORDER BY count DESC`).all();
    const byRegion = db.prepare(`SELECT region, COUNT(*) as count FROM documents WHERE region IS NOT NULL GROUP BY region ORDER BY count DESC`).all();
    const settings = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?)').all('total_tokens', 'total_api_calls', 'ai_model') as Array<{ key: string; value: string }>;
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    res.json({ documents: docStats, chunks: chunkCount, rfis: rfiStats, conversations: convoStats, recentActivity, byVendor, byRegion, totalTokens: parseInt(settingsMap['total_tokens'] || '0'), totalApiCalls: parseInt(settingsMap['total_api_calls'] || '0'), aiModel: settingsMap['ai_model'] || 'gpt-4o' });
  } finally { db.close(); }
});

knowledgeRouter.get('/search', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { q, region, vendor, vertical, section, limit = '20' } = req.query;
    if (!q || (q as string).length < 2) return res.status(400).json({ error: 'Query too short' });
    const conds = ['kc.content LIKE ?']; const params: (string | number)[] = [`%${q}%`];
    if (region) { conds.push('kc.region = ?'); params.push(region as string); }
    if (vendor) { conds.push('kc.vendor = ?'); params.push(vendor as string); }
    if (vertical) { conds.push('kc.vertical = ?'); params.push(vertical as string); }
    if (section) { conds.push('kc.section_type = ?'); params.push(section as string); }
    const results = db.prepare(`SELECT kc.id, kc.content, kc.section_type, kc.region, kc.country, kc.vendor, kc.confidence, d.name as doc_name, d.file_type FROM knowledge_chunks kc JOIN documents d ON kc.document_id = d.id WHERE ${conds.join(' AND ')} ORDER BY kc.confidence DESC LIMIT ?`).all(...params, parseInt(limit as string));
    res.json({ results, count: results.length });
  } finally { db.close(); }
});

knowledgeRouter.get('/settings', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const s = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const obj: Record<string, string> = {};
    s.forEach(row => { obj[row.key] = row.value; });
    res.json(obj);
  } finally { db.close(); }
});

knowledgeRouter.patch('/settings', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const allowed = ['ai_model', 'temperature', 'max_tokens', 'confidence_threshold', 'max_chunks_per_query', 'auto_localization', 'vendor_positioning', 'compliance_guardrails', 'streaming_enabled', 'admin_password'];
    const upsert = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`);
    for (const [k, v] of Object.entries(req.body)) {
      if (allowed.includes(k)) upsert.run(k, String(v));
    }
    res.json({ message: 'Settings updated' });
  } finally { db.close(); }
});

// ===== ADMIN ROUTES =====

adminRouter.get('/stats', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const totalDocs = (db.prepare('SELECT COUNT(*) as c FROM documents').get() as { c: number }).c;
    const totalChunks = (db.prepare('SELECT COUNT(*) as c FROM knowledge_chunks').get() as { c: number }).c;
    const totalRFIs = (db.prepare('SELECT COUNT(*) as c FROM rfi_responses').get() as { c: number }).c;
    const totalConvos = (db.prepare('SELECT COUNT(*) as c FROM conversations').get() as { c: number }).c;
    const settings = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const sMap: Record<string, string> = {};
    settings.forEach(s => { sMap[s.key] = s.value; });
    const tokenCost = (parseInt(sMap['total_tokens'] || '0') / 1000) * 0.005;
    const health = { api: !!process.env.OPENAI_API_KEY || !!process.env.AZURE_OPENAI_API_KEY, db: true, storage: true };
    res.json({ totalDocs, totalChunks, totalRFIs, totalConvos, totalApiCalls: parseInt(sMap['total_api_calls'] || '0'), totalTokens: parseInt(sMap['total_tokens'] || '0'), estimatedCostUSD: tokenCost.toFixed(4), health, settings: sMap });
  } finally { db.close(); }
});

adminRouter.get('/audit-log', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const logs = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100').all();
    res.json({ logs });
  } finally { db.close(); }
});

adminRouter.post('/reindex', async (req: Request, res: Response) => {
  const db = getDb();
  try {
    const docs = db.prepare("SELECT id, file_path, file_type, region, country, vendor, vertical FROM documents WHERE status = 'error' OR status = 'queued'").all() as Array<{ id: string; file_path: string; file_type: string; region?: string; country?: string; vendor?: string; vertical?: string }>;
    const { processDocument } = require('../services/documentService');
    for (const doc of docs) {
      processDocument(doc.id, doc.file_path, doc.file_type, { region: doc.region, country: doc.country, vendor: doc.vendor, vertical: doc.vertical }).catch(console.error);
    }
    res.json({ message: `Reindexing ${docs.length} documents` });
  } finally { db.close(); }
});

adminRouter.delete('/clear-history', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { type } = req.body;
    if (type === 'rfis') db.prepare('DELETE FROM rfi_responses').run();
    else if (type === 'conversations') { db.prepare('DELETE FROM messages').run(); db.prepare('DELETE FROM conversations').run(); }
    else if (type === 'all') {
      db.prepare('DELETE FROM rfi_responses').run();
      db.prepare('DELETE FROM messages').run();
      db.prepare('DELETE FROM conversations').run();
    }
    res.json({ message: 'Cleared' });
  } finally { db.close(); }
});

export { knowledgeRouter, adminRouter };
