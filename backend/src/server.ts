import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fileUpload from 'express-fileupload';
import path from 'path';

import { initDatabase } from './database/init';
import chatRouter from './routes/chat';
import documentsRouter from './routes/documents';
import rfiRouter from './routes/rfi';
import { knowledgeRouter, adminRouter } from './routes/knowledgeAdmin';
const app = express();
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
const origins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: [...origins, 'http://localhost:3000', 'http://localhost:4173', 'https://green-mud-0941f4810.4.azurestaticapps.net'],
  credentials: true
}));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, abortOnLimit: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    mode: process.env.USE_AZURE_OPENAI === 'true' ? 'azure-openai' : 'openai'
  });
});

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/rfi', rfiRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/admin', adminRouter);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled:', err.message);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Init DB
initDatabase();

// ✅ SINGLE LISTEN (ONLY THIS)
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   RFI Genie Backend  v2.0           ║`);
  console.log(`║   Port: ${PORT}                    ║`);
  console.log(`║   /health endpoint ready           ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});

export default app;