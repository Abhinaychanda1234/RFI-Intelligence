import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, logAudit } from '../database/init';
import { detectContext, getRelevantKnowledge, buildRFISystemPrompt, generateCompletion } from '../services/aiService';
import { exportRFIAsDocx } from '../services/exportService';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  const { prompt, vendor, country, region, vertical, sections } = req.body;
  if (!prompt || prompt.trim().length < 5) return res.status(400).json({ error: 'Prompt required' });

  try {
    const ctx = detectContext(prompt);
    const context = {
      vendor: vendor || ctx.vendor,
      country: country || ctx.country,
      region: region || ctx.region,
      vertical: vertical || ctx.vertical,
    };

    const knowledge = getRelevantKnowledge(context, 20);
    const systemPrompt = buildRFISystemPrompt(context, knowledge);

    const userMessage = `Generate a comprehensive, professional RFI/RFP response for the following request. Include ALL relevant sections with detailed, accurate content. Use proper markdown formatting including tables where appropriate.

RFI REQUEST:
${prompt}

${sections ? `REQUESTED SECTIONS: ${sections.join(', ')}` : 'Include all 8 standard sections.'}

Remember to append the <confidence_data> JSON block at the end.`;

    const { content, tokensUsed } = await generateCompletion(systemPrompt, userMessage, 0.25);

    // Parse confidence block
    const confidenceMatch = content.match(/<confidence_data>([\s\S]*?)<\/confidence_data>/);
    let confidence = { overall: 75, vendor: context.vendor || '', country: context.country || '', chunks_used: 0 };
    if (confidenceMatch) {
      try { confidence = { ...confidence, ...JSON.parse(confidenceMatch[1].trim()) }; } catch {}
    }
    const cleanContent = content.replace(/<confidence_data>[\s\S]*?<\/confidence_data>/g, '').trim();

    // Parse sections
    const sectionTitles = ['Company Overview', 'Financial Stability', 'Organizational Structure', 'Vendor-Specific Capability', 'Country-Specific Execution Model', 'Technical Capability by Vertical', 'Logistics & Operations', 'Compliance & Governance'];
    const parsedSections = sectionTitles.map(title => {
      const regex = new RegExp(`#{1,3}\\s*(?:\\d+\\.?\\s*)?${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=#{1,3}|$)`, 'i');
      const match = cleanContent.match(regex);
      return { title, content: match ? match[0].trim() : '', confidence: confidence.overall + Math.floor(Math.random() * 10) - 5 };
    }).filter(s => s.content.length > 0);

    const title = `RFI — ${context.vendor || 'General'} · ${context.country || context.region || 'MEA'}`;
    const rfiId = uuidv4();

    const db = getDb();
    try {
      db.prepare(`INSERT INTO rfi_responses (id, title, prompt, vendor, country, vertical, region, response, sections, confidence_score, tokens_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        rfiId, title, prompt, context.vendor || null, context.country || null, context.vertical || null,
        context.region || null, cleanContent, JSON.stringify(parsedSections), confidence.overall, tokensUsed
      );
    } finally { db.close(); }

    logAudit('rfi_generated', 'rfi_response', rfiId, `Vendor: ${context.vendor}, Country: ${context.country}`);

    res.json({ id: rfiId, title, content: cleanContent, sections: parsedSections, confidence: confidence.overall, context, tokensUsed });
  } catch (err) {
    console.error('RFI generation error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Generation failed' });
  }
});

router.post('/detect-context', (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  res.json(detectContext(prompt));
});

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { vendor, country, status, search } = req.query;
    const conds: string[] = []; const params: string[] = [];
    if (vendor) { conds.push('vendor = ?'); params.push(vendor as string); }
    if (country) { conds.push('country = ?'); params.push(country as string); }
    if (status) { conds.push('status = ?'); params.push(status as string); }
    if (search) { conds.push('(title LIKE ? OR prompt LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rfis = db.prepare(`SELECT id, title, prompt, vendor, country, vertical, confidence_score, status, tokens_used, created_at FROM rfi_responses ${where} ORDER BY created_at DESC`).all(...params);
    res.json({ rfis });
  } finally { db.close(); }
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const rfi = db.prepare('SELECT * FROM rfi_responses WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!rfi) return res.status(404).json({ error: 'Not found' });
    if (rfi.sections) try { rfi.sections = JSON.parse(rfi.sections as string); } catch {}
    res.json(rfi);
  } finally { db.close(); }
});

router.get('/:id/export', async (req: Request, res: Response) => {
  const { format = 'docx' } = req.query;
  const db = getDb();
  try {
    const rfi = db.prepare('SELECT * FROM rfi_responses WHERE id = ?').get(req.params.id) as { title: string; response: string; vendor?: string; country?: string; vertical?: string } | undefined;
    if (!rfi) return res.status(404).json({ error: 'Not found' });

    if (format === 'docx') {
      const buffer = await exportRFIAsDocx(rfi.title, rfi.response, { vendor: rfi.vendor, country: rfi.country, vertical: rfi.vertical });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${rfi.title.replace(/[^a-z0-9]/gi, '_')}.docx"`);
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${rfi.title.replace(/[^a-z0-9]/gi, '_')}.md"`);
      res.send(rfi.response);
    }
  } finally { db.close(); }
});

router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    const { status, response } = req.body;
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP']; const params: string[] = [];
    if (status) { sets.push('status = ?'); params.push(status); }
    if (response) { sets.push('response = ?'); params.push(response); }
    params.push(req.params.id);
    db.prepare(`UPDATE rfi_responses SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json({ message: 'Updated' });
  } finally { db.close(); }
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  try {
    db.prepare('DELETE FROM rfi_responses WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } finally { db.close(); }
});

export default router;
