/**
 * Client intake — a short guided wizard for the end client, in plain language
 * (no metres per pixel, no focal lengths, no DORI, no PoE), mobile-first.
 *
 *   1 About your site   2 Areas to cover   3 Recording   4 Budget
 *   5 Floor plan (optional)   6 Review and send
 *
 * Answers are kept in this browser while the wizard is open (so a phone
 * refresh does not lose them). Sending means downloading an intake file, or
 * copying a link, for the client to pass to their ContracTech engineer —
 * there is no backend. The summary shown is indicative and says so.
 */

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';

import { checkPlanFile, planImageFromBytes, PLAN_UPLOAD_ACCEPT } from '../domain/planImage.ts';
import type { PlanImage } from '../domain/sitePlan.ts';
import { Logo, ThemeSelect, type Theme } from '../ui/admin/AdminChrome.tsx';
import { downloadText, readFileAsBytes } from '../ui/fileIo.ts';
import { Icon } from '../ui/icons.tsx';
import { Button, Notice, TextField } from '../ui/primitives.tsx';
import { indicativeSummary } from './indicative.ts';
import { intakeLinkHash, MAX_INTAKE_LINK_CHARS, serializeIntakeFile, todayIso } from './intakeFile.ts';
import {
  BUDGET_OPTIONS,
  CABINET_SPACE_LABEL,
  DISTANCE_OPTIONS,
  NIGHT_LABEL,
  PLACE_LABEL,
  POWER_LABEL,
  PREMISES_LABEL,
  RECORDER_PLACE_LABEL,
  RETENTION_OPTIONS,
  SEE_OPTIONS,
} from './intakeMapping.ts';
import {
  BUDGET_CHOICES,
  CABINET_SPACE,
  draftAnswersSchema,
  DISTANCE_RANGES,
  emptyAnswers,
  MAX_AREAS,
  MAX_CAMERAS_PER_AREA,
  newArea,
  NIGHT_LIGHT,
  PLACES,
  POWER_CHOICES,
  PREMISES,
  RECORDER_PLACES,
  RETENTION_CHOICES,
  SEE_CHOICES,
  type ClientAnswers,
  type ClientArea,
} from './intakeTypes.ts';
import { PremisesIllustration, SeeIllustration } from './illustrations.tsx';

const STEPS = ['About your site', 'Areas to cover', 'Recording', 'Budget', 'Floor plan', 'Review and send'] as const;
const DRAFT_KEY = 'contractech-cctv.intake-draft';

function loadDraft(): ClientAnswers {
  try {
    const raw = globalThis.localStorage?.getItem(DRAFT_KEY);
    if (!raw) return emptyAnswers();
    const parsed = draftAnswersSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyAnswers();
  } catch {
    return emptyAnswers();
  }
}

function saveDraft(answers: ClientAnswers): void {
  try {
    globalThis.localStorage?.setItem(DRAFT_KEY, JSON.stringify(answers));
  } catch {
    // A convenience only: without storage the answers last until the page closes.
  }
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** A set of large radio cards. Native radios: arrow keys move, Space selects. */
function Choices<T extends string>({
  legend,
  hint,
  value,
  options,
  onChange,
  columns = 1,
}: {
  legend: string;
  hint?: string;
  value: T;
  options: readonly { value: T; title: string; detail?: string; art?: ReactNode }[];
  onChange: (v: T) => void;
  columns?: 1 | 2;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="text-base font-semibold text-[var(--color-ink)]">{legend}</legend>
      {hint && <p className="mt-0.5 text-sm text-[var(--color-ink-3)]">{hint}</p>}
      <div className={`mt-3 grid gap-2 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={`flex cursor-pointer items-center gap-3 rounded-card border-2 p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-brand)] ${
                checked ? 'border-[var(--color-brand)] bg-[var(--color-accent-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
              }`}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              {o.art && <span className={checked ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-2)]'}>{o.art}</span>}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--color-ink)]">{o.title}</span>
                {o.detail && <span className="mt-0.5 block text-sm text-[var(--color-ink-2)]">{o.detail}</span>}
              </span>
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]' : 'border-[var(--color-border-strong)]'}`}
                aria-hidden="true"
              >
                {checked && <Icon name="check" size={12} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold text-[var(--color-ink)]">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <Button size="lg" ariaLabel={`Fewer: ${label}`} className="w-12 text-xl" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </Button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Math.round(e.currentTarget.valueAsNumber);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="w-20 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-center text-lg font-semibold text-[var(--color-ink)]"
        />
        <Button size="lg" ariaLabel={`More: ${label}`} className="w-12 text-xl" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The area editor (one area per screen)
// ---------------------------------------------------------------------------

function AreaEditor({ area, onSave, onCancel, isNew }: { area: ClientArea; onSave: (a: ClientArea) => void; onCancel: () => void; isNew: boolean }) {
  const [draft, setDraft] = useState(area);
  const set = (patch: Partial<ClientArea>) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <div className="grid gap-6">
      <h3 className="text-title font-semibold text-[var(--color-ink)]">{isNew ? 'Add an area' : `Change “${area.name}”`}</h3>
      <TextField
        label="What do you call this area?"
        helper="For example: Main gate, Reception, Car park, Stockroom."
        value={draft.name}
        onChange={(name) => set({ name: name.slice(0, 120) })}
      />
      <Stepper label="How many cameras here?" value={draft.cameraCount} min={1} max={MAX_CAMERAS_PER_AREA} onChange={(cameraCount) => set({ cameraCount })} />
      <Choices
        legend="What do the cameras need to see?"
        value={draft.see}
        options={SEE_CHOICES.map((c) => ({ value: c, title: SEE_OPTIONS[c].title, detail: SEE_OPTIONS[c].example, art: <SeeIllustration choice={c} /> }))}
        onChange={(see) => set({ see })}
      />
      <Choices legend="Where is it?" value={draft.place} options={PLACES.map((p) => ({ value: p, title: PLACE_LABEL[p] }))} onChange={(place) => set({ place })} />
      <Choices legend="Is it dark there at night?" value={draft.night} options={NIGHT_LIGHT.map((n) => ({ value: n, title: NIGHT_LABEL[n] }))} onChange={(night) => set({ night })} />
      <Choices
        legend="Roughly how far away are the things you want to see?"
        hint="From where the camera would go. A guess is fine — the engineer measures it on site."
        value={draft.distance}
        columns={2}
        options={DISTANCE_RANGES.map((d) => ({ value: d, title: DISTANCE_OPTIONS[d].label }))}
        onChange={(distance) => set({ distance })}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" icon="check" onClick={() => onSave({ ...draft, name: draft.name.trim() || area.name })}>
          Save this area
        </Button>
        <Button variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The wizard
// ---------------------------------------------------------------------------

export function ClientApp() {
  const [answers, setAnswers] = useState<ClientAnswers>(loadDraft);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<{ area: ClientArea; isNew: boolean } | null>(null);
  const [plan, setPlan] = useState<PlanImage | null>(null);
  const [planMessage, setPlanMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('system');
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => saveDraft(answers), [answers]);
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.getElementById('client-step-heading')?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0 });
  }, [step, editing]);

  const summary = useMemo(() => (step === 5 ? indicativeSummary(answers) : null), [step, answers]);
  const set = (patch: Partial<ClientAnswers>) => setAnswers((a) => ({ ...a, ...patch }));
  const setSite = (patch: Partial<ClientAnswers['site']>) => setAnswers((a) => ({ ...a, site: { ...a.site, ...patch } }));
  const setRecording = (patch: Partial<ClientAnswers['recording']>) => setAnswers((a) => ({ ...a, recording: { ...a.recording, ...patch } }));

  const next = () => {
    if (step === 1 && answers.areas.length === 0) {
      setStepError('Add at least one area before you go on.');
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const addArea = () => {
    if (answers.areas.length >= MAX_AREAS) return;
    let n = answers.areas.length + 1;
    const taken = new Set(answers.areas.map((a) => a.id));
    while (taken.has(`area-${n}`)) n += 1;
    setStepError(null);
    setEditing({ area: newArea(`area-${n}`, answers.areas.length + 1), isNew: true });
  };

  const onPlan = async (file: File | undefined) => {
    if (!file) return;
    const pre = checkPlanFile(file);
    if (pre) {
      setPlanMessage({ kind: 'error', text: pre });
      return;
    }
    try {
      const r = planImageFromBytes(file.name, await readFileAsBytes(file));
      if (!r.ok) {
        setPlanMessage({ kind: 'error', text: r.reason });
        return;
      }
      setPlan(r.image);
      setPlanMessage({ kind: 'info', text: `Added ${r.image.fileName}.` });
    } catch (err) {
      setPlanMessage({ kind: 'error', text: `Could not read ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}.` });
    }
  };

  const fileName = `cctv-request-${(answers.site.siteName.trim() || 'site').replace(/[^\w-]+/g, '-').slice(0, 60)}.json`;
  const download = () => {
    const err = downloadText(fileName, serializeIntakeFile({ answers, submittedOn: todayIso(), planImage: plan }), 'application/json');
    setSent(err ?? `Saved ${fileName}. Now send it to your ContracTech engineer.`);
  };
  const link = `${window.location.origin}${window.location.pathname}${intakeLinkHash(answers, todayIso())}`;
  const linkTooLong = link.length > MAX_INTAKE_LINK_CHARS;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setSent('Link copied. Paste it into an email or a message to your ContracTech engineer.');
    } catch (err) {
      setSent(`Could not copy the link (${err instanceof Error ? err.message : 'unknown error'}). Use the file instead.`);
    }
  };

  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const totalCameras = answers.areas.reduce((n, a) => n + a.cameraCount, 0);

  return (
    <div className="min-h-full">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <h1 className="sr-only text-sm font-semibold text-[var(--color-ink)] sm:not-sr-only">Plan your CCTV</h1>
          </div>
          <ThemeSelect theme={theme} onChange={setTheme} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-5 pb-28">
        <div className="mb-5">
          <p className="text-sm font-medium text-[var(--color-ink-3)]">
            Step {step + 1} of {STEPS.length}
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-surface-3)]"
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
          >
            <div className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-[var(--duration-base)]" style={{ width: `${progress}%` }} />
          </div>
          <h2 id="client-step-heading" tabIndex={-1} className="mt-4 text-display font-semibold text-[var(--color-ink)] focus:outline-none">
            {editing ? 'Areas to cover' : STEPS[step]}
          </h2>
        </div>

        {stepError && (
          <div className="mb-4">
            <Notice kind="error" role="alert">
              {stepError}
            </Notice>
          </div>
        )}

        {/* ---- 1. About your site ------------------------------------------ */}
        {step === 0 && (
          <div className="grid gap-6">
            <p className="text-[var(--color-ink-2)]">A few questions about the place you want to protect. It takes about five minutes, and there are no wrong answers.</p>
            <Choices
              legend="What kind of place is it?"
              value={answers.site.premises}
              columns={2}
              options={PREMISES.map((p) => ({ value: p, title: PREMISES_LABEL[p], art: <PremisesIllustration premises={p} /> }))}
              onChange={(premises) => setSite({ premises })}
            />
            <fieldset className="grid gap-3">
              <legend className="text-base font-semibold text-[var(--color-ink)]">About you (optional)</legend>
              <TextField label="Name of the site" helper="For example: Northgate depot." value={answers.site.siteName} onChange={(siteName) => setSite({ siteName: siteName.slice(0, 160) })} />
              <TextField label="Your name" helper="So the engineer knows who to contact." autoComplete="name" value={answers.site.contactName} onChange={(contactName) => setSite({ contactName: contactName.slice(0, 120) })} />
              <TextField label="Phone" helper="" type="tel" autoComplete="tel" value={answers.site.contactPhone} onChange={(contactPhone) => setSite({ contactPhone: contactPhone.slice(0, 60) })} />
              <TextField label="Email" helper="" type="email" autoComplete="email" value={answers.site.contactEmail} onChange={(contactEmail) => setSite({ contactEmail: contactEmail.slice(0, 160) })} />
            </fieldset>
          </div>
        )}

        {/* ---- 2. Areas ------------------------------------------------------- */}
        {step === 1 &&
          (editing ? (
            <AreaEditor
              key={editing.area.id}
              area={editing.area}
              isNew={editing.isNew}
              onCancel={() => setEditing(null)}
              onSave={(area) => {
                setAnswers((a) => ({
                  ...a,
                  areas: a.areas.some((x) => x.id === area.id) ? a.areas.map((x) => (x.id === area.id ? area : x)) : [...a.areas, area],
                }));
                setEditing(null);
                setStepError(null);
              }}
            />
          ) : (
            <div className="grid gap-4">
              <p className="text-[var(--color-ink-2)]">Add each place you want cameras: a gate, a reception, a car park, a stockroom.</p>
              {answers.areas.length === 0 ? (
                <div className="rounded-card border border-dashed border-[var(--color-border-strong)] p-6 text-center text-[var(--color-ink-2)]">No areas yet.</div>
              ) : (
                <ul className="grid gap-2" aria-label="Your areas">
                  {answers.areas.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                      <span className="text-[var(--color-ink-2)]">
                        <SeeIllustration choice={a.see} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-[var(--color-ink)]">{a.name}</span>
                        <span className="block text-sm text-[var(--color-ink-2)]">
                          {a.cameraCount} camera{a.cameraCount === 1 ? '' : 's'} · {SEE_OPTIONS[a.see].title} · {PLACE_LABEL[a.place]}
                        </span>
                      </span>
                      <Button size="sm" variant="ghost" icon="edit" ariaLabel={`Change ${a.name}`} onClick={() => setEditing({ area: a, isNew: false })} />
                      <Button size="sm" variant="ghost" icon="trash" ariaLabel={`Remove ${a.name}`} onClick={() => set({ areas: answers.areas.filter((x) => x.id !== a.id) })} />
                    </li>
                  ))}
                </ul>
              )}
              <Button size="lg" icon="plus" onClick={addArea} disabled={answers.areas.length >= MAX_AREAS}>
                {answers.areas.length === 0 ? 'Add an area' : 'Add another area'}
              </Button>
              {answers.areas.length > 0 && (
                <p className="text-sm text-[var(--color-ink-3)]">
                  {answers.areas.length} area{answers.areas.length === 1 ? '' : 's'}, {totalCameras} camera{totalCameras === 1 ? '' : 's'} so far.
                </p>
              )}
            </div>
          ))}

        {/* ---- 3. Recording --------------------------------------------------- */}
        {step === 2 && (
          <div className="grid gap-6">
            <Choices
              legend="How long should recordings be kept?"
              hint="Longer means more storage, so a bigger recorder."
              value={answers.recording.retention}
              columns={2}
              options={RETENTION_CHOICES.map((r) => ({ value: r, title: RETENTION_OPTIONS[r].label }))}
              onChange={(retention) => setRecording({ retention })}
            />
            <Choices
              legend="Where will the recorder go?"
              hint="The recorder is the box that stores the video."
              value={answers.recording.recorderPlace}
              options={RECORDER_PLACES.map((p) => ({ value: p, title: RECORDER_PLACE_LABEL[p] }))}
              onChange={(recorderPlace) => setRecording({ recorderPlace })}
            />
            {answers.recording.recorderPlace === 'cabinet' && (
              <Choices
                legend="How much room is there in the cabinet?"
                hint="Ask your IT person if you are not sure, or leave it."
                value={answers.recording.cabinetSpace}
                columns={2}
                options={CABINET_SPACE.map((c) => ({ value: c, title: CABINET_SPACE_LABEL[c] }))}
                onChange={(cabinetSpace) => setRecording({ cabinetSpace })}
              />
            )}
            <Choices
              legend="How should the cameras get their power?"
              hint="Through the same cable as the picture, either way."
              value={answers.recording.power}
              options={POWER_CHOICES.map((p) => ({ value: p, title: POWER_LABEL[p].label, detail: POWER_LABEL[p].sentence }))}
              onChange={(power) => setRecording({ power })}
            />
          </div>
        )}

        {/* ---- 4. Budget ------------------------------------------------------- */}
        {step === 3 && (
          <Choices
            legend="Which matters more to you?"
            value={answers.budget}
            options={BUDGET_CHOICES.map((b) => ({ value: b, title: BUDGET_OPTIONS[b].label, detail: BUDGET_OPTIONS[b].sentence }))}
            onChange={(budget) => set({ budget })}
          />
        )}

        {/* ---- 5. Floor plan --------------------------------------------------- */}
        {step === 4 && (
          <div className="grid gap-4">
            <p className="text-[var(--color-ink-2)]">If you have a floor plan, a drawing or a photo of the site, add it. It helps the engineer, but you can skip this.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-brand)]">
              <Icon name="upload" size={28} />
              <span className="font-semibold text-[var(--color-ink)]">{plan ? 'Choose a different picture' : 'Choose a picture'}</span>
              <span className="text-sm text-[var(--color-ink-3)]">PNG or JPG (a PDF cannot be read — take a screenshot of it instead)</span>
              <input
                type="file"
                accept={PLAN_UPLOAD_ACCEPT}
                className="sr-only"
                aria-label="Floor plan or photo (PNG or JPG)"
                onChange={(e) => {
                  void onPlan(e.currentTarget.files?.[0]);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            {planMessage && (
              <Notice kind={planMessage.kind === 'error' ? 'error' : 'success'} role={planMessage.kind === 'error' ? 'alert' : 'status'}>
                {planMessage.text}
              </Notice>
            )}
            {plan && (
              <figure className="grid gap-2">
                <img src={plan.dataUri} alt={`Your floor plan, ${plan.fileName}`} className="max-h-72 w-full rounded-control border border-[var(--color-border)] bg-white object-contain" />
                <Button variant="ghost" icon="trash" onClick={() => setPlan(null)}>
                  Remove the picture
                </Button>
              </figure>
            )}
          </div>
        )}

        {/* ---- 6. Review and send ----------------------------------------------- */}
        {step === 5 && (
          <div className="grid gap-5">
            {summary && (
              <section aria-labelledby="estimate-heading" className="rounded-card border-2 border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4">
                <p className="text-xs font-semibold tracking-wide text-[var(--color-accent)] uppercase">Preliminary estimate</p>
                <h3 id="estimate-heading" className="mt-1 text-title font-semibold text-[var(--color-ink)]">
                  {summary.sentence}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-ink-2)]">
                  A first estimate from your answers. It is preliminary until a ContracTech engineer confirms it with a site survey — the
                  exact cameras, recorder and price come from that.
                </p>
                {summary.recorderNote && <p className="mt-2 text-sm font-medium text-[var(--color-marginal)]">{summary.recorderNote}</p>}
                {summary.unmatchedAreas.length > 0 && (
                  <p className="mt-2 text-sm font-medium text-[var(--color-marginal)]">
                    The engineer will look at {summary.unmatchedAreas.join(', ')} in person: it needs a closer look than these answers allow.
                  </p>
                )}
              </section>
            )}

            <section className="grid gap-3" aria-label="Your answers">
              <ReviewRow title="Your site" onEdit={() => setStep(0)}>
                {PREMISES_LABEL[answers.site.premises]}
                {answers.site.siteName && ` — ${answers.site.siteName}`}
                {answers.site.contactName && <span className="block">Contact: {[answers.site.contactName, answers.site.contactPhone, answers.site.contactEmail].filter(Boolean).join(', ')}</span>}
              </ReviewRow>
              <ReviewRow title={`Areas (${answers.areas.length})`} onEdit={() => setStep(1)}>
                <ul className="grid gap-1">
                  {answers.areas.map((a) => (
                    <li key={a.id}>
                      <span className="font-medium text-[var(--color-ink)]">{a.name}</span>: {a.cameraCount} × {SEE_OPTIONS[a.see].title.toLowerCase()}, {PLACE_LABEL[a.place].toLowerCase()},{' '}
                      {DISTANCE_OPTIONS[a.distance].label.toLowerCase()} away
                    </li>
                  ))}
                </ul>
              </ReviewRow>
              <ReviewRow title="Recording" onEdit={() => setStep(2)}>
                Keep {RETENTION_OPTIONS[answers.recording.retention].label}; recorder {RECORDER_PLACE_LABEL[answers.recording.recorderPlace].toLowerCase()}
                {answers.recording.recorderPlace === 'cabinet' && ` (${CABINET_SPACE_LABEL[answers.recording.cabinetSpace]})`}; power:{' '}
                {POWER_LABEL[answers.recording.power].label.toLowerCase()}
              </ReviewRow>
              <ReviewRow title="Budget" onEdit={() => setStep(3)}>
                {BUDGET_OPTIONS[answers.budget].label}
              </ReviewRow>
              <ReviewRow title="Floor plan" onEdit={() => setStep(4)}>
                {plan ? plan.fileName : 'None added'}
              </ReviewRow>
            </section>

            <section aria-labelledby="send-heading" className="grid gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 id="send-heading" className="text-title font-semibold text-[var(--color-ink)]">
                Send it to ContracTech
              </h3>
              <ol className="grid list-decimal gap-1 pl-5 text-sm text-[var(--color-ink-2)]">
                <li>Save your answers as a file with the button below.</li>
                <li>Send the file to your ContracTech engineer by email or WhatsApp.</li>
                <li>They open it in the ContracTech design tool and contact you to arrange the site visit.</li>
              </ol>
              <Button variant="primary" size="lg" icon="download" onClick={download}>
                Save my answers
              </Button>
              <div className="border-t border-[var(--color-border)] pt-3">
                <p className="text-sm text-[var(--color-ink-2)]">
                  Or send a link instead.{' '}
                  {plan ? 'A link cannot carry your floor plan — send the file so the engineer gets the plan too.' : 'It carries your answers but not a floor plan.'}
                </p>
                <div className="mt-2">
                  <Button icon="link" onClick={() => void copyLink()} disabled={linkTooLong}>
                    Copy a link
                  </Button>
                </div>
                {linkTooLong && <p className="mt-1 text-xs text-[var(--color-ink-3)]">Your answers are too long for a link; please send the file.</p>}
              </div>
              {sent && (
                <Notice kind="success" role="status">
                  {sent}
                </Notice>
              )}
              <p className="text-xs text-[var(--color-ink-3)]">Nothing is sent anywhere automatically: your answers stay on this device until you send them.</p>
            </section>
          </div>
        )}
      </main>

      {!editing && (
        <nav aria-label="Wizard" className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-raised)]">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <Button size="lg" variant="ghost" icon="arrow-left" onClick={back} disabled={step === 0}>
              Back
            </Button>
            {step < STEPS.length - 1 && (
              <Button size="lg" variant="primary" onClick={next}>
                {step === 4 && !plan ? 'Skip' : 'Next'}
                <Icon name="arrow-right" size={18} />
              </Button>
            )}
          </div>
        </nav>
      )}

      <footer className="mx-auto max-w-2xl px-4 pb-24 text-xs text-[var(--color-ink-3)]">
        <a href="#" className="underline">
          ContracTech staff: open the design tool
        </a>
      </footer>
    </div>
  );
}

function ReviewRow({ title, children, onEdit }: { title: string; children: ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="min-w-0 flex-1 text-sm text-[var(--color-ink-2)]">
        <p className="font-semibold text-[var(--color-ink)]">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
      <Button size="sm" variant="ghost" icon="edit" ariaLabel={`Change ${title.replace(/ \(\d+\)$/, '').toLowerCase()}`} onClick={onEdit}>
        Change
      </Button>
    </div>
  );
}
