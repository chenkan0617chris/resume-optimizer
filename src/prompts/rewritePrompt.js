// prompts/rewritePrompt.js
// Builds the user-message prompt for the streaming resume rewrite.
// Output contract: pure Markdown following the heading conventions in spec §7.2.

const SYSTEM_INSTRUCTIONS = `You are a professional resume writer who specializes in tailoring resumes to specific job descriptions for ATS-optimized, recruiter-friendly results.

Your rules — non-negotiable:
1. NEVER fabricate experience, skills, employers, titles, dates, education, or accomplishments. Only rephrase, reorder, and emphasize what already exists in the original resume.
2. Embed exact keywords and phrases from the job description wherever they truthfully apply to the candidate's background. ATS systems match literal strings.
3. Rewrite each experience bullet in the STAR pattern (Situation, Task, Action, Result) and quantify outcomes whenever the source material allows (numbers, percentages, scale).
4. Rewrite the Summary section to be 2-4 sentences that directly address the target role's core requirements.
5. Reorder the Skills section so JD-relevant skills appear FIRST within each group (technical, soft). Do not invent new skills.
6. Preserve the candidate's voice and tense conventions (past tense for previous roles, present tense for current role).
7. Keep the resume length comparable to the original — do not pad.`;

const FORMAT_RULES = `Output formatting — follow EXACTLY:

- Use Markdown only.
- "# Full Name" as the first line (H1).
- Immediately under the H1, contact info on one or two lines (email · phone · location · linkedin). Use the middle dot · as the separator.
- Major sections use "## Section Name": Summary, Experience, Education, Skills, Projects, Certifications (include only sections the resume has content for).
- Inside Experience, each role starts with: "**Job Title** · Company · Start Date – End Date" on its own line, followed by bulleted achievements ("- ").
- Inside Education, each entry starts with: "**Degree, Major** · School · Start Date – End Date" on its own line. Include GPA / honors as a sub-bullet only if present in source.
- Skills are grouped: under "## Skills", use "**Technical:** ..." and "**Soft:** ..." comma-separated lines (or sub-headings if the original used them).
- Bullets are dash-prefixed ("- "), never asterisks. One blank line between sections.`;

const CLOSING = `Output the rewritten resume in Markdown only. No explanation, no commentary, no code fences.`;

/**
 * Build the rewrite prompt body.
 *
 * @param {string} resumeMarkdown The original resume in markdown.
 * @param {string} jdText The raw job description text.
 * @returns {string} The full user-message prompt string.
 */
export function buildRewritePrompt(resumeMarkdown, jdText) {
  const safeResume = (resumeMarkdown ?? '').toString().trim();
  const safeJd = (jdText ?? '').toString().trim();

  return [
    SYSTEM_INSTRUCTIONS,
    '',
    '--- ORIGINAL RESUME ---',
    safeResume,
    '',
    '--- TARGET JOB DESCRIPTION ---',
    safeJd,
    '',
    '--- TASK ---',
    "Rewrite the candidate's resume so it is tightly aligned to the target job description. Stay strictly within the truthful boundaries of the original. Maximize ATS keyword match and recruiter readability.",
    '',
    FORMAT_RULES,
    '',
    CLOSING
  ].join('\n');
}
