// services/pdfTemplates/shared.js
// Shared infrastructure for the PDF templates: font registration, design
// tokens, a few tiny react-pdf building blocks, and the markdown→structured
// parser. See spec §7.2 (rewrite markdown conventions) and §8 (PDF export).

import React from 'react';
import { StyleSheet, Text, View } from '@react-pdf/renderer';

// Use react-pdf's built-in fonts (Helvetica, Times-Roman, Courier) — no
// network fetch required, works offline. Templates substitute the
// equivalents: Modern → Helvetica, Classic → Times-Roman, PlainText → Courier.
// To use Inter/Georgia, drop TTFs into public/pdf-fonts/ and add Font.register
// calls here, then swap fontFamily values in the templates.
export const FONTS = {
  sans: 'Helvetica',
  sansBold: 'Helvetica-Bold',
  serif: 'Times-Roman',
  serifBold: 'Times-Bold',
  mono: 'Courier'
};

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
export const COLORS = {
  primary: '#1e3a5f',
  text: '#111',
  muted: '#666',
  light: '#9bb4d6'
};

export const PAGE = {
  size: 'A4',
  padding: 36
};

// ---------------------------------------------------------------------------
// Small reusable react-pdf primitives
// ---------------------------------------------------------------------------
const sharedStyles = StyleSheet.create({
  sectionHeading: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 10
  },
  sectionRule: {
    borderBottomWidth: 0.5,
    borderBottomStyle: 'solid',
    marginBottom: 6
  }
});

/**
 * Uppercase section heading used by both templates. The Modern template
 * overrides color via the `color` prop; Classic uses the default dark text
 * plus a thin rule underneath.
 */
export function SectionHeading({ text, color, rule = false, style }) {
  return (
    <View>
      <Text
        style={[
          sharedStyles.sectionHeading,
          color ? { color } : null,
          style || null
        ]}
      >
        {text}
      </Text>
      {rule ? (
        <View
          style={[
            sharedStyles.sectionRule,
            { borderBottomColor: color || COLORS.text }
          ]}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// parseResumeMarkdown
// ---------------------------------------------------------------------------
// Heuristic markdown → structured resume parser. Tolerant of variation:
// missing bold, different separators, multiple date formats. See spec §7.2.
//
// Output shape mirrors `resume.structured` from spec §6.

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const LINKEDIN_RE = /((?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|·•]+)/i;
const URL_RE = /(https?:\/\/[^\s|·•]+)/i;

// Date token recognition. Matches "2022 — Present", "2019-2022",
// "Jan 2020 – Mar 2022", "2020/01 - 2022/03" and common variants.
const DATE_RE =
  /((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}(?:[/-]\d{1,2})?|Present|Current|Now)/i;

const SEPARATOR_RE = /\s*[·•|–—-]\s*/;

const HEADING_MAP = {
  summary: 'summary',
  profile: 'summary',
  about: 'summary',
  objective: 'summary',
  experience: 'experience',
  'work experience': 'experience',
  'professional experience': 'experience',
  work: 'experience',
  employment: 'experience',
  education: 'education',
  skills: 'skills',
  'technical skills': 'skills',
  'core skills': 'skills',
  projects: 'projects',
  'selected projects': 'projects',
  certifications: 'certifications',
  certificates: 'certifications',
  certification: 'certifications'
};

function stripBold(line) {
  return line.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
}

function stripMarkdownInline(line) {
  return stripBold(line)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function classifyHeading(text) {
  const norm = text.trim().toLowerCase().replace(/[:：]$/, '');
  return HEADING_MAP[norm] || null;
}

function parseContactLine(line) {
  const out = {};
  const email = line.match(EMAIL_RE);
  if (email) out.email = email[0];
  const linkedin = line.match(LINKEDIN_RE);
  if (linkedin) out.linkedin = linkedin[0];

  // Strip already-matched tokens before grabbing phone so we don't catch
  // digits inside a URL.
  let scratch = line;
  if (email) scratch = scratch.replace(email[0], '');
  if (linkedin) scratch = scratch.replace(linkedin[0], '');
  const phone = scratch.match(PHONE_RE);
  if (phone) out.phone = phone[0].trim();

  // Anything else left over that isn't a URL is treated as a location candidate.
  const remaining = scratch
    .split(SEPARATOR_RE)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t &&
        !EMAIL_RE.test(t) &&
        !PHONE_RE.test(t) &&
        !LINKEDIN_RE.test(t) &&
        !URL_RE.test(t)
    );
  if (remaining.length) out.location = remaining[0];

  return out;
}

function parseDates(token) {
  if (!token) return { start: '', end: '' };
  const cleaned = token.replace(/[()]/g, '').trim();
  const parts = cleaned.split(/\s*[–—-]\s*|\s+to\s+|\s*~\s*/i);
  if (parts.length >= 2) {
    return { start: parts[0].trim(), end: parts.slice(1).join(' ').trim() };
  }
  return { start: cleaned, end: '' };
}

function extractDateRange(line) {
  // Find first occurrence of a date and capture from there to end-of-line.
  const m = line.match(
    /((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}(?:[/-]\d{1,2})?)\s*[–—-]\s*((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}(?:[/-]\d{1,2})?|Present|Current|Now)/i
  );
  if (m) {
    return { match: m[0], start: m[1].trim(), end: m[2].trim() };
  }
  const single = line.match(DATE_RE);
  if (single) return { match: single[0], start: single[0].trim(), end: '' };
  return null;
}

function parseExperienceHeader(rawLine) {
  // Try `**Title** · Company · dates` (or any subset, any separator).
  const dateInfo = extractDateRange(rawLine);
  let line = rawLine;
  let start = '';
  let end = '';
  if (dateInfo) {
    start = dateInfo.start;
    end = dateInfo.end;
    line = line.replace(dateInfo.match, '').trim();
  }
  line = stripMarkdownInline(line)
    .replace(/[,·•|–—-]\s*$/, '')
    .trim();

  const parts = line
    .split(SEPARATOR_RE)
    .map((t) => t.trim())
    .filter(Boolean);

  let title = '';
  let company = '';
  if (parts.length === 1) {
    // Single token — could be either; treat as title.
    title = parts[0];
  } else if (parts.length >= 2) {
    title = parts[0];
    company = parts[1];
  }
  return { title, company, start, end };
}

function parseEducationHeader(rawLine) {
  const dateInfo = extractDateRange(rawLine);
  let line = rawLine;
  let start = '';
  let end = '';
  if (dateInfo) {
    start = dateInfo.start;
    end = dateInfo.end;
    line = line.replace(dateInfo.match, '').trim();
  }
  line = stripMarkdownInline(line)
    .replace(/[,·•|–—-]\s*$/, '')
    .trim();

  // Common forms:
  //   **Degree** · School
  //   Degree, School
  //   Degree at School
  let parts = line.split(SEPARATOR_RE).map((t) => t.trim()).filter(Boolean);
  if (parts.length < 2) {
    parts = line.split(/\s*,\s*/).map((t) => t.trim()).filter(Boolean);
  }
  if (parts.length < 2 && /\s+at\s+/i.test(line)) {
    parts = line.split(/\s+at\s+/i).map((t) => t.trim()).filter(Boolean);
  }

  const degree = parts[0] || '';
  const school = parts[1] || '';
  return { school, degree, major: '', start, end, gpa: '' };
}

function tokenizeSkills(text) {
  return text
    .split(/[,;·•|]/)
    .map((t) => stripMarkdownInline(t).trim())
    .filter(Boolean);
}

function isBulletLine(line) {
  return /^\s*[-*]\s+/.test(line);
}

function bulletText(line) {
  return stripMarkdownInline(line.replace(/^\s*[-*]\s+/, '')).trim();
}

function looksLikeEntryHeader(line) {
  // Heuristic for "this line starts a new job/edu/project entry":
  //   - bold somewhere on the line, OR
  //   - contains an explicit separator (·, •, |, —), OR
  //   - contains a date range.
  if (!line.trim()) return false;
  if (isBulletLine(line)) return false;
  if (/\*\*[^*]+\*\*/.test(line)) return true;
  if (/[·•|]/.test(line)) return true;
  if (extractDateRange(line)) return true;
  return false;
}

function emptyResume() {
  return {
    basics: {
      name: '',
      email: '',
      phone: '',
      linkedin: '',
      location: ''
    },
    summary: '',
    experience: [],
    education: [],
    skills: { technical: [], soft: [] },
    projects: [],
    certifications: []
  };
}

/**
 * Parse a Markdown resume into the structured shape from spec §6.
 * Returns `null` if the result is unusable (no name AND no sections),
 * signaling the caller to fall back to PlainTextTemplate.
 *
 * @param {string} md
 * @returns {object | null}
 */
export function parseResumeMarkdown(md) {
  if (typeof md !== 'string' || !md.trim()) return null;

  const resume = emptyResume();
  const lines = md.replace(/\r\n?/g, '\n').split('\n');

  let section = 'basics'; // 'basics' | 'summary' | 'experience' | ...
  let skillsSub = 'technical'; // active sub-bucket within skills
  let currentEntry = null; // current experience/project entry
  let currentEdu = null;
  const summaryBuf = [];
  const basicsBuf = [];

  const finalizeEntry = () => {
    if (currentEntry) {
      resume.experience.push(currentEntry);
      currentEntry = null;
    }
  };
  const finalizeEdu = () => {
    if (currentEdu) {
      resume.education.push(currentEdu);
      currentEdu = null;
    }
  };
  const finalizeAll = () => {
    finalizeEntry();
    finalizeEdu();
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    // H1 → name
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 && !resume.basics.name) {
      resume.basics.name = stripMarkdownInline(h1[1]).trim();
      section = 'basics';
      continue;
    }

    // H2 → new section
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      finalizeAll();
      // Commit accumulated basics lines before leaving.
      if (basicsBuf.length) {
        const merged = basicsBuf.join(' ');
        const parsed = parseContactLine(merged);
        Object.assign(resume.basics, {
          email: resume.basics.email || parsed.email || '',
          phone: resume.basics.phone || parsed.phone || '',
          linkedin: resume.basics.linkedin || parsed.linkedin || '',
          location: resume.basics.location || parsed.location || ''
        });
        basicsBuf.length = 0;
      }
      const next = classifyHeading(stripMarkdownInline(h2[1]));
      section = next || 'other';
      skillsSub = 'technical';
      continue;
    }

    // H3 (or bold-only line) inside skills can switch sub-bucket.
    if (section === 'skills') {
      const subMatch =
        line.match(/^###\s+(.+)$/) ||
        line.match(/^\*\*([^*]+)\*\*\s*[:：]?\s*(.*)$/);
      if (subMatch) {
        const label = subMatch[1].toLowerCase();
        if (/soft/.test(label)) {
          skillsSub = 'soft';
        } else if (/technical|tech|hard|tools|languages/.test(label)) {
          skillsSub = 'technical';
        }
        const inlineRest = (subMatch[2] || '').trim();
        if (inlineRest) {
          resume.skills[skillsSub].push(...tokenizeSkills(inlineRest));
        }
        continue;
      }
    }

    // Route by section.
    switch (section) {
      case 'basics': {
        basicsBuf.push(stripMarkdownInline(line));
        break;
      }

      case 'summary': {
        summaryBuf.push(stripMarkdownInline(line));
        break;
      }

      case 'experience': {
        if (isBulletLine(raw)) {
          if (!currentEntry) {
            currentEntry = {
              company: '',
              title: '',
              start: '',
              end: '',
              bullets: []
            };
          }
          currentEntry.bullets.push(bulletText(raw));
        } else if (looksLikeEntryHeader(line)) {
          finalizeEntry();
          const header = parseExperienceHeader(line);
          currentEntry = { ...header, bullets: [] };
        } else if (currentEntry) {
          // Continuation line under an entry — treat as a bullet so it's visible.
          currentEntry.bullets.push(stripMarkdownInline(line));
        }
        break;
      }

      case 'education': {
        if (isBulletLine(raw)) {
          if (!currentEdu) {
            currentEdu = {
              school: '',
              degree: '',
              major: '',
              start: '',
              end: '',
              gpa: ''
            };
          }
          // Append bullet text as a minor detail on `major` if empty,
          // otherwise drop into degree for visibility.
          const txt = bulletText(raw);
          if (!currentEdu.major) currentEdu.major = txt;
          else currentEdu.degree = `${currentEdu.degree} — ${txt}`.trim();
        } else if (looksLikeEntryHeader(line) || line.length > 0) {
          finalizeEdu();
          currentEdu = parseEducationHeader(line);
        }
        break;
      }

      case 'skills': {
        if (isBulletLine(raw)) {
          resume.skills[skillsSub].push(...tokenizeSkills(bulletText(raw)));
        } else {
          // Look for an inline "Technical:" / "Soft:" prefix even without bold.
          const labelled = line.match(/^([A-Za-z][\w\s]+?)\s*[:：]\s*(.*)$/);
          if (labelled) {
            const label = labelled[1].toLowerCase();
            if (/soft/.test(label)) skillsSub = 'soft';
            else if (/technical|tech|hard|tools|languages/.test(label))
              skillsSub = 'technical';
            resume.skills[skillsSub].push(...tokenizeSkills(labelled[2]));
          } else {
            resume.skills[skillsSub].push(...tokenizeSkills(line));
          }
        }
        break;
      }

      case 'projects': {
        if (isBulletLine(raw)) {
          const text = bulletText(raw);
          if (!resume.projects.length || resume.projects.at(-1)._closed) {
            resume.projects.push({
              name: text.split(/[—:·-]/)[0].trim() || text,
              description: text,
              link: ''
            });
          } else {
            const last = resume.projects.at(-1);
            last.description = last.description
              ? `${last.description}\n• ${text}`
              : text;
          }
        } else if (looksLikeEntryHeader(line) || line.length > 0) {
          // Close the previous project so the next bullets attach to the new entry.
          if (resume.projects.length) resume.projects.at(-1)._closed = true;
          const dateInfo = extractDateRange(line);
          let cleaned = line;
          if (dateInfo) cleaned = cleaned.replace(dateInfo.match, '').trim();
          cleaned = stripMarkdownInline(cleaned)
            .replace(/[,·•|–—-]\s*$/, '')
            .trim();
          const linkMatch = cleaned.match(URL_RE);
          const name = cleaned.replace(URL_RE, '').split(SEPARATOR_RE)[0].trim();
          resume.projects.push({
            name: name || cleaned,
            description: '',
            link: linkMatch ? linkMatch[0] : ''
          });
        }
        break;
      }

      case 'certifications': {
        const text = isBulletLine(raw) ? bulletText(raw) : stripMarkdownInline(line);
        if (!text) break;
        const dateInfo = extractDateRange(text);
        let body = text;
        let date = '';
        if (dateInfo) {
          date = dateInfo.match;
          body = body.replace(dateInfo.match, '').trim();
        }
        body = body.replace(/[,·•|–—-]\s*$/, '').trim();
        const parts = body.split(SEPARATOR_RE).map((t) => t.trim()).filter(Boolean);
        resume.certifications.push({
          name: parts[0] || body,
          issuer: parts[1] || '',
          date
        });
        break;
      }

      default:
        // 'other' / unrecognised section — ignore content but keep parsing.
        break;
    }
  }

  // Flush any pending buffers/entries.
  finalizeAll();
  if (basicsBuf.length) {
    const merged = basicsBuf.join(' ');
    const parsed = parseContactLine(merged);
    Object.assign(resume.basics, {
      email: resume.basics.email || parsed.email || '',
      phone: resume.basics.phone || parsed.phone || '',
      linkedin: resume.basics.linkedin || parsed.linkedin || '',
      location: resume.basics.location || parsed.location || ''
    });
  }
  if (summaryBuf.length) {
    resume.summary = summaryBuf.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Strip internal helper flags from projects.
  resume.projects = resume.projects.map(({ _closed, ...rest }) => rest);

  // Deduplicate skill tokens while preserving order.
  const dedupe = (arr) => {
    const seen = new Set();
    const out = [];
    for (const s of arr) {
      const key = s.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    }
    return out;
  };
  resume.skills.technical = dedupe(resume.skills.technical);
  resume.skills.soft = dedupe(resume.skills.soft);

  const hasAnySection =
    resume.summary ||
    resume.experience.length ||
    resume.education.length ||
    resume.skills.technical.length ||
    resume.skills.soft.length ||
    resume.projects.length ||
    resume.certifications.length;

  if (!resume.basics.name || !hasAnySection) return null;

  return resume;
}
