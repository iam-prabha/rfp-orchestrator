import type { Answer, Question } from '@repo/shared';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import ExcelJS from 'exceljs';

export interface ExportItem {
  question: Question;
  answer?: Answer | null;
}

export class ExportService {
  /**
   * Generates a Microsoft Word document (.docx) containing questions, approved/drafted answers, and sources.
   */
  async exportToDocx(rfpTitle: string, items: ExportItem[]): Promise<Buffer> {
    const docSections: Paragraph[] = [];

    // Title
    docSections.push(
      new Paragraph({
        text: `RFP Response: ${rfpTitle}`,
        heading: HeadingLevel.TITLE,
        spacing: { after: 300 },
      })
    );

    // Questions and Answers
    for (const item of items) {
      const q = item.question;
      const a = item.answer;

      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Q${q.order}. `, bold: true, size: 24 }),
            new TextRun({ text: q.questionText, bold: true, size: 24 }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Section: ${q.section} | Type: ${q.type}`, italics: true, color: '666666', size: 18 }),
          ],
          spacing: { after: 100 },
        })
      );

      const answerText = a?.finalAnswer || a?.generatedAnswer || 'No response generated.';
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: answerText, size: 22 }),
          ],
          spacing: { after: 150 },
        })
      );

      if (a?.sources && a.sources.length > 0) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Sources: ${a.sources.map((s) => s.documentTitle || 'Reference Document').join(', ')}`,
                size: 18,
                color: '888888',
                italics: true,
              }),
            ],
            spacing: { after: 250 },
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          children: docSections,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Generates a Microsoft Excel workbook (.xlsx) containing structured columns.
   */
  async exportToXlsx(rfpTitle: string, items: ExportItem[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RFP Orchestrator';
    const worksheet = workbook.addWorksheet('RFP Responses');

    worksheet.columns = [
      { header: '#', key: 'order', width: 6 },
      { header: 'Section', key: 'section', width: 20 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Question', key: 'question', width: 45 },
      { header: 'Response', key: 'response', width: 50 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Confidence', key: 'confidence', width: 12 },
    ];

    for (const item of items) {
      const q = item.question;
      const a = item.answer;

      worksheet.addRow({
        order: q.order,
        section: q.section,
        type: q.type,
        question: q.questionText,
        response: a?.finalAnswer || a?.generatedAnswer || 'No response generated.',
        status: a?.status || 'pending',
        confidence: a?.confidenceScore !== undefined ? `${a.confidenceScore}%` : 'N/A',
      });
    }

    // Auto-wrap text on response and question columns
    worksheet.getColumn('question').alignment = { wrapText: true, vertical: 'top' };
    worksheet.getColumn('response').alignment = { wrapText: true, vertical: 'top' };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
