import OpenAI from 'openai';
import { Response } from 'express';
import { getDb } from '../database/init';

const VENDORS = ['HPE', 'Cisco', 'Dell', 'IBM'];
const COUNTRIES = ['Egypt', 'Morocco', 'UAE', 'Qatar', 'Bahrain', 'Oman', 'Saudi Arabia', 'KSA', 'Lebanon', 'Israel', 'Czechia', 'Czech Republic'];
const VERTICALS = ['Infrastructure', 'Data Center', 'Networking', 'Cybersecurity', 'Security', 'AI', 'HPC', 'Machine Learning', 'Enterprise Software', 'POS', 'Data Capture'];
const REGION_MAP: Record<string, string> = {
  'Egypt': 'Africa', 'Morocco': 'Africa',
  'UAE': 'Gulf', 'Qatar': 'Gulf', 'Bahrain': 'Gulf', 'Oman': 'Gulf',
  'Saudi Arabia': 'Saudi', 'KSA': 'Saudi',
  'Lebanon': 'Levant', 'Israel': 'Israel',
};

export function getOpenAIClient(): OpenAI {
  if (process.env.USE_AZURE_OPENAI === 'true') {
    return new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
      defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview' },
      defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY || '' },
    });
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
}

export function getModelName(): string {
  if (process.env.USE_AZURE_OPENAI === 'true') {
    return process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  }
  const db = getDb();
  try {
    const s = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_model') as { value: string } | undefined;
    return s?.value || 'gpt-4o';
  } finally { db.close(); }
}

export interface DetectedContext {
  vendor?: string;
  country?: string;
  region?: string;
  vertical?: string;
}

export function detectContext(text: string): DetectedContext {
  const upper = text.toUpperCase();
  const vendor = VENDORS.find(v => upper.includes(v.toUpperCase()));
  const country = COUNTRIES.find(c => text.toLowerCase().includes(c.toLowerCase()));
  const region = country ? REGION_MAP[country] : undefined;
  const vertical = VERTICALS.find(v => text.toLowerCase().includes(v.toLowerCase()));
  return { vendor, country, region, vertical };
}

export function getRelevantKnowledge(context: DetectedContext, maxChunks = 15): string {
  const db = getDb();
  try {
    const conditions: string[] = ['d.status = ?'];
    const params: (string | number)[] = ['indexed'];

    if (context.vendor) { conditions.push('(kc.vendor = ? OR kc.vendor IS NULL)'); params.push(context.vendor); }
    if (context.country) {
      conditions.push('(kc.country = ? OR kc.region = ? OR kc.country IS NULL)');
      params.push(context.country, context.region || context.country);
    }

    const rows = db.prepare(`
      SELECT kc.content, kc.section_type, kc.country, kc.vendor, kc.confidence, d.name as doc_name
      FROM knowledge_chunks kc JOIN documents d ON kc.document_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY kc.confidence DESC LIMIT ?
    `).all(...params, maxChunks) as Array<{ content: string; section_type: string; country: string; vendor: string; confidence: number; doc_name: string }>;

    if (rows.length === 0) return '';
    return rows.map(r =>
      `[${r.doc_name} | ${r.section_type || 'General'} | ${r.country || 'MEA'} | ${r.vendor || 'General'}]\n${r.content}`
    ).join('\n\n---\n\n');
  } finally { db.close(); }
}

function buildSystemPrompt(context: DetectedContext, knowledge: string, mode: string): string {
  const vendorRules: Record<string, string> = {
    'Cisco': 'Emphasize Gold/Premier Partner status, networking dominance, SD-WAN/SASE leadership, dedicated security practice, Meraki/Webex specialization.',
    'HPE': 'Emphasize GreenLake consumption model, Platinum Partner status, compute/storage portfolio, financial services and leasing capabilities, HPE Alletra.',
    'Dell': 'Emphasize Titanium Partner status, PowerEdge server leadership, PowerStore, installed base size, Device-as-a-Service (DaaS) offerings.',
    'IBM': 'Emphasize AI & WatsonX differentiation, Red Hat OpenShift hybrid cloud, enterprise software integration, consulting/services depth.',
  };

  const modeInstructions: Record<string, string> = {
    'rfi': 'You are an expert RFI/RFP response writer. Generate structured, professional responses following the 8-section framework.',
    'general': 'You are a helpful AI assistant with deep knowledge of IT distribution, MEA markets, and vendor relationships.',
    'analysis': 'You are a data analyst specializing in IT market intelligence. Provide detailed analysis with tables, charts descriptions, and metrics.',
    'research': 'You are a research specialist for IT distribution in MEA. Provide comprehensive research with citations and structured findings.',
  };

  return `${modeInstructions[mode] || modeInstructions['rfi']}

You are the AI brain of RFI Genie, serving an IT distribution company across the Middle East & Africa (MEA) region.

DETECTED CONTEXT:
- Vendor: ${context.vendor || 'General (no specific vendor detected)'}
- Country: ${context.country || 'MEA Pan-Regional'}
- Region: ${context.region || 'Pan-Regional'}
- Vertical: ${context.vertical || 'All technology verticals'}

${context.vendor && vendorRules[context.vendor] ? `VENDOR POSITIONING (${context.vendor}): ${vendorRules[context.vendor]}` : ''}

RESPONSE QUALITY STANDARDS:
- Always use proper Markdown formatting with headers (##, ###), bullet points, **bold**, *italic*
- Create proper Markdown tables when presenting data (| Col1 | Col2 | format)
- Use numbered lists for sequential steps or ranked items
- Include > blockquotes for key statements or quotes
- Use \`code blocks\` for technical specifications, model numbers, or configurations
- Provide specific numbers, percentages, and metrics wherever possible
- Write in executive, formal business English
- Be comprehensive — do not truncate or summarize prematurely
- If asked for a table, always provide a properly formatted Markdown table
- If asked for an org chart, describe it with a structured hierarchical format

RFI SECTION FRAMEWORK (use when generating RFI responses):
1. **Company Overview** — Corporate profile, MEA history, regional footprint, key differentiators
2. **Financial Stability** — Revenue figures, growth trends, financial health indicators  
3. **Organizational Structure** — Team structure, headcount by region, management hierarchy
4. **Vendor-Specific Capability** — Certifications, authorizations, dedicated team, 3-year revenue
5. **Country-Specific Execution Model** — Local operations, coverage, warehouses, partners
6. **Technical Capability by Vertical** — Infrastructure/Cyber/AI-HPC/Software/POS depth
7. **Logistics & Operations** — Warehouse footprint, delivery SLAs, supply chain capability
8. **Compliance & Governance** — Legal structure, export control, local compliance, certifications

COMPLIANCE GUARDRAILS (always enforce):
- Never claim certifications that aren't substantiated
- Include WHT (withholding tax) references where relevant for regional compliance
- Ensure export control language is accurate (UAE re-export, US EAR)
- Legal entity claims must be consistent throughout

${knowledge ? `KNOWLEDGE BASE CONTEXT (use this to personalize and ground your response):
${knowledge}` : 'No specific documents found in knowledge base — provide a comprehensive template response based on typical MEA IT distribution capabilities.'}

IMPORTANT: At the end of any RFI-related response, append a JSON block wrapped in <confidence_data> tags:
<confidence_data>
{"overall": 85, "vendor": "${context.vendor || ''}", "country": "${context.country || ''}", "region": "${context.region || ''}", "vertical": "${context.vertical || ''}", "chunks_used": ${knowledge ? knowledge.split('---').length : 0}}
</confidence_data>`;
}

// Streaming chat handler
export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  context: DetectedContext,
  mode: string,
  res: Response
): Promise<{ content: string; tokensUsed: number }> {
  const client = getOpenAIClient();
  const model = getModelName();
  const db = getDb();

  const settings = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });
  db.close();

  const knowledge = getRelevantKnowledge(context);
  const systemPrompt = buildSystemPrompt(context, knowledge, mode);

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
    temperature: parseFloat(settingsMap['temperature'] || '0.3'),
    max_tokens: parseInt(settingsMap['max_tokens'] || '4000'),
    stream: true,
  });

  let fullContent = '';
  let tokensUsed = 0;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullContent += delta;
      res.write(`data: ${JSON.stringify({ type: 'token', content: delta })}\n\n`);
    }
    if (chunk.usage) tokensUsed = chunk.usage.total_tokens;
  }

  res.write(`data: ${JSON.stringify({ type: 'done', tokensUsed })}\n\n`);
  res.end();

  return { content: fullContent, tokensUsed };
}

// Non-streaming for RFI generation
export async function generateCompletion(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.3
): Promise<{ content: string; tokensUsed: number }> {
  const client = getOpenAIClient();
  const model = getModelName();

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    max_tokens: 4000,
  });

  return {
    content: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens || 0,
  };
}

export function buildRFISystemPrompt(context: DetectedContext, knowledge: string): string {
  return buildSystemPrompt(context, knowledge, 'rfi');
}
