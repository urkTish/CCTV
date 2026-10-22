/**
 * `#/client/renovation` — the client's renovation questionnaire (spec 3.2),
 * phone-first, in English or Arabic (right-to-left).
 *
 *   1 About you and the place   2 What do you want to do?   3 Rooms (photos)
 *   4 Your style (quiz)   5 Budget   6 Timing   7 Floor plan   8 Review and send
 *
 * "Not sure / the engineer will decide" is always possible. Photos are read on
 * the phone only, their location data stripped (photos.ts). Sending is a file
 * (answers + photos + plan) or a link (answers only), as for CCTV; nothing is
 * sent anywhere automatically. The summary is indicative and says so; the
 * client never sees a price here (Q8: a range comes after the engineer's review).
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { todayIso } from '../../client/intakeFile.ts';
import { checkPlanFile, planImageFromBytes, PLAN_UPLOAD_ACCEPT } from '../../domain/planImage.ts';
import type { PlanImage } from '../../domain/sitePlan.ts';
import { Logo, ThemeSelect, type Theme } from '../../ui/admin/AdminChrome.tsx';
import { downloadText, readFileAsBytes } from '../../ui/fileIo.ts';
import { Icon } from '../../ui/icons.tsx';
import { Button, Notice } from '../../ui/primitives.tsx';
import { loadDraft, loadDraftSync, saveDraft } from '../draftStore.ts';
import { STRINGS, type Strings } from '../i18n.ts';
import { indicativeRenovation, MAX_RN_LINK_CHARS, renovationLinkHash, serializeRenovationIntake, SIZE_DEFAULTS } from '../intake.ts';
import { paletteHexes, sampleLibrary } from '../library.ts';
import {
  BUDGET_TIERS,
  BUILDING_AGES,
  FLOOR_LIKES,
  MAX_CLIENT_ROOMS,
  MOODS,
  MUST_STAY,
  nextId,
  OCCUPANCY,
  PALETTES,
  PROBLEMS,
  PROPERTY_TYPES,
  ROOM_TYPES,
  SIZE_CLASSES,
  START_WHEN,
  STYLES,
  WORKS,
  type ClientRoom,
  type Lang,
  type Photo,
  type RenovationAnswers,
  type RoomType,
  type Work,
} from '../model.ts';
import { preparePhoto, PHOTO_ACCEPT } from '../photos.ts';
import { PaintChips, StyleVignette } from './StyleArt.tsx';

const TOTAL = 8;

/** The project's works that apply to a room of this type (kitchen work only in a kitchen, bathroom work only in a bathroom). */
function worksFor(type: RoomType, works: readonly Work[]): Work[] {
  return works.filter((w) => w !== 'not-sure' && w !== 'outside' && (w !== 'kitchen' || type === 'kitchen') && (w !== 'bathroom' || type === 'bathroom'));
}
const MAX_PHOTOS_PER_ROOM = 6;

// ---------------------------------------------------------------------------
// Building blocks (large tap targets, native inputs, logical properties for RTL)
// ---------------------------------------------------------------------------

function Legend({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <>
      <legend className="text-base font-semibold text-[var(--color-ink)]">{children}</legend>
      {hint && <p className="mt-0.5 text-sm text-[var(--color-ink-3)]">{hint}</p>}
    </>
  );
}

const cardClass = (on: boolean) =>
  `flex cursor-pointer items-center gap-3 rounded-card border-2 p-3 min-h-12 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-brand)] ${
    on ? 'border-[var(--color-brand)] bg-[var(--color-accent-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
  }`;

function Mark({ on, round }: { on: boolean; round?: boolean }) {
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center border-2 ${round ? 'rounded-full' : 'rounded-[5px]'} ${on ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]' : 'border-[var(--color-border-strong)]'}`}
      aria-hidden="true"
    >
      {on && <Icon name="check" size={12} />}
    </span>
  );
}

function Radios<T extends string>({ legend, hint, value, options, onChange, columns = 1 }: { legend: string; hint?: string; value: T | null; options: readonly { value: T; title: string; detail?: string; art?: ReactNode }[]; onChange: (v: T) => void; columns?: 1 | 2 | 3 }) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <Legend hint={hint}>{legend}</Legend>
      <div className={`mt-3 grid gap-2 ${columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : ''}`}>
        {options.map((o) => (
          <label key={o.value} className={`${cardClass(o.value === value)} ${o.art ? 'flex-col items-stretch' : ''}`}>
            <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.art}
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--color-ink)]">{o.title}</span>
                {o.detail && <span className="mt-0.5 block text-sm text-[var(--color-ink-2)]">{o.detail}</span>}
              </span>
              <Mark on={o.value === value} round />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Checks<T extends string>({ legend, hint, values, options, onChange, max, columns = 2 }: { legend: string; hint?: string; values: readonly T[]; options: readonly { value: T; title: string; detail?: string; art?: ReactNode }[]; onChange: (v: T[]) => void; max?: number; columns?: 1 | 2 | 3 }) {
  return (
    <fieldset className="min-w-0">
      <Legend hint={hint}>{legend}</Legend>
      <div className={`mt-3 grid gap-2 ${columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : ''}`}>
        {options.map((o) => {
          const on = values.includes(o.value);
          const full = !on && max !== undefined && values.length >= max;
          return (
            <label key={o.value} className={`${cardClass(on)} ${o.art ? 'flex-col items-stretch' : ''} ${full ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                disabled={full}
                onChange={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
                className="sr-only"
              />
              {o.art}
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--color-ink)]">{o.title}</span>
                  {o.detail && <span className="mt-0.5 block text-sm text-[var(--color-ink-2)]">{o.detail}</span>}
                </span>
                <Mark on={on} />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({ label, help, value, onChange, type = 'text', autoComplete, inputMode, required, max = 160, dir }: { label: string; help?: string; value: string; onChange: (v: string) => void; type?: 'text' | 'tel' | 'email' | 'date'; autoComplete?: string; inputMode?: 'decimal' | 'tel' | 'email'; required?: boolean; max?: number; dir?: 'ltr' | 'auto' }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        dir={dir ?? 'auto'}
        value={value}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-describedby={help ? `${id}-h` : undefined}
        onChange={(e) => onChange(e.currentTarget.value.slice(0, max))}
        className="mt-1 min-h-11 w-full rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
      />
      {help && (
        <p id={`${id}-h`} className="mt-1 text-xs text-[var(--color-ink-3)]">
          {help}
        </p>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, unit }: { label: string; value: number | null; onChange: (v: number | null) => void; unit: string }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
        {label} <span className="font-normal text-[var(--color-ink-3)]">({unit})</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={0.1}
        min={0}
        dir="ltr"
        value={draft ?? (value ?? '')}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          setDraft(raw);
          const n = e.currentTarget.valueAsNumber;
          onChange(raw.trim() === '' || !Number.isFinite(n) ? null : n);
        }}
        onBlur={() => setDraft(null)}
        className="mt-1 min-h-11 w-full rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-ink)]"
      />
    </div>
  );
}

function TextArea({ label, help, value, onChange, max = 800 }: { label: string; help?: string; value: string; onChange: (v: string) => void; max?: number }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold text-[var(--color-ink)]">
        {label}
      </label>
      {help && <p className="mt-0.5 text-sm text-[var(--color-ink-3)]">{help}</p>}
      <textarea
        id={id}
        dir="auto"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value.slice(0, max))}
        className="mt-2 w-full rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-ink)]"
      />
    </div>
  );
}

function PhotoGuide({ t }: { t: Strings }) {
  return (
    <details className="group rounded-card border border-[var(--color-border)] bg-[var(--color-surface)]" open>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 font-semibold text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
        <Icon name="camera" size={18} />
        <span className="flex-1">{t.photoGuideTitle}</span>
        <Icon name="chevron-down" size={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <ol className="grid list-decimal gap-1 border-t border-[var(--color-border)] px-3 py-3 ps-8 text-sm text-[var(--color-ink-2)]">
        {t.photoGuide.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ol>
    </details>
  );
}

function PhotoPicker({ t, label, photos, onAdd, onRemove, onFacing, max, showFacing = true }: { t: Strings; label: string; photos: readonly Photo[]; onAdd: (files: File[]) => void; onRemove: (id: string) => void; onFacing?: (id: string, facing: string) => void; max: number; showFacing?: boolean }) {
  return (
    <div className="grid gap-3">
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={label}>
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-surface)]">
              <img src={p.dataUri} alt={`${label} ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              <div className="grid gap-1 p-2">
                {showFacing && onFacing && (
                  <label className="text-xs text-[var(--color-ink-3)]">
                    {t.photoFacing}
                    <select
                      value={p.facing}
                      onChange={(e) => onFacing(p.id, e.currentTarget.value)}
                      className="mt-0.5 block min-h-9 w-full rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-1 text-sm text-[var(--color-ink)]"
                    >
                      {t.facing.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button size="sm" variant="ghost" icon="trash" onClick={() => onRemove(p.id)} ariaLabel={`${t.remove} ${label} ${i + 1}`}>
                  {t.remove}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {photos.length < max && (
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-card border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 font-semibold text-[var(--color-accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-brand)]">
          <Icon name="camera" size={20} />
          {t.addPhotos}
          <input
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            className="sr-only"
            aria-label={`${t.addPhotos}: ${label}`}
            onChange={(e) => {
              const files = [...(e.currentTarget.files ?? [])].slice(0, max - photos.length);
              e.currentTarget.value = '';
              if (files.length) onAdd(files);
            }}
          />
        </label>
      )}
      <p className="flex items-start gap-1.5 text-xs text-[var(--color-ink-3)]">
        <Icon name="info" size={14} className="mt-0.5 shrink-0" />
        {t.photoPrivacy}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The room editor (one room per screen)
// ---------------------------------------------------------------------------

function RoomEditor({
  t,
  room,
  isNew,
  allWorks,
  photos,
  onPhotos,
  onFacing,
  onSave,
  onCancel,
}: {
  t: Strings;
  room: ClientRoom;
  isNew: boolean;
  allWorks: readonly Work[];
  photos: readonly Photo[];
  onPhotos: (files: File[], roomId: string) => Promise<string[]>;
  onFacing: (photoId: string, facing: string) => void;
  onSave: (r: ClientRoom, removedPhotoIds: string[]) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(room);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<ClientRoom>) => setD((x) => ({ ...x, ...patch }));
  const own = photos.filter((p) => d.photoIds.includes(p.id));
  const size = d.size;
  const workChoices = (allWorks.length ? allWorks.filter((w) => w !== 'not-sure' && w !== 'outside') : WORKS.filter((w) => w !== 'outside')) as Work[];
  return (
    <div className="grid gap-6">
      <h3 className="text-title font-semibold text-[var(--color-ink)]">{isNew ? t.addRoomTitle : t.editRoomTitle(room.name)}</h3>
      <Radios
        legend={t.roomTypeQ}
        value={d.type}
        columns={2}
        options={ROOM_TYPES.map((r) => ({ value: r, title: t.roomType[r] }))}
        onChange={(type: RoomType) => set({ type, name: d.name === t.roomType[d.type] || !d.name ? t.roomType[type] : d.name, works: isNew ? worksFor(type, allWorks) : d.works })}
      />
      <Field label={t.roomNameQ} help={t.roomNameHelp} value={d.name} max={120} onChange={(name) => set({ name })} />
      {workChoices.length > 0 && <Checks legend={t.roomWorksQ} values={d.works} options={workChoices.map((w) => ({ value: w, title: t.works[w] }))} onChange={(works) => set({ works })} />}
      <fieldset className="grid gap-3">
        <Legend>{t.sizeQ}</Legend>
        <div className="grid gap-2" role="radiogroup" aria-label={t.sizeQ}>
          {(['class', 'typed', 'engineer'] as const).map((m) => (
            <label key={m} className={cardClass(size.mode === m)}>
              <input
                type="radio"
                name={`size-mode-${d.id}`}
                checked={size.mode === m}
                className="sr-only"
                onChange={() => set({ size: m === 'class' ? { mode: 'class', cls: 'M' } : m === 'typed' ? { mode: 'typed', lengthM: 4, widthM: 4, heightM: null } : { mode: 'engineer' } })}
              />
              <span className="flex-1 font-semibold text-[var(--color-ink)]">{t.sizeModes[m]}</span>
              <Mark on={size.mode === m} round />
            </label>
          ))}
        </div>
        {size.mode === 'class' && (
          <div className="grid grid-cols-3 gap-2">
            {SIZE_CLASSES.map((c) => {
              const [L, W] = SIZE_DEFAULTS[d.type][c];
              const on = size.cls === c;
              return (
                <label key={c} className={`${cardClass(on)} flex-col items-center text-center`}>
                  <input type="radio" name={`size-cls-${d.id}`} checked={on} className="sr-only" onChange={() => set({ size: { mode: 'class', cls: c } })} />
                  <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                    <rect x={20 - (c === 'S' ? 7 : c === 'M' ? 11 : 16)} y={20 - (c === 'S' ? 7 : c === 'M' ? 11 : 16)} width={c === 'S' ? 14 : c === 'M' ? 22 : 32} height={c === 'S' ? 14 : c === 'M' ? 22 : 32} fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="font-semibold text-[var(--color-ink)]">{t.sizeClass[c]}</span>
                  <span className="text-xs text-[var(--color-ink-3)]" dir="auto">
                    {t.sizeTypical(L, W)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {size.mode === 'typed' && (
          <div className="grid grid-cols-2 gap-3">
            <NumField label={t.length} unit={t.metres} value={size.lengthM} onChange={(v) => v !== null && v >= 0.3 && v <= 200 && set({ size: { ...size, lengthM: v } })} />
            <NumField label={t.width} unit={t.metres} value={size.widthM} onChange={(v) => v !== null && v >= 0.3 && v <= 200 && set({ size: { ...size, widthM: v } })} />
            <div className="col-span-2">
              <NumField label={t.height} unit={t.metres} value={size.heightM} onChange={(v) => set({ size: { ...size, heightM: v !== null && v >= 1.8 && v <= 12 ? v : null } })} />
              <p className="mt-1 text-xs text-[var(--color-ink-3)]">{t.heightHelp}</p>
            </div>
          </div>
        )}
      </fieldset>
      <fieldset className="grid gap-3">
        <Legend hint={t.photosHint}>{t.photosQ}</Legend>
        <PhotoGuide t={t} />
        <PhotoPicker
          t={t}
          label={d.name || t.roomType[d.type]}
          photos={own}
          max={MAX_PHOTOS_PER_ROOM}
          onFacing={onFacing}
          onAdd={(files) => {
            setBusy(true);
            void onPhotos(files, d.id).then((ids) => {
              setD((x) => ({ ...x, photoIds: [...x.photoIds, ...ids].slice(0, MAX_PHOTOS_PER_ROOM) }));
              setBusy(false);
            });
          }}
          onRemove={(pid) => {
            set({ photoIds: d.photoIds.filter((x) => x !== pid) });
            setRemoved((r) => [...r, pid]);
          }}
        />
        {busy && <p role="status" className="text-sm text-[var(--color-ink-2)]">…</p>}
        {own.length === 0 && <p className="text-sm font-medium text-[var(--color-marginal)]">{t.noPhotoWarning}</p>}
      </fieldset>
      <Checks legend={t.problemsQ} values={d.problems} options={PROBLEMS.map((p) => ({ value: p, title: t.problems[p] }))} onChange={(problems) => set({ problems })} />
      <TextArea label={t.roomNote} value={d.note} max={600} onChange={(note) => set({ note })} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" icon="check" onClick={() => onSave({ ...d, name: d.name.trim() || t.roomType[d.type] }, removed)}>
          {t.saveRoom}
        </Button>
        <Button variant="ghost" size="lg" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The wizard
// ---------------------------------------------------------------------------

export function RenovationWizard({ initialLang }: { initialLang?: Lang }) {
  const initial = useMemo(() => {
    const d = loadDraftSync();
    return initialLang ? { ...d, answers: { ...d.answers, lang: initialLang } } : d;
  }, [initialLang]);
  const [answers, setAnswers] = useState<RenovationAnswers>(initial.answers);
  const [photos, setPhotos] = useState<Photo[]>([...initial.photos]);
  const [plan, setPlan] = useState<PlanImage | null>(initial.plan);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<{ room: ClientRoom; isNew: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planMsg, setPlanMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('system');
  const loaded = useRef(false);
  const t = STRINGS[answers.lang];
  const lib = useMemo(() => sampleLibrary(), []);

  // Restore photos from IndexedDB (the localStorage copy holds answers only).
  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      loaded.current = true;
      if (d && d.photos.length && photos.length === 0) {
        setPhotos([...d.photos]);
        if (d.plan) setPlan(d.plan);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void saveDraft({ answers, photos, plan });
  }, [answers, photos, plan]);
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = answers.lang;
    return () => {
      document.documentElement.lang = 'en';
    };
  }, [answers.lang]);
  useEffect(() => {
    document.getElementById('rn-step-heading')?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0 });
  }, [step, editing]);

  const set = (patch: Partial<RenovationAnswers>) => setAnswers((a) => ({ ...a, ...patch }));
  const setPlace = (patch: Partial<RenovationAnswers['place']>) => setAnswers((a) => ({ ...a, place: { ...a.place, ...patch } }));
  const setStyle = (patch: Partial<RenovationAnswers['style']>) => setAnswers((a) => ({ ...a, style: { ...a.style, ...patch } }));
  const setBudget = (patch: Partial<RenovationAnswers['budget']>) => setAnswers((a) => ({ ...a, budget: { ...a.budget, ...patch } }));
  const setTiming = (patch: Partial<RenovationAnswers['timing']>) => setAnswers((a) => ({ ...a, timing: { ...a.timing, ...patch } }));

  const addPhotos = async (files: File[], roomId: string | null, purpose: Photo['purpose']): Promise<string[]> => {
    const ids: string[] = [];
    const added: Photo[] = [];
    const taken = new Set(photos.map((p) => p.id));
    for (const f of files) {
      try {
        const r = await preparePhoto(f.name, await readFileAsBytes(f));
        if (!r.ok) {
          setError(r.reason);
          continue;
        }
        const pid = nextId('photo', taken);
        taken.add(pid);
        ids.push(pid);
        added.push({ id: pid, roomId, purpose, facing: purpose === 'before' ? t.facing[0]! : '', fileName: f.name.slice(0, 200), dataUri: r.photo.dataUri, widthPx: r.photo.widthPx, heightPx: r.photo.heightPx, addedOn: todayIso(), metadataStripped: true, note: '' });
      } catch (err) {
        setError(`${f.name}: ${err instanceof Error ? err.message : 'could not be read'}`);
      }
    }
    setPhotos((p) => [...p, ...added]);
    return ids;
  };

  const validate = (): string | null => {
    if (step === 0 && answers.place.phone.trim().length < 5) return t.phoneMissing;
    if (step === 1 && answers.works.length === 0) return t.worksMissing;
    if (step === 2 && answers.rooms.length === 0) return t.roomsMissing;
    if (step === 3 && (answers.style.styles.length === 0 || !answers.style.palette || answers.style.moods.length === 0)) return t.styleMissing;
    if (step === 4 && !answers.budget.tier) return t.budgetMissing;
    if (step === 5 && !answers.timing.start) return t.startMissing;
    return null;
  };
  const next = () => {
    const e = validate();
    setError(e);
    if (!e) setStep((s) => Math.min(s + 1, TOTAL - 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const usedPhotos = photos.filter((p) => answers.rooms.some((r) => r.photoIds.includes(p.id)) || answers.style.inspirationIds.includes(p.id));
  const summary = useMemo(() => (step === 7 ? indicativeRenovation(answers, lib) : null), [step, answers, lib]);
  const fileName = `renovation-request-${(answers.place.name.trim() || 'client').replace(/[^\w-]+/g, '-').slice(0, 50)}.json`;
  const download = () => {
    if (usedPhotos.length > 0 && !answers.consent.photoUse) {
      setError(t.consentMissing);
      return;
    }
    setError(null);
    const err = downloadText(fileName, serializeRenovationIntake({ answers, submittedOn: todayIso(), photos: usedPhotos, planImage: plan }), 'application/json');
    setSent(err ?? t.saved(fileName));
  };
  const link = `${window.location.origin}${window.location.pathname}${renovationLinkHash(answers, todayIso())}`;
  const linkTooLong = link.length > MAX_RN_LINK_CHARS;

  const onPlan = async (file: File | undefined) => {
    if (!file) return;
    const pre = checkPlanFile(file);
    if (pre) return setPlanMsg({ kind: 'error', text: pre });
    try {
      const r = planImageFromBytes(file.name, await readFileAsBytes(file));
      if (!r.ok) return setPlanMsg({ kind: 'error', text: r.reason });
      setPlan(r.image);
      setPlanMsg({ kind: 'info', text: t.planAdded(r.image.fileName) });
    } catch (err) {
      setPlanMsg({ kind: 'error', text: `${file.name}: ${err instanceof Error ? err.message : 'error'}` });
    }
  };

  const addRoom = () => {
    if (answers.rooms.length >= MAX_CLIENT_ROOMS) return;
    const rid = nextId('room', answers.rooms.map((r) => r.id));
    const works = answers.works.filter((w) => w !== 'not-sure' && w !== 'outside');
    setError(null);
    setEditing({ room: { id: rid, type: 'bedroom', name: t.roomType.bedroom, works: worksFor('bedroom', works), size: { mode: 'class', cls: 'M' }, photoIds: [], problems: [], note: '' }, isNew: true });
  };

  const progress = Math.round(((step + 1) / TOTAL) * 100);
  const stepTitle = t.steps[step] ?? '';
  const switchLang = () => set({ lang: answers.lang === 'en' ? 'ar' : 'en' });

  return (
    <div className="min-h-full" dir={t.dir} lang={answers.lang}>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span dir="ltr" className="flex">
              <Logo />
            </span>
            <h1 className="sr-only text-sm font-semibold text-[var(--color-ink)] sm:not-sr-only">{t.appTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={switchLang}
              lang={answers.lang === 'en' ? 'ar' : 'en'}
              className="min-h-9 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
            >
              {t.otherLang}
            </button>
            <ThemeSelect theme={theme} onChange={setTheme} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-5 pb-28">
        <div className="mb-5">
          <p className="text-sm font-medium text-[var(--color-ink-3)]">{t.stepOf(step + 1, TOTAL)}</p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-surface-3)]"
            role="progressbar"
            aria-label={t.progress}
            aria-valuemin={1}
            aria-valuemax={TOTAL}
            aria-valuenow={step + 1}
            aria-valuetext={`${t.stepOf(step + 1, TOTAL)}: ${stepTitle}`}
          >
            <div className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-[var(--duration-base)]" style={{ width: `${progress}%` }} />
          </div>
          <h2 id="rn-step-heading" tabIndex={-1} className="mt-4 text-display font-semibold text-[var(--color-ink)] focus:outline-none">
            {stepTitle}
          </h2>
        </div>

        {error && (
          <div className="mb-4">
            <Notice kind="error" role="alert">
              {error}
            </Notice>
          </div>
        )}

        {step === 0 && (
          <div className="grid gap-6">
            <p className="text-[var(--color-ink-2)]">{t.s1Lead}</p>
            <Radios legend={t.placeQ} value={answers.place.propertyType} columns={2} options={PROPERTY_TYPES.map((p) => ({ value: p, title: t.property[p] }))} onChange={(propertyType) => setPlace({ propertyType })} />
            <Radios legend={t.occupancyQ} value={answers.place.occupancy} options={OCCUPANCY.map((o) => ({ value: o, title: t.occupancy[o] }))} onChange={(occupancy) => setPlace({ occupancy })} />
            <fieldset className="grid gap-3">
              <Legend>{t.aboutYou}</Legend>
              <Field label={t.name} value={answers.place.name} autoComplete="name" max={120} onChange={(name) => setPlace({ name })} />
              <Field label={`${t.phone} (${t.required})`} help={t.phoneHelp} type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={answers.place.phone} max={60} required onChange={(phone) => setPlace({ phone })} />
              <Field label={`${t.email} (${t.optional})`} type="email" inputMode="email" dir="ltr" autoComplete="email" value={answers.place.email} onChange={(email) => setPlace({ email })} />
              <Field label={`${t.city} (${t.optional})`} value={answers.place.city} max={120} onChange={(city) => setPlace({ city })} />
            </fieldset>
            <Radios legend={t.ageQ} value={answers.place.buildingAge} columns={2} options={BUILDING_AGES.map((a) => ({ value: a, title: t.age[a] }))} onChange={(buildingAge) => setPlace({ buildingAge })} />
          </div>
        )}

        {step === 1 && (
          <Checks
            legend={t.worksQ}
            hint={t.worksHint}
            values={answers.works}
            options={WORKS.map((w) => ({ value: w, title: t.works[w] }))}
            onChange={(works) => {
              // "Not sure" excludes the rest, and the rest excludes it.
              const added = works.find((w) => !answers.works.includes(w));
              set({ works: added === 'not-sure' ? ['not-sure'] : works.filter((w) => w !== 'not-sure' || works.length === 1) });
            }}
          />
        )}

        {step === 2 &&
          (editing ? (
            <RoomEditor
              key={editing.room.id}
              t={t}
              room={editing.room}
              isNew={editing.isNew}
              allWorks={answers.works}
              photos={photos}
              onPhotos={(files, roomId) => addPhotos(files, roomId, 'before')}
              onFacing={(pid, facing) => setPhotos((ps) => ps.map((x) => (x.id === pid ? { ...x, facing } : x)))}
              onCancel={() => setEditing(null)}
              onSave={(room, removed) => {
                setAnswers((a) => ({ ...a, rooms: a.rooms.some((r) => r.id === room.id) ? a.rooms.map((r) => (r.id === room.id ? room : r)) : [...a.rooms, room] }));
                if (removed.length) setPhotos((p) => p.filter((x) => !removed.includes(x.id)));
                setEditing(null);
                setError(null);
              }}
            />
          ) : (
            <div className="grid gap-4">
              <p className="text-[var(--color-ink-2)]">{t.roomsLead}</p>
              {answers.rooms.length === 0 ? (
                <div className="rounded-card border border-dashed border-[var(--color-border-strong)] p-6 text-center text-[var(--color-ink-2)]">{t.noRooms}</div>
              ) : (
                <ul className="grid gap-2" aria-label={t.yourRooms}>
                  {answers.rooms.map((r) => {
                    const first = photos.find((p) => r.photoIds.includes(p.id));
                    return (
                      <li key={r.id} className="flex items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                        {first ? (
                          <img src={first.dataUri} alt="" className="size-14 shrink-0 rounded-control object-cover" />
                        ) : (
                          <span className="flex size-14 shrink-0 items-center justify-center rounded-control bg-[var(--color-surface-2)] text-[var(--color-ink-3)]">
                            <Icon name="camera" size={20} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-[var(--color-ink)]">{r.name}</span>
                          <span className="block text-sm text-[var(--color-ink-2)]">
                            {t.roomType[r.type]} · {t.roomSummary(r.photoIds.length)}
                          </span>
                        </span>
                        <Button size="sm" variant="ghost" icon="edit" ariaLabel={`${t.change} ${r.name}`} onClick={() => setEditing({ room: r, isNew: false })} />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="trash"
                          ariaLabel={`${t.remove} ${r.name}`}
                          onClick={() => {
                            set({ rooms: answers.rooms.filter((x) => x.id !== r.id) });
                            setPhotos((p) => p.filter((x) => !r.photoIds.includes(x.id)));
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button size="lg" icon="plus" onClick={addRoom} disabled={answers.rooms.length >= MAX_CLIENT_ROOMS}>
                {answers.rooms.length === 0 ? t.addRoom : t.addAnotherRoom}
              </Button>
            </div>
          ))}

        {step === 3 && (
          <div className="grid gap-8">
            <Checks
              legend={t.styleQ}
              hint={t.styleHint}
              max={2}
              values={answers.style.styles}
              options={STYLES.map((s) => ({ value: s, title: t.styles[s].title, detail: t.styles[s].words, art: <StyleVignette style={s} /> }))}
              onChange={(styles) => setStyle({ styles })}
            />
            <Radios
              legend={t.paletteQ}
              value={answers.style.palette}
              columns={2}
              options={PALETTES.map((p) => ({
                value: p,
                title: t.palettes[p],
                art: <PaintChips size="sm" chips={paletteHexes(p).map((hex) => ({ hex }))} />,
              }))}
              onChange={(palette) => setStyle({ palette })}
            />
            <Checks legend={t.moodQ} hint={t.pickUpTo(3)} max={3} values={answers.style.moods} options={MOODS.map((m) => ({ value: m, title: t.moods[m] }))} onChange={(moods) => setStyle({ moods })} />
            <Radios legend={`${t.floorsQ} (${t.optional})`} value={answers.style.floors} columns={2} options={FLOOR_LIKES.map((f) => ({ value: f, title: t.floors[f] }))} onChange={(floors) => setStyle({ floors })} />
            <TextArea label={`${t.loveHateQ} (${t.optional})`} help={t.loveHateHelp} value={answers.style.loveHate} onChange={(loveHate) => setStyle({ loveHate })} />
            <fieldset className="grid gap-3">
              <Legend>{`${t.inspirationQ} (${t.optional})`}</Legend>
              <PhotoPicker
                t={t}
                label={t.inspirationQ}
                showFacing={false}
                max={5}
                photos={photos.filter((p) => answers.style.inspirationIds.includes(p.id))}
                onAdd={(files) => void addPhotos(files, null, 'inspiration').then((ids) => setAnswers((a) => ({ ...a, style: { ...a.style, inspirationIds: [...a.style.inspirationIds, ...ids].slice(0, 5) } })))}
                onRemove={(pid) => {
                  setStyle({ inspirationIds: answers.style.inspirationIds.filter((x) => x !== pid) });
                  setPhotos((p) => p.filter((x) => x.id !== pid));
                }}
              />
            </fieldset>
            <Checks legend={t.mustStayQ} values={answers.style.mustStay} options={MUST_STAY.map((m) => ({ value: m, title: t.mustStay[m] }))} onChange={(mustStay) => setStyle({ mustStay })} />
            <Field label={`${t.mustStayOther} (${t.optional})`} value={answers.style.mustStayText} max={300} onChange={(mustStayText) => setStyle({ mustStayText })} />
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-6">
            <Radios legend={t.budgetQ} value={answers.budget.tier} options={BUDGET_TIERS.map((b) => ({ value: b, title: t.budget[b].title, detail: t.budget[b].detail }))} onChange={(tier) => setBudget({ tier })} />
            <fieldset className="grid grid-cols-2 gap-3">
              <legend className="col-span-2 mb-2 text-base font-semibold text-[var(--color-ink)]">{`${t.budgetRange} (${t.optional})`}</legend>
              <NumField label={t.budgetFrom} unit="SAR" value={answers.budget.min} onChange={(min) => setBudget({ min })} />
              <NumField label={t.budgetTo} unit="SAR" value={answers.budget.max} onChange={(max) => setBudget({ max })} />
            </fieldset>
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-6">
            <Radios legend={t.startQ} value={answers.timing.start} columns={2} options={START_WHEN.map((s) => ({ value: s, title: t.start[s] }))} onChange={(start) => setTiming({ start })} />
            <Field label={`${t.finishByQ} (${t.optional})`} type="date" dir="ltr" value={answers.timing.finishBy ?? ''} onChange={(v) => setTiming({ finishBy: /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null })} />
            <TextArea label={`${t.restrictionsQ} (${t.optional})`} help={t.restrictionsHelp} value={answers.timing.restrictions} max={400} onChange={(restrictions) => setTiming({ restrictions })} />
          </div>
        )}

        {step === 6 && (
          <div className="grid gap-4">
            <p className="text-[var(--color-ink-2)]">{t.planLead}</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-brand)]">
              <Icon name="upload" size={28} />
              <span className="font-semibold text-[var(--color-ink)]">{plan ? t.planChooseAgain : t.planChoose}</span>
              <span className="text-sm text-[var(--color-ink-3)]">{t.planFormats}</span>
              <input
                type="file"
                accept={PLAN_UPLOAD_ACCEPT}
                className="sr-only"
                aria-label={t.planChoose}
                onChange={(e) => {
                  void onPlan(e.currentTarget.files?.[0]);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            {planMsg && (
              <Notice kind={planMsg.kind === 'error' ? 'error' : 'success'} role={planMsg.kind === 'error' ? 'alert' : 'status'}>
                {planMsg.text}
              </Notice>
            )}
            {plan && (
              <figure className="grid gap-2">
                <img src={plan.dataUri} alt={plan.fileName} className="max-h-72 w-full rounded-control border border-[var(--color-border)] bg-white object-contain" />
                <Button variant="ghost" icon="trash" onClick={() => setPlan(null)}>
                  {t.planRemove}
                </Button>
              </figure>
            )}
          </div>
        )}

        {step === 7 && (
          <div className="grid gap-5">
            {summary && (
              <section aria-labelledby="rn-estimate" className="rounded-card border-2 border-[var(--color-brand)] bg-[var(--color-brand-soft)] p-4">
                <p className="text-xs font-semibold tracking-wide text-[var(--color-accent)] uppercase">{t.estimateLabel}</p>
                <h3 id="rn-estimate" className="mt-1 text-title font-semibold text-[var(--color-ink)]">
                  {t.estimateSentence(summary.wallsM2, summary.floorsM2, summary.days)}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-ink-2)]">{t.estimateNote}</p>
                {summary.roomsMeasuredLater > 0 && <p className="mt-2 text-sm font-medium text-[var(--color-marginal)]">{t.measuredLater(summary.roomsMeasuredLater)}</p>}
                <p className="mt-2 text-sm text-[var(--color-ink-2)]">{t.noPrice}</p>
              </section>
            )}
            <section className="grid gap-3" aria-label={t.yourAnswers}>
              <Review t={t} title={t.reviewPlace} onEdit={() => setStep(0)}>
                {t.property[answers.place.propertyType]} · {t.occupancy[answers.place.occupancy]}
                <span className="block" dir="auto">
                  {[answers.place.name, answers.place.phone, answers.place.email, answers.place.city].filter((x) => x.trim()).join(' · ')}
                </span>
              </Review>
              <Review t={t} title={t.reviewWorks} onEdit={() => setStep(1)}>
                {answers.works.map((w) => t.works[w]).join(' · ') || t.none}
              </Review>
              <Review t={t} title={t.reviewRooms(answers.rooms.length)} onEdit={() => setStep(2)}>
                <ul className="grid gap-1">
                  {answers.rooms.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium text-[var(--color-ink)]">{r.name}</span> — {t.roomType[r.type]}, {r.size.mode === 'class' ? t.sizeClass[r.size.cls] : r.size.mode === 'typed' ? <span dir="ltr">{`${r.size.lengthM} × ${r.size.widthM} m`}</span> : t.sizeModes.engineer}, {t.roomSummary(r.photoIds.length)}
                    </li>
                  ))}
                </ul>
              </Review>
              <Review t={t} title={t.reviewStyle} onEdit={() => setStep(3)}>
                {answers.style.styles.map((s) => t.styles[s].title).join(' + ') || t.none}
                {answers.style.palette && ` · ${t.palettes[answers.style.palette]}`}
                {answers.style.moods.length > 0 && ` · ${answers.style.moods.map((m) => t.moods[m]).join(', ')}`}
              </Review>
              <Review t={t} title={t.reviewBudget} onEdit={() => setStep(4)}>
                {answers.budget.tier ? t.budget[answers.budget.tier].title : t.none}
              </Review>
              <Review t={t} title={t.reviewTiming} onEdit={() => setStep(5)}>
                {answers.timing.start ? t.start[answers.timing.start] : t.none}
                {answers.timing.finishBy && <span dir="ltr"> · {answers.timing.finishBy}</span>}
              </Review>
              <Review t={t} title={t.reviewPlan} onEdit={() => setStep(6)}>
                {plan ? plan.fileName : t.none}
              </Review>
            </section>

            <section aria-labelledby="rn-privacy" className="grid gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 id="rn-privacy" className="text-title font-semibold text-[var(--color-ink)]">
                {t.privacyTitle}
              </h3>
              <ul className="grid list-disc gap-1 ps-5 text-sm text-[var(--color-ink-2)]">
                {t.privacy.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <label className="flex min-h-11 items-start gap-3 text-sm font-medium text-[var(--color-ink)]">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" checked={answers.consent.photoUse} onChange={(e) => set({ consent: { ...answers.consent, photoUse: e.currentTarget.checked } })} />
                {t.consentPhotos}
              </label>
              <label className="flex min-h-11 items-start gap-3 text-sm text-[var(--color-ink)]">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" checked={answers.consent.marketing} onChange={(e) => set({ consent: { ...answers.consent, marketing: e.currentTarget.checked } })} />
                <span>
                  {t.consentMarketing}
                  <span className="block text-xs text-[var(--color-ink-3)]">{t.consentMarketingHelp}</span>
                </span>
              </label>
            </section>

            <section aria-labelledby="rn-send" className="grid gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 id="rn-send" className="text-title font-semibold text-[var(--color-ink)]">
                {t.sendTitle}
              </h3>
              <ol className="grid list-decimal gap-1 ps-5 text-sm text-[var(--color-ink-2)]">
                {t.sendSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <Button variant="primary" size="lg" icon="download" onClick={download}>
                {t.saveFile}
              </Button>
              <div className="border-t border-[var(--color-border)] pt-3">
                <p className="text-sm text-[var(--color-ink-2)]">
                  {t.linkInstead} {t.linkNoPhotos}
                </p>
                <div className="mt-2">
                  <Button
                    icon="link"
                    disabled={linkTooLong}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(link)
                        .then(() => setSent(t.linkCopied))
                        .catch(() => setSent(t.linkTooLong))
                    }
                  >
                    {t.copyLink}
                  </Button>
                </div>
                {linkTooLong && <p className="mt-1 text-xs text-[var(--color-ink-3)]">{t.linkTooLong}</p>}
              </div>
              {sent && (
                <Notice kind="success" role="status">
                  {sent}
                </Notice>
              )}
              <p className="text-xs text-[var(--color-ink-3)]">{t.nothingSent}</p>
            </section>
          </div>
        )}
        <p className="mt-6 text-xs text-[var(--color-ink-3)]">{t.draftKeptNote}</p>
      </main>

      {!editing && (
        <nav aria-label="Wizard" className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-raised)]">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <Button size="lg" variant="ghost" onClick={back} disabled={step === 0}>
              <Icon name="arrow-left" size={18} className="rtl:rotate-180" />
              {t.back}
            </Button>
            {step < TOTAL - 1 && (
              <Button size="lg" variant="primary" onClick={next}>
                {step === 6 && !plan ? t.skip : t.next}
                <Icon name="arrow-right" size={18} className="rtl:rotate-180" />
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function Review({ t, title, children, onEdit }: { t: Strings; title: string; children: ReactNode; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="min-w-0 flex-1 text-sm text-[var(--color-ink-2)]">
        <p className="font-semibold text-[var(--color-ink)]">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
      <Button size="sm" variant="ghost" icon="edit" ariaLabel={`${t.change}: ${title}`} onClick={onEdit}>
        {t.change}
      </Button>
    </div>
  );
}

