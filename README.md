# AI Resume Optimizer

> Tailor your resume to any job in seconds, powered by Claude.

A pure-frontend web app that takes your resume + a job description, then uses the Anthropic Claude API to:

- **Score** how well your resume matches the JD (0–100, with skills/experience/keywords/education breakdown)
- **Identify gaps** between what the JD asks for and what your resume shows
- **Rewrite** your resume in real-time, embedding JD keywords and reframing achievements with the STAR method
- **Export** an ATS-friendly PDF (vector text, selectable, parseable) in two template styles

No backend. Your data and API key never leave your browser.

[简体中文 →](#中文说明)

---

## Demo

> _Screenshots coming soon — `TODO: add Step 1 → Step 4 screenshots once first GH Pages deploy is live._

---

## Tech stack

- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS v3
- **AI:** Anthropic Messages API, model `claude-sonnet-4-6`, direct browser → Anthropic with `anthropic-dangerous-direct-browser-calls`
- **PDF parse:** `pdfjs-dist`
- **PDF generate:** `@react-pdf/renderer` (vector, ATS-safe)
- **Routing:** React Router v6
- **State:** Zustand
- **Charts:** Recharts (radar)
- **Diff:** `diff` (word-level)
- **Deploy:** GitHub Pages via `gh-pages`

---

## Run locally

```bash
git clone https://github.com/chenkan0617chris/resume-optimizer.git
cd resume-optimizer
npm install
npm run dev
```

Open `http://localhost:5173/resume-optimizer/`.

**API key:** You'll be prompted to paste your Anthropic API key on first use. Get one at [console.anthropic.com](https://console.anthropic.com/). The key is stored only in `sessionStorage` (wiped when you close the tab). For local dev, you can put `VITE_ANTHROPIC_API_KEY=sk-ant-…` in a `.env` file (see `.env.example`).

---

## Deploy to GitHub Pages

```bash
npm run deploy
```

This runs `vite build` and pushes `dist/` to the `gh-pages` branch via the `gh-pages` package. The site will be live at `https://<your-username>.github.io/resume-optimizer/`.

**One-time setup:**

1. In your GitHub repo, go to **Settings → Pages**.
2. Set "Source" to **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.
3. Save. The first deploy may take 1–2 minutes to go live.

If your repo isn't named `resume-optimizer`, edit the `base` field in `vite.config.js` to match your repo name.

---

## How it works

```
Step 1: Upload PDF or fill structured form  →  resume.markdown
Step 2: Paste job description               →  jd.text
Step 3: Auto-analyze  →  AnalysisJSON (score, gaps, strengths, improvements)
        Manual rewrite  →  streamed Markdown (you can edit it)
Step 4: Pick template  →  vector PDF download (Classic or Modern)
```

The app is structured in layers (see `docs/superpowers/specs/2026-05-22-resume-optimizer-design.md` for the full design):

- **Components** never call `fetch` directly
- All Claude API calls go through `src/services/claudeClient.js` — a single adapter
- Set `VITE_API_BASE=https://your-worker.workers.dev` at build time to route through a server-side proxy (e.g., Cloudflare Worker) without touching any component code

---

## Privacy

- Your **API key** lives only in `sessionStorage` (cleared when you close the tab)
- Your **resume content** in form mode is saved to `localStorage` for draft recovery; clear browser data to wipe
- Resume + JD are sent **directly to Anthropic** for analysis and rewriting — no proxy, no logging, no analytics
- All processing happens client-side. There is no backend server

---

## Roadmap

- [ ] Inter + Georgia TTFs in the PDF templates (currently uses Helvetica/Times for zero-install operation)
- [ ] Cover-letter generator
- [ ] Multi-page PDF support
- [ ] Cloudflare Worker proxy reference implementation
- [ ] Bring-your-own-template SDK

---

## License

MIT — see [LICENSE](LICENSE).

---

# 中文说明

> 一款基于 Claude 的简历智能优化工具，帮你在数秒内根据职位描述定制简历。

纯前端 Web 应用，输入你的简历和职位描述（JD），由 Anthropic Claude API 完成：

- **打分**：综合匹配度 0–100，按技能 / 经验 / 关键词 / 学历四个维度细分
- **差距分析**：识别 JD 要求但简历缺失的部分，按重要程度排序
- **简历重写**：流式输出优化版本，自动嵌入 JD 关键词，用 STAR 方法重述工作经历
- **PDF 导出**：ATS 友好的矢量 PDF（可被解析、可选中），提供两种模板风格

无后端，你的数据和 API 密钥不会离开你的浏览器。

## 本地运行

```bash
git clone https://github.com/chenkan0617chris/resume-optimizer.git
cd resume-optimizer
npm install
npm run dev
```

打开 `http://localhost:5173/resume-optimizer/`。

**API 密钥**：首次使用时会弹窗提示输入 Anthropic API 密钥。前往 [console.anthropic.com](https://console.anthropic.com/) 获取。密钥仅保存在 `sessionStorage`（关闭标签页即清除）。开发环境可在 `.env` 中设置 `VITE_ANTHROPIC_API_KEY`，参见 `.env.example`。

## 部署到 GitHub Pages

```bash
npm run deploy
```

会执行 `vite build` 并通过 `gh-pages` 包推送 `dist/` 到 `gh-pages` 分支。站点会在 `https://<你的用户名>.github.io/resume-optimizer/` 生效。

**一次性配置**：仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，分支选 `gh-pages`，目录选 `/ (root)`，保存即可。

## 技术栈

React 18 · Vite · Tailwind v3 · Zustand · React Router v6 · @react-pdf/renderer · pdfjs-dist · Recharts · diff

## 隐私

- API 密钥仅存于 `sessionStorage`（关闭标签自动清除）
- 表单模式下简历草稿保存在 `localStorage`，清除浏览数据即可移除
- 简历和 JD 直接发送给 Anthropic，无代理、无日志、无统计
- 所有处理都在客户端完成，无后端服务器

## 协议

MIT
