// services/pdfTemplates/ClassicTemplate.jsx
// Single-column, serif resume PDF. Centered name header with a thin underline,
// uppercase section labels with light letterspacing. Spec §8.1 "Classic".

import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { COLORS, PAGE, SectionHeading } from './shared';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 10.5,
    color: COLORS.text,
    paddingTop: PAGE.padding,
    paddingBottom: PAGE.padding,
    paddingHorizontal: PAGE.padding,
    lineHeight: 1.4
  },
  header: { alignItems: 'center', marginBottom: 12 },
  name: { fontSize: 22, letterSpacing: 1, marginBottom: 4 },
  contact: { fontSize: 10, color: COLORS.muted },
  rule: {
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
    width: '100%'
  },
  paragraph: { marginBottom: 6 },
  entry: { marginBottom: 8 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  entryTitle: { fontSize: 11 },
  entryDates: { fontSize: 10, color: COLORS.muted },
  entrySub: { fontSize: 10, color: COLORS.muted, marginBottom: 3 },
  bullet: { flexDirection: 'row', marginBottom: 2 },
  bulletDot: { width: 10, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10.5 }
});

function Bullets({ items }) {
  if (!items || !items.length) return null;
  return (
    <View>
      {items.map((b, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View wrap={false}>
      <SectionHeading text={title} rule />
      {children}
    </View>
  );
}

export default function ClassicTemplate({ resume }) {
  if (!resume) return null;
  const { basics = {}, summary, experience = [], education = [], skills = {}, projects = [], certifications = [] } =
    resume;

  const contactParts = [basics.email, basics.phone, basics.linkedin, basics.location].filter(Boolean);
  const skillTokens = [...(skills.technical || []), ...(skills.soft || [])];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {basics.name ? <Text style={s.name}>{basics.name}</Text> : null}
          {contactParts.length ? <Text style={s.contact}>{contactParts.join('  ·  ')}</Text> : null}
          <View style={s.rule} />
        </View>

        {summary ? (
          <Section title="Summary">
            <Text style={s.paragraph}>{summary}</Text>
          </Section>
        ) : null}

        {experience.length ? (
          <Section title="Experience">
            {experience.map((e, i) => (
              <View key={i} style={s.entry}>
                <View style={s.entryHeader}>
                  <Text style={s.entryTitle}>
                    {e.title || ''}
                    {e.company ? `, ${e.company}` : ''}
                  </Text>
                  {(e.start || e.end) && (
                    <Text style={s.entryDates}>
                      {[e.start, e.end].filter(Boolean).join(' — ')}
                    </Text>
                  )}
                </View>
                <Bullets items={e.bullets} />
              </View>
            ))}
          </Section>
        ) : null}

        {education.length ? (
          <Section title="Education">
            {education.map((ed, i) => (
              <View key={i} style={s.entry}>
                <View style={s.entryHeader}>
                  <Text style={s.entryTitle}>
                    {ed.degree || ''}
                    {ed.school ? `, ${ed.school}` : ''}
                  </Text>
                  {(ed.start || ed.end) && (
                    <Text style={s.entryDates}>
                      {[ed.start, ed.end].filter(Boolean).join(' — ')}
                    </Text>
                  )}
                </View>
                {ed.major ? <Text style={s.entrySub}>{ed.major}</Text> : null}
                {ed.gpa ? <Text style={s.entrySub}>GPA: {ed.gpa}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {skillTokens.length ? (
          <Section title="Skills">
            <Text style={s.paragraph}>{skillTokens.join(' · ')}</Text>
          </Section>
        ) : null}

        {projects.length ? (
          <Section title="Projects">
            {projects.map((p, i) => (
              <View key={i} style={s.entry}>
                <Text style={s.entryTitle}>{p.name}</Text>
                {p.description ? <Text style={s.bulletText}>{p.description}</Text> : null}
                {p.link ? <Text style={s.entrySub}>{p.link}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {certifications.length ? (
          <Section title="Certifications">
            {certifications.map((c, i) => (
              <View key={i} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>
                  {c.name}
                  {c.issuer ? ` — ${c.issuer}` : ''}
                  {c.date ? ` (${c.date})` : ''}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}
      </Page>
    </Document>
  );
}
