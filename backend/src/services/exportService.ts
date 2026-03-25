import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from 'docx';

export interface ExportMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ children: [] }));
      continue;
    }

    if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: line.slice(2), bold: true, size: 32, color: '0066FF' })],
      }));
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line.slice(3), bold: true, size: 28 })],
      }));
    } else if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: line.slice(4), bold: true, size: 24 })],
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1') })],
      }));
    } else if (line.match(/^\d+\. /)) {
      paragraphs.push(new Paragraph({
        numbering: { reference: 'numbered', level: 0 },
        children: [new TextRun({ text: line.replace(/^\d+\. /, '').replace(/\*\*(.*?)\*\*/g, '$1') })],
      }));
    } else if (line.startsWith('> ')) {
      paragraphs.push(new Paragraph({
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 4, color: '0066FF', space: 8 } },
        children: [new TextRun({ text: line.slice(2), italics: true, color: '666666' })],
      }));
    } else {
      // Handle inline bold
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const runs = parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({ text: part.slice(2, -2), bold: true });
        }
        return new TextRun({ text: part });
      });
      paragraphs.push(new Paragraph({ children: runs }));
    }
  }

  return paragraphs;
}

export async function exportChatAsDocx(
  title: string,
  messages: ExportMessage[]
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title, bold: true, size: 40, color: '0066FF' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Exported on ${new Date().toLocaleString()}`, italics: true, color: '666666', size: 18 })],
    }),
    new Paragraph({ children: [] }),
  ];

  for (const msg of messages) {
    // Role header
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [
        new TextRun({
          text: msg.role === 'user' ? '👤 You' : '🤖 RFI Intelligence Engine',
          bold: true,
          color: msg.role === 'user' ? '0066FF' : '10B981',
        }),
        new TextRun({ text: `  —  ${new Date(msg.timestamp).toLocaleString()}`, size: 16, color: '888888' }),
      ],
    }));

    // Remove confidence_data block
    const cleanContent = msg.content.replace(/<confidence_data>[\s\S]*?<\/confidence_data>/g, '').trim();
    const contentParagraphs = markdownToDocxParagraphs(cleanContent);
    children.push(...contentParagraphs);
    children.push(new Paragraph({ children: [] }));
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'numbered',
        levels: [{ level: 0, format: 'decimal' as const, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

export async function exportRFIAsDocx(
  title: string,
  content: string,
  metadata: { vendor?: string; country?: string; vertical?: string }
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title, bold: true, size: 40, color: '0066FF' })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Vendor: ${metadata.vendor || 'N/A'}  |  Country: ${metadata.country || 'MEA'}  |  Vertical: ${metadata.vertical || 'All'}  |  Generated: ${new Date().toLocaleString()}`, italics: true, color: '666666', size: 18 }),
      ],
    }),
    new Paragraph({ children: [] }),
    ...markdownToDocxParagraphs(content.replace(/<confidence_data>[\s\S]*?<\/confidence_data>/g, '').trim()),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// Simple HTML-based PDF (using html string → Buffer via html approach)
export function generateChatHTML(title: string, messages: ExportMessage[]): string {
  const msgHtml = messages.map(msg => `
    <div class="message ${msg.role}">
      <div class="msg-header">
        <span class="role">${msg.role === 'user' ? '👤 You' : '🤖 RFI Intelligence Engine'}</span>
        <span class="time">${new Date(msg.timestamp).toLocaleString()}</span>
      </div>
      <div class="msg-content">${msg.content.replace(/<confidence_data>[\s\S]*?<\/confidence_data>/g, '').trim().replace(/\n/g, '<br>')}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; margin: 0; padding: 40px; }
  h1 { color: #0066FF; font-size: 24px; border-bottom: 2px solid #0066FF; padding-bottom: 10px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 30px; }
  .message { margin: 20px 0; padding: 16px; border-radius: 12px; }
  .message.user { background: #EFF6FF; border-left: 4px solid #0066FF; }
  .message.assistant { background: #F0FDF4; border-left: 4px solid #10B981; }
  .msg-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .role { font-weight: bold; font-size: 14px; }
  .time { color: #888; font-size: 12px; }
  .msg-content { font-size: 14px; line-height: 1.7; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  th { background: #0066FF; color: white; padding: 8px 12px; text-align: left; }
  td { border: 1px solid #ddd; padding: 8px 12px; }
  code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Exported on ${new Date().toLocaleString()} · RFI Intelligence Engine</div>
  ${msgHtml}
</body>
</html>`;
}
