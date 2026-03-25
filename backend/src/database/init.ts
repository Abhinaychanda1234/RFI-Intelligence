import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = process.env.DB_PATH || './data/rfi_genie.db';

export function getDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initDatabase(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT,
      region TEXT, country TEXT, vendor TEXT, vertical TEXT,
      doc_type TEXT, year INTEGER, tags TEXT,
      status TEXT DEFAULT 'queued',
      chunk_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      section_type TEXT,
      region TEXT, country TEXT, vendor TEXT, vertical TEXT,
      confidence REAL DEFAULT 0.8,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT DEFAULT 'rfi',
      starred INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      last_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      files TEXT,
      detected_vendor TEXT,
      detected_country TEXT,
      detected_vertical TEXT,
      confidence_score REAL,
      tokens_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rfi_responses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      vendor TEXT, country TEXT, vertical TEXT, region TEXT,
      response TEXT NOT NULL,
      sections TEXT,
      confidence_score REAL DEFAULT 0,
      sources TEXT,
      missing_data TEXT,
      status TEXT DEFAULT 'draft',
      tokens_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('ai_model', 'gpt-4o'),
      ('temperature', '0.3'),
      ('max_tokens', '4000'),
      ('confidence_threshold', '0.7'),
      ('max_chunks_per_query', '15'),
      ('auto_localization', 'true'),
      ('vendor_positioning', 'true'),
      ('compliance_guardrails', 'true'),
      ('streaming_enabled', 'true'),
      ('admin_password', 'admin123'),
      ('total_api_calls', '0'),
      ('total_tokens', '0');
  `);
  console.log('✅ Database initialized');
  db.close();
}

export function logAudit(action: string, entityType?: string, entityId?: string, details?: string, ip?: string): void {
  try {
    const db = getDb();

    db.prepare(`
      INSERT INTO audit_log (id, action, entity_type, entity_id, details, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), action, entityType || null, entityId || null, details || null, ip || null);
    db.close();
  } catch { /* non-critical */ }
}

if (require.main === module) { initDatabase(); }
