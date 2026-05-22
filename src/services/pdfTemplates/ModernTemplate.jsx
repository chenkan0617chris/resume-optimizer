// services/pdfTemplates/ModernTemplate.jsx
// Two-column resume PDF. Left 35% deep-blue sidebar (contact / skills /
// education); right 65% main column (summary / experience / projects).
// Spec §8.1 "Modern".

import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { COLORS, SectionHeading } from './shared';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.text,
    flexDirection: 'row'
  },
  sidebar: {
    width: '35%',
    backgroundColor: COLORS.primary,
    color: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 24
  },
  main: {
    width: '65%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#fff'
  },

  // Sidebar typography
  sideName: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  sideSectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.light,
    marginTop: 14,
    marginBottom: 6
  },
  sideText: { fontSize: 9, color: '#fff', marginBottom: 3, lineHeight: 1.4 },
  sideMuted: { fontSize: 9, color: COLORS.light, marginBottom: 6 },
  sideRule: {
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.light,
    marginBottom: 4
  },
  sideEduEntry: { marginBottom: 8 },

  // Main column
  mainHeader: { marginBottom: 10 },
  role: { fontSize: 11, color: COLORS.primary, fontWeight: 'bold' },
  paragraph: { marginBottom: 6, fontSize: 10, lineHeight: 1.45 },
  entry: { marginBottom: 9 },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  entryTitle: { fontSize: 10.5, fontWeight: 'bold', color: COLORS.text },
  entryCompany: { fontSize: 10, color: COLORS.primary },
  entryDates: { fontSize: 9, color: COLORS.muted },
  bullet: { flexDirection: 'row', marginBottom: 2, marginTop: 1 },
  bulletDot: { width: 9, fontSize: 10, color: COLORS.primary },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.4 }
});

function MainBullets({ items }) {
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

function SideSection({ title, children }) {
  return (
    <View>
      <Text style={s.sideSectionTitle}>{title}</Text>
      <View style={s.sideRule} />
      {children}
    </View>
  );
}

export default function ModernTemplate({ resume }) {
  if (!resume) return null;
  const {
    basics = {},
    summary,
    experience = [],
    education = [],
    skills = {},
    projects = [],
    certifications = []
  } = resume;

  const hasContact =
    basics.email || basics.phone || basics.linkedin || basics.location;
  const hasTech = skills.technical && skills.technical.length;
  const hasSoft = skills.soft && skills.soft.length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* -------- Sidebar -------- */}
        <View style={s.sidebar}>
          {basics.name ? <Text style={s.sideName}>{basics.name}</Text> : null}

          {hasContact ? (
            <SideSection title="Contact">
              {basics.email ? <Text style={s.sideText}>{basics.email}</Text> : null}
              {basics.phone ? <Text style={s.sideText}>{basics.phone}</Text> : null}
              {basics.linkedin ? <Text style={s.sideText}>{basics.linkedin}</Text> : null}
              {basics.location ? <Text style={s.sideText}>{basics.location}</Text> : null}
            </SideSection>
          ) : null}

          {hasTech ? (
            <SideSection title="Skills">
              <Text style={s.sideText}>{skills.technical.join(' · ')}</Text>
            </SideSection>
          ) : null}

          {hasSoft ? (
            <SideSection title="Soft Skills">
              <Text style={s.sideText}>{skills.soft.join(' · ')}</Text>
            </SideSection>
          ) : null}

          {education.length ? (
            <SideSection title="Education">
              {education.map((ed, i) => (
                <View key={i} style={s.sideEduEntry}>
                  {ed.degree ? (
                    <Text style={[s.sideText, { fontWeight: 'bold' }]}>{ed.degree}</Text>
                  ) : null}
                  {ed.school ? <Text style={s.sideText}>{ed.school}</Text> : null}
                  {(ed.start || ed.end) && (
                    <Text style={s.sideMuted}>
                      {[ed.start, ed.end].filter(Boolean).join(' — ')}
                    </Text>
                  )}
                  {ed.major ? <Text style={s.sideMuted}>{ed.major}</Text> : null}
                  {ed.gpa ? <Text style={s.sideMuted}>GPA: {ed.gpa}</Text> : null}
                </View>
              ))}
            </SideSection>
          ) : null}

          {certifications.length ? (
            <SideSection title="Certifications">
              {certifications.map((c, i) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  <Text style={s.sideText}>{c.name}</Text>
                  {(c.issuer || c.date) && (
                    <Text style={s.sideMuted}>
                      {[c.issuer, c.date].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
              ))}
            </SideSection>
          ) : null}
        </View>

        {/* -------- Main column -------- */}
        <View style={s.main}>
          {summary ? (
            <View style={s.mainHeader}>
              <SectionHeading text="Profile" color={COLORS.primary} rule />
              <Text style={s.paragraph}>{summary}</Text>
            </View>
          ) : null}

          {experience.length ? (
            <View>
              <SectionHeading text="Experience" color={COLORS.primary} rule />
              {experience.map((e, i) => (
                <View key={i} style={s.entry}>
                  <View style={s.entryRow}>
                    <Text style={s.entryTitle}>{e.title || ''}</Text>
                    {(e.start || e.end) && (
                      <Text style={s.entryDates}>
                        {[e.start, e.end].filter(Boolean).join(' — ')}
                      </Text>
                    )}
                  </View>
                  {e.company ? <Text style={s.entryCompany}>{e.company}</Text> : null}
                  <MainBullets items={e.bullets} />
                </View>
              ))}
            </View>
          ) : null}

          {projects.length ? (
            <View>
              <SectionHeading text="Projects" color={COLORS.primary} rule />
              {projects.map((p, i) => (
                <View key={i} style={s.entry}>
                  <Text style={s.entryTitle}>{p.name}</Text>
                  {p.description ? <Text style={s.bulletText}>{p.description}</Text> : null}
                  {p.link ? <Text style={s.entryDates}>{p.link}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
