import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '../database/init';
import { processDocument, getUploadDir } from '../services/documentService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { region, country, vendor, vertical, status, search } = req.query;
    const conds: string[] = []; const params: string[] = [];
    if (region) { conds.push('region = ?'); params.push(region as string); }
    if (country) { conds.push('country = ?'); params.push(country as string); }
    if (vendor) { conds.push('vendor = ?'); params.push(vendor as string); }
    if (vertical) { conds.push('vertical = ?'); params.push(vertical as string); }
    if (status) { conds.push('status = ?'); params.push(status as string); }
    if (search) { conds.push('(name LIKE ? OR original_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const docs = db.prepare(`SELECT id, name, original_name, file_type, file_size, region, country, vendor, vertical, doc_type, year, tags, status, chunk_count, created_at FROM documents ${where} ORDER BY created_at DESC`).all(...params);
    const stats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='indexed' THEN 1 ELSE 0 END) as indexed, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors FROM documents`).get();
    res.json({ documents: docs, stats });
  } finally { db.close(); }
});

router.get('/:id/status', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const doc = db.prepare('SELECT id, status, name, chunk_count FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } finally { db.close(); }
});

router.post('/upload', async (req: Request, res: Response) => {
  if (!req.files?.file) return res.status(400).json({ error: 'No file provided' });
  const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
  const { region, country, vendor, vertical, doc_type, year } = req.body;
  const ext = path.extname(file.name).slice(1).toLowerCase();
  const allowed = ['pdf', 'docx', 'doc', 'txt', 'md', 'csv', 'xlsx'];
  if (!allowed.includes(ext)) return res.status(400).json({ error: `File type .${ext} not supported` });

  const fileId = uuidv4();
  const uploadDir = getUploadDir();
  const filePath = path.join(uploadDir, `${fileId}.${ext}`);
  const db = getDb();
  try {
    await file.mv(filePath);
    db.prepare(`INSERT INTO documents (id, name, original_name, file_type, file_size, file_path, region, country, vendor, vertical, doc_type, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      fileId, file.name.replace(`.${ext}`, ''), file.name, ext, file.size, filePath,
      region || null, country || null, vendor || null, vertical || null, doc_type || null, year ? parseInt(year) : null
    );
    processDocument(fileId, filePath, ext, { region, country, vendor, vertical }).catch(console.error);
    res.status(201).json({ documentId: fileId, status: 'queued', message: 'Processing started' });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  } finally { db.close(); }
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const doc = db.prepare('SELECT file_path FROM documents WHERE id = ?').get(req.params.id) as { file_path: string } | undefined;
    if (!doc) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(req.params.id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    if (fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
    res.json({ message: 'Deleted' });
  } finally { db.close(); }
});

export default router;
