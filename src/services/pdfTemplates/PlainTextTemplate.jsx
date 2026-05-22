// services/pdfTemplates/PlainTextTemplate.jsx
// Last-resort renderer: dumps the raw markdown into a monospaced block so
// the user always gets *something* downloadable even when parseResumeMarkdown
// returns null. Allows multi-page wrap because we cannot guarantee length.
// Spec §8.2.

import React from 'react';
import { Document, Page, StyleSheet, Text } from '@react-pdf/renderer';
import { PAGE } from './shared';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Courier',
    fontSize: 9.5,
    lineHeight: 1.4,
    color: '#111',
    paddingTop: PAGE.padding,
    paddingBottom: PAGE.padding,
    paddingHorizontal: PAGE.padding
  },
  body: {
    // Preserve newlines and whitespace as they appear in source markdown.
    fontFamily: 'Courier',
    fontSize: 9.5,
    lineHeight: 1.4
  }
});

export default function PlainTextTemplate({ markdown }) {
  const text = typeof markdown === 'string' && markdown.length ? markdown : '';
  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <Text style={s.body}>{text}</Text>
      </Page>
    </Document>
  );
}
