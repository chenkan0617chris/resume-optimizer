// hooks/usePdfParser.js
// React hook around pdfService.extractText. On PDF_EMPTY, pushes a warning
// toast and rethrows so the caller can flip the UI to the Form tab
// (see spec §9 Step 1 and §10).

import { useCallback, useState } from 'react';
import { extractText } from '../services/pdfService.js';
import { useAppStore } from '../store/appStore.js';

export default function usePdfParser() {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);

  const parsePdf = useCallback(async (file) => {
    setParsing(true);
    setError(null);
    try {
      const text = await extractText(file);
      return text;
    } catch (err) {
      setError(err);
      const store = useAppStore.getState();
      if (err && err.message === 'PDF_EMPTY') {
        store.pushToast({ type: 'warning', message: 'pdf.extractFailed' });
      } else {
        store.pushToast({ type: 'error', message: 'pdf.parseError' });
      }
      throw err;
    } finally {
      setParsing(false);
    }
  }, []);

  return { parsePdf, parsing, error };
}
