# AI Resume Optimizer — Design Spec

**Date:** 2026-05-22
**Status:** Approved for implementation planning
**Project root:** `C:\chris\resume-optimizer\`

---

## 1. Purpose

A pure-frontend web app that takes a user's resume plus a job description (JD), uses Claude to produce a Gap analysis + an optimized resume rewrite, and exports the result as an ATS-friendly PDF. Hosted on GitHub Pages. No backend in v1, but designed so a Cloudflare Worker proxy can be added later without component changes.

---

## 2. Confirmed decisions

These were validated during brainstorming and override the original spec where different:

| # | Decision | Notes |
|---|---|---|
| 1 | **PDF export = react-pdf** (vector) | Replaces jsPDF + html2canvas. Produces selectable, ATS-parseable text. |
| 2 | **UI is bilingual CN/EN** with header toggle | Lightweight homemade `useI18n()` hook + JSON dictionaries. No library. |
| 3 | **Model = `claude-sonnet-4-6`** | Replaces `claude-sonnet-4-20250514` from original spec. |
| 4 | **Streaming = rewrite only**; analysis is one-shot JSON | Best UX / complexity tradeoff. |
| 5 | **Compare/edit = markdown textarea + word-level diff** | Uses `diff` npm package. Live-rendered preview with highlights. |
| 6 | **PDF templates = Classic + Modern** | Classic: centered serif, single column. Modern: two-column with deep-blue (#1e3a5f) sidebar. |
| 7 | **Architecture = Approach C** (BYO key now, proxy-ready) | Direct browser→Anthropic by default. Adapter pattern allows swapping to proxy with one env-var change. |

---

## 3. Tech stack

- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS v3
- **AI:** Anthropic Messages API (`claude-sonnet-4-6`), direct browser call with `anthropic-dangerous-direct-browser-calls: true`
- **PDF parse:** `pdfjs-dist`
- **PDF generate:** `@react-pdf/renderer`
- **Routing:** React Router v6
- **State:** Zustand (single store, sliced)
- **Diff:** `diff` (word-level)
- **Charts:** `recharts` (radar chart for score breakdown — implementation choice, not explicitly confirmed in brainstorming)
- **Testing:** Vitest + React Testing Library + Playwright (one e2e)
- **Mock fetch in tests:** `msw`
- **Deploy:** `gh-pages` → GitHub Pages

---

## 4. Architecture

### 4.1 Layered structure

```
Pages (steps)     Step1 · Step2 · Step3 · Step4              ← Router routes
UI components     GapTable · ScoreCard · ResumeEditor · …    ← Presentational
Hooks             useClaudeApi · usePdfParser · useI18n      ← UI ↔ services
Services          claudeClient · pdfService · pdfTemplates   ← Pure, testable
                  diffService · storage
Store (Zustand)   resume · jd · analysis · rewrite · ui      ← Single source of truth
```

**Rules:**

- Components never call `fetch` directly. They go through hooks → services. This is the seam that makes the adapter swappable.
- Services are pure functions. They do not import React.
- `claudeClient.js` is the only module that talks to `api.anthropic.com`. API key, headers, model name, streaming, and timeouts live there.

### 4.2 Module layout

```
resume-optimizer/
├── public/
│   └── pdf-fonts/                   Inter Regular/Bold, Georgia TTFs (for react-pdf)
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.jsx           API key status badge + language toggle
│   │   │   └── StepIndicator.jsx
│   │   ├── steps/
│   │   │   ├── Step1_ResumeInput.jsx
│   │   │   ├── Step2_JDInput.jsx
│   │   │   ├── Step3_Analysis.jsx
│   │   │   └── Step4_Export.jsx
│   │   └── ui/
│   │       ├── GapTable.jsx
│   │       ├── ScoreCard.jsx
│   │       ├── RadarChart.jsx
│   │       ├── ResumeEditor.jsx     Markdown textarea + live preview
│   │       ├── DiffView.jsx         Word-level diff highlighter
│   │       ├── ApiKeyModal.jsx
│   │       └── Toast.jsx
│   ├── hooks/
│   │   ├── useClaudeApi.js
│   │   ├── usePdfParser.js
│   │   └── useI18n.js
│   ├── services/
│   │   ├── claudeClient.js          The adapter (see §5)
│   │   ├── pdfService.js            pdfjs-dist text extraction
│   │   ├── pdfTemplates/
│   │   │   ├── ClassicTemplate.jsx
│   │   │   ├── ModernTemplate.jsx
│   │   │   └── shared.js            Fonts, colors, parseResumeMarkdown()
│   │   ├── diffService.js           Word-level diff
│   │   └── storage.js               localStorage + sessionStorage wrappers
│   ├── store/
│   │   └── appStore.js              Zustand store (slices in §6)
│   ├── prompts/
│   │   ├── analyzePrompt.js
│   │   └── rewritePrompt.js
│   ├── i18n/
│   │   ├── en.json
│   │   ├── zh.json
│   │   └── index.js
│   ├── App.jsx
│   └── main.jsx
├── docs/
│   └── superpowers/specs/2026-05-22-resume-optimizer-design.md
├── .env.example
├── .gitignore
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── README.md
```

---

## 5. Claude client adapter

The single point of contact with the Anthropic API. Two public functions; everything else is implementation detail.

### 5.1 Interface

```js
// services/claudeClient.js

const MODEL = 'claude-sonnet-4-6';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.anthropic.com';
const ENDPOINT = `${API_BASE}/v1/messages`;
const TIMEOUT_ANALYZE_MS = 30_000;
const TIMEOUT_REWRITE_MS = 60_000;

export async function analyzeResume({ resumeMarkdown, jdText, apiKey, signal })
  → AnalysisJSON

export async function rewriteResume({ resumeMarkdown, jdText, apiKey, onChunk, signal })
  → string   // final markdown
```

### 5.2 Mode flip (Approach C)

```js
function buildHeaders(apiKey) {
  const isDirect = API_BASE === 'https://api.anthropic.com';
  return {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...(isDirect && {
      'x-api-key': apiKey,
      'anthropic-dangerous-direct-browser-calls': 'true'
    })
  };
}
```

- **Direct mode (default):** `VITE_API_BASE` unset → talks to Anthropic directly, sends user's key.
- **Proxy mode (future):** Set `VITE_API_BASE=https://my-worker.workers.dev` at build time → key header omitted; worker injects real key server-side. Components do not change.

### 5.3 Streaming (rewrite only)

Reads SSE response. Each `content_block_delta` event appends to `full` and calls `onChunk(full)`. The hook then writes to `rewrite.optimized` in Zustand, which re-renders the editor.

### 5.4 Typed errors

`claudeClient` classifies failures into typed errors so callers can react appropriately:

| Class | Trigger | UI response |
|---|---|---|
| `InvalidApiKeyError` | HTTP 401 | Re-open `ApiKeyModal`, clear sessionStorage key, toast |
| `RateLimitError` | HTTP 429 | Inline banner with `retry-after` countdown |
| `TimeoutError` | `AbortController` fires from timeout | Inline banner: "Network slow — Retry" |
| `NetworkError` | `fetch` throws | Inline banner: "Network issue — Retry" |
| `ServerError` | HTTP 5xx | Inline banner: "Anthropic API issue — Retry" |
| `MalformedResponseError` | `parseAnalysisJson` fails | Auto-retry once with stricter instruction; then user-facing error |

All callers receive an `AbortSignal` parameter so the UI can cancel mid-call.

### 5.5 Prompts

`prompts/analyzePrompt.js` and `prompts/rewritePrompt.js` export builder functions that take `(resumeMarkdown, jdText)` and return the final user-message string. The analyze prompt ends with: *"Respond with JSON only. No markdown fences, no preamble, no explanation."* The rewrite prompt requests pure markdown output with no commentary.

`parseAnalysisJson(text)` strips ```` ```json ```` fences defensively (even though we ask for none) and validates the shape against the `AnalysisJSON` contract in §7 before returning.

---

## 6. State shape

Single Zustand store, five slices:

```js
{
  // Step 1 — input
  resume: {
    source: 'pdf' | 'form',
    pdfText: string | null,
    structured: {
      basics: { name, email, phone, linkedin, location },
      experience: [{ company, title, start, end, bullets[] }],
      education: [{ school, degree, major, start, end, gpa }],
      skills: { technical: string[], soft: string[] },
      projects: [{ name, description, link }],
      certifications: [{ name, issuer, date }]
    },
    markdown: string                 // serialized for prompts + on-screen display
  },

  // Step 2 — JD
  jd: { text: string, role: string?, company: string? },

  // Step 3a — analysis
  analysis: {
    status: 'idle' | 'loading' | 'success' | 'error',
    data: AnalysisJSON | null,
    error: string | null
  },

  // Step 3b — rewrite (streamed)
  rewrite: {
    status: 'idle' | 'streaming' | 'success' | 'error',
    original: string,                // snapshot of resume.markdown when started
    optimized: string,               // grows during stream
    edited: string | null,           // null = unchanged; otherwise user's manual edits
    error: string | null
  },

  // Step 4 / global
  ui: {
    apiKey: string | null,           // mirrored from sessionStorage at boot
    template: 'classic' | 'modern',
    locale: 'en' | 'zh',
    toasts: Toast[]
  }
}
```

### 6.1 Persistence rules (storage.js)

| Slice | Storage | Wiped when | Why |
|---|---|---|---|
| `resume.structured` | localStorage | Manual reset | Don't lose typing |
| `ui.locale`, `ui.template` | localStorage | Manual reset | User preferences stick |
| `ui.apiKey` | sessionStorage | Tab close | Security — spec requirement |
| `jd.text`, `analysis`, `rewrite` | memory only | Page refresh | Job-specific, must not bleed across sessions |

### 6.2 Edit-vs-optimized resolution

Export step uses `rewrite.edited ?? rewrite.optimized`. The `null` sentinel distinguishes "user has touched the editor" from "value equals optimized by coincidence."

---

## 7. AI contracts

### 7.1 Gap analysis JSON

```json
{
  "score": 72,
  "scoreBreakdown": {
    "skills": 65, "experience": 80, "keywords": 70, "education": 75
  },
  "summary": "Overall narrative assessment...",
  "gaps": [
    {
      "category": "Technical Skills",
      "item": "Kubernetes",
      "status": "missing | partial | matched",
      "importance": "high | medium | low",
      "suggestion": "Actionable advice..."
    }
  ],
  "strengths": ["..."],
  "improvements": ["..."]
}
```

All fields required. `score` and `scoreBreakdown.*` are integers 0–100. `parseAnalysisJson` validates shape; failures route to `MalformedResponseError` (one auto-retry, then user-facing).

### 7.2 Rewrite output

Pure Markdown with no commentary or fences. Heading conventions used by the markdown→structured parser (see §8.2):
- `# Name` — name
- Lines immediately under H1 — contact info
- `## Section` — section heading (Summary, Experience, Education, Skills, etc.)
- `- ` or `* ` bullets — list items
- Within Experience: `**Title** · Company · dates` pattern for entries

---

## 8. PDF export

### 8.1 Templates

Two `@react-pdf/renderer` components, both producing A4 single-page PDFs:

- **`ClassicTemplate.jsx`** — Georgia serif, centered header, full-width single column, uppercase section labels with letterspacing. ~80 LOC.
- **`ModernTemplate.jsx`** — Inter sans-serif, flex two-column layout, deep-blue (#1e3a5f) sidebar at 35% width with contact/skills/education; main column at 65% with summary/experience. ~120 LOC.

Shared in `pdfTemplates/shared.js`: `Font.register` calls, color constants, page padding, and a few reusable building blocks (`SectionHeading`, `BulletList`, `ContactLine`).

### 8.2 Markdown → structured parser

`parseResumeMarkdown(md) → ResumeData` is one ~60-LOC pure function in `pdfTemplates/shared.js`. Heuristics described in §7.2. If parsing yields an unusable structure (missing name or no sections), Step 4 falls back to a `PlainTextTemplate` that renders the raw markdown in a monospaced block — export never fully breaks.

### 8.3 Step 4 UI

- Template picker (Classic / Modern, persisted to `ui.template`)
- Inline preview via react-pdf's `<PDFViewer>`
- "Download PDF" via `<PDFDownloadLink>`
- "Copy Markdown" via `navigator.clipboard.writeText(rewrite.edited ?? rewrite.optimized)`

### 8.4 Font loading

Inter Regular + Bold (~300KB) and Georgia (~200KB) live in `public/pdf-fonts/`, fetched lazily the first time a template renders. Step 4 may show a brief font-load delay the first visit.

---

## 9. Step-by-step UX

### Step 1 — Resume input

Two tabs in the same view:

- **Upload PDF:** Drag-or-click drop zone → `pdfService.extractText(file)` → preview text in a read-only textarea. User clicks "Use this" to commit. Parse failures (corrupt file, scanned image, or extracted text under 50 chars) surface a toast and auto-flip to Form tab.
- **Form:** Standard structured form with dynamic add/remove for experience/education/projects/certifications. Skills as chip inputs split Technical / Soft. Saves to localStorage on every change (debounced 500ms).

**On commit:** Form mode serializes structured data into Markdown and stores both `resume.structured` and `resume.markdown`. PDF mode stores raw extracted text in `resume.pdfText` and copies it directly into `resume.markdown` (`resume.structured` stays empty). Either way, `resume.markdown` is the canonical input to Claude.

### Step 2 — JD input

Single textarea + optional role/company fields. Character counter. Validation: minimum 100 chars before "Next" enables.

### Step 3 — Analysis & rewrite

Two phases in one screen:

**Phase A — Gap analysis (one-shot):**
- Skeleton loader while `analysis.status === 'loading'`
- ScoreCard: large animated number, breakdown bars
- RadarChart (recharts): four-axis (skills/experience/keywords/education)
- GapTable: sortable/filterable by category, importance, status. Color: green=matched, yellow=partial, red=missing.
- Strengths + Improvements lists.
- "Rewrite my resume" button starts Phase B.

**Phase B — Rewrite (streamed):**
- Two-pane view: left = `rewrite.original` (read-only markdown rendered), right = `ResumeEditor` (editable markdown textarea + live rendered preview underneath).
- During streaming, the right pane updates in real-time; word-level diff against original is recomputed on each chunk and highlights in the rendered preview.
- User can stop generation (cancel button → `AbortController.abort()`).
- After streaming completes, the user can edit; edits set `rewrite.edited`.
- "Next: Export" button proceeds to Step 4.

### Step 4 — Export

Template picker, inline PDF preview, download + copy buttons. Spec §8.3.

---

## 10. Error handling

Recoverable errors always offer a Retry. No silent failures.

| Source | Failure | Behavior |
|---|---|---|
| `pdfService.extractText` | Corrupt PDF, scanned image, or extracted text under 50 chars | Toast + auto-flip to Form tab |
| `claudeClient.analyzeResume` | See §5.4 | Inline banner per error type |
| `claudeClient.rewriteResume` | Stream interrupted | Preserve partial text in `rewrite.optimized` (visible to user), banner: "Stream stopped — Retry" (full restart; cannot resume a stream mid-way) |
| `parseAnalysisJson` | Invalid JSON | Auto-retry once with stricter prompt; then user-facing error |
| `parseResumeMarkdown` | Unparseable structure | Fall back to `PlainTextTemplate`, toast warning |
| Network | Offline | Toast: "You're offline — Retry when reconnected" |

---

## 11. Internationalization

`src/i18n/{en,zh}.json` are flat dictionaries. `useI18n()` returns `(key, vars?) => string`. Locale stored in `ui.locale` (persisted to localStorage). Header has a toggle that flips between EN and ZH. All UI strings go through `t('…')`; resume/JD content remains in whatever language the user entered.

Default locale: detected from `navigator.language`, fallback EN.

---

## 12. UI / theme

- **Brand color:** Deep blue `#1e3a5f` (also used in Modern template sidebar).
- **Background:** Light gray, white cards with subtle shadow.
- **Typography:** Inter on screen (matches Modern template).
- **Step indicator:** Horizontal four-step bar at top; completed steps clickable to go back.
- **Animations:** Tailwind transitions on state changes. Number rollup on ScoreCard (~600ms ease). Skeleton shimmer for loading. Toast slide-in from top-right.
- **Responsive:** Desktop-first. Mobile: step layouts collapse to single column; diff view stacks vertically below 768px.

---

## 13. Testing

| Layer | Coverage target | Stack |
|---|---|---|
| Services (pure functions) | ~70% lines | Vitest |
| `claudeClient` (headers, mode flip, timeout, error classification) | All paths | Vitest + `msw` |
| Components (GapTable filter/sort, DiffView, ApiKeyModal) | ~50% lines | Vitest + React Testing Library |
| End-to-end (happy path) | One scenario | Playwright + mocked Claude responses |

**Skipped intentionally:** pixel-snapshot tests of PDF templates, layout component tests, tests against the real Anthropic API.

---

## 14. Build & deploy

### 14.1 `package.json` scripts

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:e2e": "playwright test",
  "deploy": "npm run build && gh-pages -d dist"
}
```

### 14.2 `vite.config.js`

- `base: '/resume-optimizer/'`
- React Router `basename={import.meta.env.BASE_URL}`
- pdfjs-dist worker configured via `?url` import to land in the build correctly

### 14.3 `.env.example`

```
VITE_ANTHROPIC_API_KEY=your_api_key_here   # dev only — production users enter via UI
# VITE_API_BASE=                           # leave empty for direct mode; set for proxy
```

### 14.4 `.gitignore`

`node_modules/`, `dist/`, `.env`, `.superpowers/`, `playwright-report/`, `test-results/`

### 14.5 README.md

Bilingual (EN + ZH) sections covering: description, screenshots placeholder, local dev (`npm i && npm run dev`), GH Pages deploy (`npm run deploy`), tech stack, BYO API key notice with link to console.anthropic.com, MIT license.

---

## 15. Implementation order

1. Scaffold Vite + React + Tailwind + Router + Zustand
2. Layout shell: `Header`, `StepIndicator`, four route placeholders
3. `storage.js`, `useI18n` + EN/ZH dictionaries
4. Step 1: form mode (with localStorage persistence)
5. Step 1: PDF upload mode (`pdfService.extractText`)
6. Step 2: JD input + validation
7. `claudeClient.js` + prompt builders + `parseAnalysisJson` + typed errors
8. `useClaudeApi` hook + `ApiKeyModal`
9. Step 3 Phase A: ScoreCard, RadarChart, GapTable
10. `diffService` + Step 3 Phase B: streaming rewrite + DiffView + ResumeEditor
11. `pdfTemplates/shared.js` + ClassicTemplate + ModernTemplate + PlainTextTemplate
12. Step 4: template picker + preview + download + copy
13. Toast system, animations, mobile breakpoints
14. Tests
15. Deploy config + first GitHub Pages deploy

---

## 16. Out of scope (explicit non-goals)

- Backend / database / accounts
- Multi-page PDFs (templates target single-page A4)
- Cover letter generation
- Multiple resume versions stored per user
- Worker proxy implementation (designed for, not built)
- Rich-text editor (Markdown only)
- Real-time collaboration
