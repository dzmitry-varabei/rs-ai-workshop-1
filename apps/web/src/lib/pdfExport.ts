import jsPDF from 'jspdf';
import type { WordResponse, UserStatsResponse } from '@english-learning/data-layer-client';

interface ExportData {
  knownWords: WordResponse[];
  unknownWords: WordResponse[];
  stats: UserStatsResponse;
  exportDate: Date;
}

/**
 * Export quiz results to PDF
 */
export async function exportToPDF(data: ExportData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const lineHeight = 7;
  let yPos = margin;

  // Title
  doc.setFontSize(20);
  doc.text('English Learning Quiz Results', pageWidth / 2, yPos, { align: 'center' });
  yPos += lineHeight * 2;

  // Export date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const dateStr = data.exportDate.toLocaleString();
  doc.text(`Exported on: ${dateStr}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += lineHeight * 2;

  // Statistics
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Statistics', margin, yPos);
  yPos += lineHeight;

  doc.setFontSize(10);
  doc.text(`Total Seen: ${data.stats.totalSeen}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Known: ${data.stats.known}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Unknown: ${data.stats.unknown}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Knowledge: ${data.stats.knowledgePercentage}%`, margin, yPos);
  yPos += lineHeight * 2;

  // Known words section
  if (data.knownWords.length > 0) {
    doc.setFontSize(14);
    doc.text('Known Words', margin, yPos);
    yPos += lineHeight;

    doc.setFontSize(10);
    for (const word of data.knownWords) {
      if (yPos > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(`• ${word.textEn}${word.level ? ` (${word.level})` : ''}`, margin + 5, yPos);
      yPos += lineHeight;
    }
    yPos += lineHeight;
  }

  // Unknown words section
  if (data.unknownWords.length > 0) {
    if (yPos > doc.internal.pageSize.getHeight() - margin - 20) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(14);
    doc.text('Unknown Words', margin, yPos);
    yPos += lineHeight;

    doc.setFontSize(10);
    for (const word of data.unknownWords) {
      if (yPos > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(`• ${word.textEn}${word.level ? ` (${word.level})` : ''}`, margin + 5, yPos);
      yPos += lineHeight;
    }
  }

  // Save PDF
  const filename = `english-quiz-results-${data.exportDate.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

