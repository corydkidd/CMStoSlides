import pdf from 'pdf-parse';

interface PDFExtractResult {
  text: string;
  numPages: number;
  metadata: any;
}

/**
 * Extract text content from a PDF buffer using pdf-parse.
 */
export async function extractPDFText(buffer: Buffer): Promise<PDFExtractResult> {
  const data = await pdf(buffer);

  return {
    text: data.text,
    numPages: data.numpages,
    metadata: {
      info: data.info,
      version: data.version,
    },
  };
}

/**
 * Clean extracted text from Federal Register PDFs.
 * Handles multi-column layouts, page numbers, headers/footers,
 * and other artifacts common in FR documents.
 */
export function cleanExtractedText(text: string): string {
  let cleaned = text;

  // Remove Federal Register header lines (e.g., "Federal Register / Vol. 90, No. 236 / ...")
  cleaned = cleaned.replace(
    /Federal Register\s*\/\s*Vol\.\s*\d+.*?\/\s*\w+day,\s*\w+\s+\d+,\s*\d{4}\s*\/\s*\w+\s*(?:Rules?|Notices?|Proposed Rules?)/gi,
    ''
  );

  // Remove standalone page numbers (lines that are just a number)
  cleaned = cleaned.replace(/^\s*\d{1,6}\s*$/gm, '');

  // Remove form feed characters
  cleaned = cleaned.replace(/\f/g, '\n');

  // Remove VerDate / Jkt / PO / Frm lines (FR formatting artifacts)
  cleaned = cleaned.replace(/^VerDate\s.*$/gm, '');
  cleaned = cleaned.replace(/^Jkt\s.*$/gm, '');
  cleaned = cleaned.replace(/^PO\s+\d+.*$/gm, '');
  cleaned = cleaned.replace(/^Frm\s+\d+.*$/gm, '');
  cleaned = cleaned.replace(/^Fmt\s+\d+.*$/gm, '');
  cleaned = cleaned.replace(/^Sfmt\s+\d+.*$/gm, '');
  cleaned = cleaned.replace(/^\d+\.TXT.*$/gm, '');
  cleaned = cleaned.replace(/^E:\\FR\\FM\\.*$/gm, '');
  cleaned = cleaned.replace(/^DSK\w+.*$/gm, '');

  // Fix multi-column artifacts: join hyphenated words at line breaks
  cleaned = cleaned.replace(/(\w)-\n\s*(\w)/g, '$1$2');

  // Collapse multiple blank lines to at most two
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  // Remove trailing whitespace on each line
  cleaned = cleaned.replace(/[ \t]+$/gm, '');

  // Trim overall
  cleaned = cleaned.trim();

  return cleaned;
}
