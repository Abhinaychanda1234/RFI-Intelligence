import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { getDb } from '../database/init';

const SECTION_KEYWORDS: Record<string, string[]> = {
  'Company Overview': ['company overview', 'about us', 'introduction', 'who we are', 'corporate profile', 'company history'],
  'Financial Stability': ['financial', 'revenue', 'turnover', 'profit', 'balance sheet', 'annual report', 'fiscal', 'growth'],
  'Organizational Structure': ['org chart', 'organizational', 'team structure', 'headcount', 'employees', 'management', 'hierarchy'],
  'Technical Capabilities': ['technical', 'certifications', 'expertise', 'competencies', 'skills', 'technology', 'capabilities'],
  'Logistics': ['warehouse', 'logistics', 'supply chain', 'delivery', 'distribution', 'inventory', 'stock'],
  'Marketing & GTM': ['marketing', 'go-to-market', 'gtm', 'sales', 'pipeline', 'strategy', 'partner'],
  'Compliance': ['compliance', 'legal', 'regulatory', 'governance', 'export control', 'wht', 'withholding', 'iso', 'certification'],
  'Reporting Systems': ['reporting', 'erp', 'crm', 'systems', 'platforms', 'tools', 'dashboard'],
  'Risk Management': ['risk', 'continuity', 'disaster recovery', 'backup', 'resilience', 'security'],
};

function classifySection(text: string): string {
  const lower = text.toLowerCase();
  let best = 'General'; let max = 0;
  for (const [section, kws] of Object.entries(SECTION_KEYWORDS)) {
    const hits = kws.filter(kw => lower.includes(kw)).length;
    if (hits > max) { max = hits; best = section; }
  }
  return best;
}

function chunkText(text: string, maxSize = 1500): Array<{ content: string; sectionType: string }> {
  const paras = text.split(/\n\n+/).filter(p => p.trim().length > 30);
  const chunks: Array<{ content: string; sectionType: string }> = [];
  let current = '';

  for (const para of paras) {
    if (current.length + para.length > maxSize && current.length > 0) {
      chunks.push({ content: current.trim(), sectionType: classifySection(current) });
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim().length > 30) {
    chunks.push({ content: current.trim(), sectionType: classifySection(current) });
  }
  return chunks;
}

async function extractText(filePath: string, fileType: string): Promise<string> {
  const ext = fileType.toLowerCase();
  if (ext === 'pdf') {
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    return data.text;
  }
  if (ext === 'docx' || ext === 'doc') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  if (ext === 'txt' || ext === 'md' || ext === 'csv') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error(`Unsupported file type: ${fileType}`);
}

export async function processDocument(
  fileId: string,
  filePath: string,
  fileType: string,
  metadata: { region?: string; country?: string; vendor?: string; vertical?: string }
): Promise<void> {
  const db = getDb();
  try {
    db.prepare("UPDATE documents SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(fileId);

    const text = await extractText(filePath, fileType);
    if (!text || text.trim().length < 10) throw new Error('No text content extracted');

    db.prepare("UPDATE documents SET content = ?, status = 'indexing', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(text.substring(0, 100000), fileId);

    const chunks = chunkText(text);
    const { v4: uuidv4 } = require('uuid');
    const insertChunk = db.prepare(`
      INSERT INTO knowledge_chunks (id, document_id, content, section_type, region, country, vendor, vertical, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (const chunk of chunks) {
        insertChunk.run(
          uuidv4(), fileId, chunk.content, chunk.sectionType,
          metadata.region || null, metadata.country || null,
          metadata.vendor || null, metadata.vertical || null, 0.8
        );
      }
    });
    insertMany();

    db.prepare("UPDATE documents SET status = 'indexed', chunk_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(chunks.length, fileId);

    console.log(`✅ Indexed ${chunks.length} chunks for document ${fileId}`);
  } catch (err) {
    console.error(`❌ Processing failed for ${fileId}:`, err);
    db.prepare("UPDATE documents SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(fileId);
  } finally {
    db.close();
  }
}

export function getUploadDir(): string {
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
