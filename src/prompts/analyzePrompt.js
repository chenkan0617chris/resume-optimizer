// prompts/analyzePrompt.js
// Builds the user-message prompt for the one-shot gap analysis call.
// Output contract: AnalysisJSON shape from spec §7.1.

const SYSTEM_INSTRUCTIONS = `You are a senior HR professional and career coach with deep expertise in matching candidate resumes to job descriptions. You evaluate fit across four dimensions: Skills (technical and soft), Experience (relevance, seniority, scope), Keywords (ATS-relevant terms and phrasing), and Education (degree, field, certifications).

Your assessment must be honest, specific, and actionable. Score conservatively: 80+ is rare and reserved for genuinely strong matches.`;

const OUTPUT_CONTRACT = `Return the analysis as a single JSON object with EXACTLY this shape:

{
  "score": <integer 0-100, overall match>,
  "scoreBreakdown": {
    "skills": <integer 0-100>,
    "experience": <integer 0-100>,
    "keywords": <integer 0-100>,
    "education": <integer 0-100>
  },
  "summary": "<2-4 sentence narrative assessment of overall fit>",
  "gaps": [
    {
      "category": "<e.g. Technical Skills, Soft Skills, Experience, Keywords, Education, Certifications>",
      "item": "<specific skill, keyword, or requirement>",
      "status": "missing" | "partial" | "matched",
      "importance": "high" | "medium" | "low",
      "suggestion": "<concrete, actionable advice for the candidate>"
    }
  ],
  "strengths": ["<bullet-style string>", ...],
  "improvements": ["<bullet-style string>", ...]
}

Field rules:
- All fields are required.
- "score" and every value in "scoreBreakdown" are INTEGERS between 0 and 100 inclusive.
- "gaps" SHOULD include at least 5 items covering the most relevant matches and misses across categories. Include "matched" items so the user sees their strengths reflected, not only what is missing.
- "strengths" and "improvements" are arrays of short standalone strings (no numbering, no bullet characters).
- "status" must be exactly one of: "missing", "partial", "matched".
- "importance" must be exactly one of: "high", "medium", "low".`;

const CLOSING = `Respond with JSON only. No markdown fences, no preamble, no explanation.`;

/**
 * Build the analyze prompt body.
 *
 * @param {string} resumeMarkdown The candidate's resume in markdown.
 * @param {string} jdText The raw job description text.
 * @param {string} [retryHint] Optional stricter instruction appended on retry
 *   after a MalformedResponseError.
 * @returns {string} The full user-message prompt string.
 */
export function buildAnalyzePrompt(resumeMarkdown, jdText, retryHint) {
  const safeResume = (resumeMarkdown ?? '').toString().trim();
  const safeJd = (jdText ?? '').toString().trim();

  const parts = [
    SYSTEM_INSTRUCTIONS,
    '',
    '--- RESUME ---',
    safeResume,
    '',
    '--- JOB DESCRIPTION ---',
    safeJd,
    '',
    '--- TASK ---',
    'Analyze how well this resume matches this job description across skills, experience, keywords, and education. Identify gaps the candidate should address, strengths to emphasize, and concrete improvements they could make.',
    '',
    OUTPUT_CONTRACT,
    '',
    CLOSING
  ];

  if (retryHint) {
    parts.push('', retryHint);
  }

  return parts.join('\n');
}
