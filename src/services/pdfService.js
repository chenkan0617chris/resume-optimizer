// services/pdfService.js
// PDF text extraction using pdfjs-dist. Pure module — no React imports.
// The worker is loaded via Vite's `?url` import so it lands in the build
// output correctly under the configured `base` path.

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_TEXT_LENGTH = 50;

/**
 * Extract plain text from a PDF File. Pages are joined with double newlines.
 * Throws an Error("PDF_EMPTY") if the extracted text is shorter than 50
 * characters (likely a scanned image or otherwise unparseable).
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractText(file) {
  if (!file) {
    throw new Error('PDF_EMPTY');
  }

  const arrayBuffer = await file.arrayBuffer();
  // Clone into a Uint8Array because pdfjs may transfer/detach the buffer.
  const data = new Uint8Array(arrayBuffer);

  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;

  const pageTexts = [];
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
      pageTexts.push(pageText);
      // Free memory between pages.
      page.cleanup();
    }
  } finally {
    try {
      await pdf.cleanup();
      await pdf.destroy();
    } catch {
      // best effort
    }
  }

  const fullText = pageTexts.join('\n\n').trim();

  if (fullText.length < MIN_TEXT_LENGTH) {
    throw new Error('PDF_EMPTY');
  }

  return fullText;
}
