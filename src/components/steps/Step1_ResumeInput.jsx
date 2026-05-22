// components/steps/Step1_ResumeInput.jsx
// Step 1 — Resume input. Two tabs: PDF upload or structured form.
// Spec §9 (Step 1 UX) and §6 (state shape).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useAppStore,
  serializeResumeMarkdown,
  emptyStructuredResume
} from '../../store/appStore.js';
import { saveResumeDraft, loadResumeDraft } from '../../services/storage.js';
import useI18n from '../../hooks/useI18n.js';
import usePdfParser from '../../hooks/usePdfParser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function structuredIsEmpty(s) {
  if (!s || typeof s !== 'object') return true;
  const b = s.basics || {};
  const basicsEmpty =
    !b.name && !b.email && !b.phone && !b.linkedin && !b.location;
  const noExp = !Array.isArray(s.experience) || s.experience.length === 0;
  const noEdu = !Array.isArray(s.education) || s.education.length === 0;
  const noProj = !Array.isArray(s.projects) || s.projects.length === 0;
  const noCerts =
    !Array.isArray(s.certifications) || s.certifications.length === 0;
  const sk = s.skills || {};
  const noSkills =
    (!Array.isArray(sk.technical) || sk.technical.length === 0) &&
    (!Array.isArray(sk.soft) || sk.soft.length === 0);
  return basicsEmpty && noExp && noEdu && noProj && noCerts && noSkills;
}

function hasAnyContent(s) {
  if (!s) return false;
  const expOk = Array.isArray(s.experience) && s.experience.length > 0;
  const eduOk = Array.isArray(s.education) && s.education.length > 0;
  const projOk = Array.isArray(s.projects) && s.projects.length > 0;
  const sk = s.skills || {};
  const skOk =
    (Array.isArray(sk.technical) && sk.technical.length > 0) ||
    (Array.isArray(sk.soft) && sk.soft.length > 0);
  return expOk || eduOk || projOk || skOk;
}

function emptyExperience() {
  return { company: '', title: '', start: '', end: '', bullets: [''] };
}

function emptyEducation() {
  return {
    school: '',
    degree: '',
    major: '',
    start: '',
    end: '',
    gpa: ''
  };
}

function emptyProject() {
  return { name: '', description: '', link: '' };
}

function emptyCertification() {
  return { name: '', issuer: '', date: '' };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Step1_ResumeInput() {
  const t = useI18n();
  const navigate = useNavigate();

  const storedSource = useAppStore((s) => s.resume.source);
  const storedStructured = useAppStore((s) => s.resume.structured);
  const storedPdfText = useAppStore((s) => s.resume.pdfText);
  const setResume = useAppStore((s) => s.setResume);
  const updateResumeForm = useAppStore((s) => s.updateResumeForm);
  const pushToast = useAppStore((s) => s.pushToast);

  // Tab: 'pdf' | 'form'
  const [tab, setTab] = useState(storedSource === 'pdf' ? 'pdf' : 'pdf');

  // --- PDF tab state ----------------------------------------------------
  const { parsePdf, parsing } = usePdfParser();
  const [extracted, setExtracted] = useState(storedPdfText || '');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      try {
        const text = await parsePdf(file);
        if (typeof text === 'string' && text.trim().length > 0) {
          setExtracted(text);
        }
      } catch (err) {
        if (err && err.message === 'PDF_EMPTY') {
          // Hook already pushed toast; auto-flip to form tab.
          setTab('form');
          setExtracted('');
        }
      }
    },
    [parsePdf]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onFileInputChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so picking the same file twice still triggers change.
      e.target.value = '';
    },
    [handleFile]
  );

  const commitPdf = useCallback(() => {
    setResume({
      source: 'pdf',
      pdfText: extracted,
      structured: emptyStructuredResume(),
      markdown: extracted
    });
    navigate('/step/2');
  }, [extracted, navigate, setResume]);

  const replacePdf = useCallback(() => {
    setExtracted('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // --- Form tab state ---------------------------------------------------
  const [form, setForm] = useState(() => {
    // Initialize from store, fallback to empty default.
    const seed = storedStructured && !structuredIsEmpty(storedStructured)
      ? storedStructured
      : emptyStructuredResume();
    return seed;
  });

  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef(null);
  const debounceTimer = useRef(null);
  const skipDebounceOnNextChange = useRef(true); // skip very first render

  // Hydrate from localStorage on mount if store is empty.
  useEffect(() => {
    if (structuredIsEmpty(storedStructured)) {
      const draft = loadResumeDraft();
      if (draft && typeof draft === 'object' && !structuredIsEmpty(draft)) {
        const merged = {
          ...emptyStructuredResume(),
          ...draft,
          basics: { ...emptyStructuredResume().basics, ...(draft.basics || {}) },
          skills: { ...emptyStructuredResume().skills, ...(draft.skills || {}) }
        };
        setForm(merged);
        updateResumeForm(merged);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced sync of `form` into the store + localStorage.
  useEffect(() => {
    if (skipDebounceOnNextChange.current) {
      skipDebounceOnNextChange.current = false;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updateResumeForm(form);
      saveResumeDraft(form);
      setSavedFlash(true);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 1500);
    }, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [form, updateResumeForm]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  // --- Form mutators ----------------------------------------------------

  const setBasics = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      basics: { ...prev.basics, [field]: value }
    }));
  }, []);

  const setExperience = useCallback((idx, field, value) => {
    setForm((prev) => {
      const next = [...(prev.experience || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, experience: next };
    });
  }, []);

  const setExperienceBullet = useCallback((expIdx, bIdx, value) => {
    setForm((prev) => {
      const exps = [...(prev.experience || [])];
      const cur = { ...exps[expIdx] };
      const bullets = [...(cur.bullets || [])];
      bullets[bIdx] = value;
      cur.bullets = bullets;
      exps[expIdx] = cur;
      return { ...prev, experience: exps };
    });
  }, []);

  const addExperienceBullet = useCallback((expIdx) => {
    setForm((prev) => {
      const exps = [...(prev.experience || [])];
      const cur = { ...exps[expIdx] };
      cur.bullets = [...(cur.bullets || []), ''];
      exps[expIdx] = cur;
      return { ...prev, experience: exps };
    });
  }, []);

  const removeExperienceBullet = useCallback((expIdx, bIdx) => {
    setForm((prev) => {
      const exps = [...(prev.experience || [])];
      const cur = { ...exps[expIdx] };
      const bullets = [...(cur.bullets || [])];
      bullets.splice(bIdx, 1);
      cur.bullets = bullets.length ? bullets : [''];
      exps[expIdx] = cur;
      return { ...prev, experience: exps };
    });
  }, []);

  const addExperience = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      experience: [...(prev.experience || []), emptyExperience()]
    }));
  }, []);

  const removeExperience = useCallback((idx) => {
    setForm((prev) => {
      const exps = [...(prev.experience || [])];
      exps.splice(idx, 1);
      return { ...prev, experience: exps };
    });
  }, []);

  const setEducation = useCallback((idx, field, value) => {
    setForm((prev) => {
      const next = [...(prev.education || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, education: next };
    });
  }, []);

  const addEducation = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      education: [...(prev.education || []), emptyEducation()]
    }));
  }, []);

  const removeEducation = useCallback((idx) => {
    setForm((prev) => {
      const next = [...(prev.education || [])];
      next.splice(idx, 1);
      return { ...prev, education: next };
    });
  }, []);

  const addSkillChip = useCallback((kind, value) => {
    const v = value.trim().replace(/,$/, '').trim();
    if (!v) return;
    setForm((prev) => {
      const cur = Array.isArray(prev.skills?.[kind]) ? prev.skills[kind] : [];
      if (cur.includes(v)) return prev;
      return {
        ...prev,
        skills: {
          ...prev.skills,
          [kind]: [...cur, v]
        }
      };
    });
  }, []);

  const removeSkillChip = useCallback((kind, idx) => {
    setForm((prev) => {
      const cur = Array.isArray(prev.skills?.[kind]) ? prev.skills[kind] : [];
      const next = [...cur];
      next.splice(idx, 1);
      return {
        ...prev,
        skills: { ...prev.skills, [kind]: next }
      };
    });
  }, []);

  const setProject = useCallback((idx, field, value) => {
    setForm((prev) => {
      const next = [...(prev.projects || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, projects: next };
    });
  }, []);

  const addProject = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      projects: [...(prev.projects || []), emptyProject()]
    }));
  }, []);

  const removeProject = useCallback((idx) => {
    setForm((prev) => {
      const next = [...(prev.projects || [])];
      next.splice(idx, 1);
      return { ...prev, projects: next };
    });
  }, []);

  const setCertification = useCallback((idx, field, value) => {
    setForm((prev) => {
      const next = [...(prev.certifications || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, certifications: next };
    });
  }, []);

  const addCertification = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      certifications: [...(prev.certifications || []), emptyCertification()]
    }));
  }, []);

  const removeCertification = useCallback((idx) => {
    setForm((prev) => {
      const next = [...(prev.certifications || [])];
      next.splice(idx, 1);
      return { ...prev, certifications: next };
    });
  }, []);

  // --- Form next ---------------------------------------------------------
  const onFormNext = useCallback(() => {
    const name = (form.basics?.name || '').trim();
    if (!name) {
      pushToast({ type: 'warning', message: 'step1.validation.nameRequired' });
      return;
    }
    if (!hasAnyContent(form)) {
      pushToast({ type: 'warning', message: 'step1.validation.needContent' });
      return;
    }
    // Flush latest form synchronously so navigation has fresh markdown.
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    updateResumeForm(form);
    saveResumeDraft(form);
    navigate('/step/2');
  }, [form, navigate, pushToast, updateResumeForm]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          {t('step1.heading')}
        </h1>
        <p className="text-sm text-slate-600">{t('step1.subheading')}</p>
      </header>

      <div
        role="tablist"
        aria-label={t('step1.heading')}
        className="inline-flex rounded-md border border-slate-200 bg-white p-1 shadow-sm"
      >
        <TabButton
          active={tab === 'pdf'}
          onClick={() => setTab('pdf')}
          label={t('step1.tabs.pdf')}
        />
        <TabButton
          active={tab === 'form'}
          onClick={() => setTab('form')}
          label={t('step1.tabs.form')}
        />
      </div>

      <div className="card">
        {tab === 'pdf' ? (
          <PdfPanel
            t={t}
            extracted={extracted}
            parsing={parsing}
            dragOver={dragOver}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onPick={() => fileInputRef.current?.click()}
            onFileInputChange={onFileInputChange}
            fileInputRef={fileInputRef}
            onUse={commitPdf}
            onReplace={replacePdf}
          />
        ) : (
          <FormPanel
            t={t}
            form={form}
            savedFlash={savedFlash}
            setBasics={setBasics}
            setExperience={setExperience}
            setExperienceBullet={setExperienceBullet}
            addExperienceBullet={addExperienceBullet}
            removeExperienceBullet={removeExperienceBullet}
            addExperience={addExperience}
            removeExperience={removeExperience}
            setEducation={setEducation}
            addEducation={addEducation}
            removeEducation={removeEducation}
            addSkillChip={addSkillChip}
            removeSkillChip={removeSkillChip}
            setProject={setProject}
            addProject={addProject}
            removeProject={removeProject}
            setCertification={setCertification}
            addCertification={addCertification}
            removeCertification={removeCertification}
            onNext={onFormNext}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'px-4 py-1.5 text-sm font-medium rounded transition-colors ' +
        (active
          ? 'bg-brand text-white shadow'
          : 'text-slate-600 hover:text-slate-900')
      }
    >
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent"
    />
  );
}

function PdfPanel({
  t,
  extracted,
  parsing,
  dragOver,
  onDrop,
  onDragOver,
  onDragLeave,
  onPick,
  onFileInputChange,
  fileInputRef,
  onUse,
  onReplace
}) {
  if (parsing) {
    return (
      <div className="flex items-center gap-3 text-slate-700">
        <Spinner />
        <span>{t('step1.pdf.parsing')}</span>
      </div>
    );
  }

  if (extracted) {
    return (
      <div className="space-y-3">
        <label
          htmlFor="pdf-preview"
          className="block text-sm font-medium text-slate-700"
        >
          {t('step1.pdf.preview')}
        </label>
        <textarea
          id="pdf-preview"
          readOnly
          rows={12}
          value={extracted}
          className="input font-mono text-xs leading-relaxed bg-slate-50"
        />
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={onUse}>
            {t('step1.pdf.useThis')}
          </button>
          <button type="button" className="btn-secondary" onClick={onReplace}>
            {t('step1.pdf.replace')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPick();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={
          'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-10 text-center cursor-pointer transition-colors ' +
          (dragOver
            ? 'border-brand bg-brand-50'
            : 'border-slate-300 hover:border-brand hover:bg-slate-50')
        }
      >
        <p className="text-sm font-medium text-slate-700">
          {t('step1.pdf.dropzone')}
        </p>
        <p className="text-xs text-slate-500">{t('step1.pdf.dropzoneHint')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onFileInputChange}
        />
      </div>
    </div>
  );
}

function FormPanel(props) {
  const {
    t,
    form,
    savedFlash,
    setBasics,
    setExperience,
    setExperienceBullet,
    addExperienceBullet,
    removeExperienceBullet,
    addExperience,
    removeExperience,
    setEducation,
    addEducation,
    removeEducation,
    addSkillChip,
    removeSkillChip,
    setProject,
    addProject,
    removeProject,
    setCertification,
    addCertification,
    removeCertification,
    onNext
  } = props;

  return (
    <div className="space-y-8">
      <BasicsSection t={t} basics={form.basics} setBasics={setBasics} />
      <ExperienceSection
        t={t}
        items={form.experience || []}
        setItem={setExperience}
        setBullet={setExperienceBullet}
        addBullet={addExperienceBullet}
        removeBullet={removeExperienceBullet}
        addItem={addExperience}
        removeItem={removeExperience}
      />
      <EducationSection
        t={t}
        items={form.education || []}
        setItem={setEducation}
        addItem={addEducation}
        removeItem={removeEducation}
      />
      <SkillsSection
        t={t}
        skills={form.skills || { technical: [], soft: [] }}
        addChip={addSkillChip}
        removeChip={removeSkillChip}
      />
      <ProjectsSection
        t={t}
        items={form.projects || []}
        setItem={setProject}
        addItem={addProject}
        removeItem={removeProject}
      />
      <CertificationsSection
        t={t}
        items={form.certifications || []}
        setItem={setCertification}
        addItem={addCertification}
        removeItem={removeCertification}
      />

      <div className="flex items-center justify-between pt-2">
        <span
          aria-live="polite"
          className={
            'text-xs text-slate-500 transition-opacity duration-300 ' +
            (savedFlash ? 'opacity-100' : 'opacity-0')
          }
        >
          {t('step1.form.autosaved')}
        </span>
        <button type="button" className="btn-primary" onClick={onNext}>
          {t('nav.next')}
        </button>
      </div>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-1">
      {children}
    </h2>
  );
}

function Field({ label, children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function BasicsSection({ t, basics, setBasics }) {
  const b = basics || {};
  return (
    <section className="space-y-3">
      <SectionHeading>{t('step1.form.basics.heading')}</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field htmlFor="basics-name" label={t('step1.form.basics.name')}>
          <input
            id="basics-name"
            className="input"
            value={b.name || ''}
            onChange={(e) => setBasics('name', e.target.value)}
            required
          />
        </Field>
        <Field htmlFor="basics-email" label={t('step1.form.basics.email')}>
          <input
            id="basics-email"
            type="email"
            className="input"
            value={b.email || ''}
            onChange={(e) => setBasics('email', e.target.value)}
          />
        </Field>
        <Field htmlFor="basics-phone" label={t('step1.form.basics.phone')}>
          <input
            id="basics-phone"
            className="input"
            value={b.phone || ''}
            onChange={(e) => setBasics('phone', e.target.value)}
          />
        </Field>
        <Field htmlFor="basics-linkedin" label={t('step1.form.basics.linkedin')}>
          <input
            id="basics-linkedin"
            className="input"
            value={b.linkedin || ''}
            onChange={(e) => setBasics('linkedin', e.target.value)}
          />
        </Field>
        <Field htmlFor="basics-location" label={t('step1.form.basics.location')}>
          <input
            id="basics-location"
            className="input"
            value={b.location || ''}
            onChange={(e) => setBasics('location', e.target.value)}
          />
        </Field>
      </div>
    </section>
  );
}

function ExperienceSection({
  t,
  items,
  setItem,
  setBullet,
  addBullet,
  removeBullet,
  addItem,
  removeItem
}) {
  return (
    <section className="space-y-3">
      <SectionHeading>{t('step1.form.experience.heading')}</SectionHeading>
      <div className="space-y-4">
        {items.map((exp, idx) => (
          <div
            key={idx}
            className="rounded-md border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-700">
                #{idx + 1}
              </h3>
              {items.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-red-600"
                  onClick={() => removeItem(idx)}
                >
                  {t('step1.form.experience.remove')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('step1.form.experience.company')}>
                <input
                  className="input"
                  value={exp.company || ''}
                  onChange={(e) => setItem(idx, 'company', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.experience.title')}>
                <input
                  className="input"
                  value={exp.title || ''}
                  onChange={(e) => setItem(idx, 'title', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.experience.start')}>
                <input
                  className="input"
                  value={exp.start || ''}
                  onChange={(e) => setItem(idx, 'start', e.target.value)}
                  placeholder="Jan 2022"
                />
              </Field>
              <Field label={t('step1.form.experience.end')}>
                <input
                  className="input"
                  value={exp.end || ''}
                  onChange={(e) => setItem(idx, 'end', e.target.value)}
                  placeholder={t('step1.form.experience.endPresent')}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-600">
                {t('step1.form.experience.bullets')}
              </span>
              {(exp.bullets || []).map((b, bIdx) => (
                <div key={bIdx} className="flex items-center gap-2">
                  <input
                    className="input"
                    value={b}
                    onChange={(e) => setBullet(idx, bIdx, e.target.value)}
                    placeholder={t(
                      'step1.form.experience.bulletPlaceholder'
                    )}
                  />
                  {(exp.bullets || []).length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-slate-500 hover:text-red-600 shrink-0"
                      onClick={() => removeBullet(idx, bIdx)}
                      aria-label={t('nav.remove')}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-brand hover:text-brand-light"
                onClick={() => addBullet(idx)}
              >
                + {t('step1.form.experience.addBullet')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary" onClick={addItem}>
        + {t('step1.form.experience.add')}
      </button>
    </section>
  );
}

function EducationSection({ t, items, setItem, addItem, removeItem }) {
  return (
    <section className="space-y-3">
      <SectionHeading>{t('step1.form.education.heading')}</SectionHeading>
      <div className="space-y-4">
        {items.map((edu, idx) => (
          <div
            key={idx}
            className="rounded-md border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-700">
                #{idx + 1}
              </h3>
              {items.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-red-600"
                  onClick={() => removeItem(idx)}
                >
                  {t('nav.remove')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('step1.form.education.school')}>
                <input
                  className="input"
                  value={edu.school || ''}
                  onChange={(e) => setItem(idx, 'school', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.education.degree')}>
                <input
                  className="input"
                  value={edu.degree || ''}
                  onChange={(e) => setItem(idx, 'degree', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.education.major')}>
                <input
                  className="input"
                  value={edu.major || ''}
                  onChange={(e) => setItem(idx, 'major', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.education.gpa')}>
                <input
                  className="input"
                  value={edu.gpa || ''}
                  onChange={(e) => setItem(idx, 'gpa', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.education.start')}>
                <input
                  className="input"
                  value={edu.start || ''}
                  onChange={(e) => setItem(idx, 'start', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.education.end')}>
                <input
                  className="input"
                  value={edu.end || ''}
                  onChange={(e) => setItem(idx, 'end', e.target.value)}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary" onClick={addItem}>
        + {t('step1.form.education.add')}
      </button>
    </section>
  );
}

function ChipInput({ t, label, items, onAdd, onRemove }) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    if (draft.trim()) {
      onAdd(draft);
      setDraft('');
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && items.length > 0) {
      onRemove(items.length - 1);
    }
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <div className="flex flex-wrap items-center gap-2 p-2 border border-slate-300 rounded-md focus-within:ring-2 focus-within:ring-brand focus-within:border-transparent">
        {items.map((chip, i) => (
          <span
            key={`${chip}-${i}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-50 text-brand text-sm"
          >
            {chip}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="hover:text-brand-dark"
              aria-label={t('nav.remove')}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[8rem] outline-none text-sm py-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={t('step1.form.skills.addChip')}
        />
      </div>
    </div>
  );
}

function SkillsSection({ t, skills, addChip, removeChip }) {
  const technical = Array.isArray(skills.technical) ? skills.technical : [];
  const soft = Array.isArray(skills.soft) ? skills.soft : [];
  return (
    <section className="space-y-3">
      <SectionHeading>{t('step1.form.skills.heading')}</SectionHeading>
      <ChipInput
        t={t}
        label={t('step1.form.skills.technical')}
        items={technical}
        onAdd={(v) => addChip('technical', v)}
        onRemove={(i) => removeChip('technical', i)}
      />
      <ChipInput
        t={t}
        label={t('step1.form.skills.soft')}
        items={soft}
        onAdd={(v) => addChip('soft', v)}
        onRemove={(i) => removeChip('soft', i)}
      />
    </section>
  );
}

function ProjectsSection({ t, items, setItem, addItem, removeItem }) {
  return (
    <section className="space-y-3">
      <SectionHeading>{t('step1.form.projects.heading')}</SectionHeading>
      <div className="space-y-4">
        {items.map((p, idx) => (
          <div
            key={idx}
            className="rounded-md border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-700">
                #{idx + 1}
              </h3>
              {items.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-red-600"
                  onClick={() => removeItem(idx)}
                >
                  {t('nav.remove')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('step1.form.projects.name')}>
                <input
                  className="input"
                  value={p.name || ''}
                  onChange={(e) => setItem(idx, 'name', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.projects.link')}>
                <input
                  className="input"
                  value={p.link || ''}
                  onChange={(e) => setItem(idx, 'link', e.target.value)}
                />
              </Field>
            </div>
            <Field label={t('step1.form.projects.description')}>
              <textarea
                rows={2}
                className="input"
                value={p.description || ''}
                onChange={(e) => setItem(idx, 'description', e.target.value)}
              />
            </Field>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary" onClick={addItem}>
        + {t('step1.form.projects.add')}
      </button>
    </section>
  );
}

function CertificationsSection({ t, items, setItem, addItem, removeItem }) {
  return (
    <section className="space-y-3">
      <SectionHeading>{t('step1.form.certs.heading')}</SectionHeading>
      <div className="space-y-4">
        {items.map((c, idx) => (
          <div
            key={idx}
            className="rounded-md border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-700">
                #{idx + 1}
              </h3>
              {items.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-red-600"
                  onClick={() => removeItem(idx)}
                >
                  {t('nav.remove')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label={t('step1.form.certs.name')}>
                <input
                  className="input"
                  value={c.name || ''}
                  onChange={(e) => setItem(idx, 'name', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.certs.issuer')}>
                <input
                  className="input"
                  value={c.issuer || ''}
                  onChange={(e) => setItem(idx, 'issuer', e.target.value)}
                />
              </Field>
              <Field label={t('step1.form.certs.date')}>
                <input
                  className="input"
                  value={c.date || ''}
                  onChange={(e) => setItem(idx, 'date', e.target.value)}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary" onClick={addItem}>
        + {t('step1.form.certs.add')}
      </button>
    </section>
  );
}

// `useMemo` import is unused intentionally — kept for potential future
// optimization of derived form state.
void useMemo;
