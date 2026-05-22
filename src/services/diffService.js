// services/diffService.js
// Word-level diff using the `diff` npm package. The DiffView component
// renders the returned parts with green for added, red strikethrough for
// removed, and untouched text as-is.

import { diffWordsWithSpace } from 'diff';

/**
 * Compute a word-level diff between two strings, preserving whitespace so
 * line wrapping and paragraph breaks match the original layout.
 *
 * @param {string} original The original (pre-rewrite) text.
 * @param {string} modified The new (post-rewrite) text.
 * @returns {Array<{value: string, added?: boolean, removed?: boolean}>}
 */
export function wordDiff(original, modified) {
  const a = typeof original === 'string' ? original : '';
  const b = typeof modified === 'string' ? modified : '';
  const parts = diffWordsWithSpace(a, b);
  return parts.map((p) => ({
    value: p.value,
    added: !!p.added,
    removed: !!p.removed
  }));
}
