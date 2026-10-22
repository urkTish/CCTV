/**
 * Shared pieces for the renovation Admin screens, built on the existing
 * primitives so spacing, type and focus behaviour match the CCTV sections.
 */

import { useId, useState, type ReactNode } from 'react';

import { Icon } from '../../ui/icons.tsx';
import { EmptyState, EstimateBadge, NumberInput } from '../../ui/primitives.tsx';
import type { RnSectionId, RnWarning } from '../derive.ts';
import { isUnverified, num, type Figure } from '../trace.ts';

/** "How this was calculated": the formula as applied, then every constant with its source. */
export function FigureExplain({ f, label }: { f: Figure; label?: string }) {
  return (
    <details className="mt-0.5">
      <summary className="cursor-pointer text-xs text-[var(--color-accent)] hover:underline">
        How this was calculated{label ? <span className="sr-only">: {label}</span> : null}
      </summary>
      <div className="mt-1 rounded-control bg-[var(--color-surface-2)] p-2 text-xs leading-relaxed text-[var(--color-ink-2)]">
        <p className="font-mono break-words">{f.formula}</p>
        {f.constants.length > 0 && (
          <ul className="mt-1.5 grid gap-0.5">
            {dedupe(f.constants).map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-[var(--color-ink)]">{c.label}:</span>
                <span className="font-mono">
                  {num(c.value, 3)} {c.unit}
                </span>
                <span className="text-[var(--color-ink-3)]">— {c.source}</span>
                {c.unverified && <EstimateBadge />}
              </li>
            ))}
          </ul>
        )}
        {f.notes.map((n) => (
          <p key={n} className="mt-1">
            {n}
          </p>
        ))}
      </div>
    </details>
  );
}

function dedupe<T extends { key: string }>(xs: readonly T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
}

/** A figure value with its unit and an Unverified badge when any constant is a rule of thumb. */
export function FigureValue({ f, dp = 2, strong = false }: { f: Figure; dp?: number; strong?: boolean }) {
  return (
    <span className={`font-mono ${strong ? 'font-semibold text-[var(--color-ink)]' : ''}`}>
      {num(f.value, dp)} {f.unit}
      {isUnverified(f) && (
        <span className="ms-1.5 align-middle">
          <EstimateBadge title="Uses a rule of thumb (Unverified) — see how this was calculated." />
        </span>
      )}
    </span>
  );
}

export function RnWarningList({ warnings, onGo, labelOf, empty }: { warnings: readonly RnWarning[]; onGo: (w: RnWarning) => void; labelOf: (s: RnSectionId | 'settings') => string; empty?: ReactNode }) {
  if (warnings.length === 0)
    return (
      <EmptyState icon="check-circle" title="Nothing needs attention">
        {empty}
      </EmptyState>
    );
  const sorted = [...warnings.filter((w) => w.severity === 'blocked'), ...warnings.filter((w) => w.severity === 'attention')];
  return (
    <ul className="grid gap-2" aria-label="Open items">
      {sorted.map((w) => (
        <li
          key={w.id}
          className="flex flex-wrap items-start gap-2 rounded-control border-s-4 px-3 py-2 text-sm"
          style={{ borderColor: w.severity === 'blocked' ? 'var(--color-fail)' : 'var(--color-marginal)', background: w.severity === 'blocked' ? 'var(--color-fail-soft)' : 'var(--color-marginal-soft)' }}
        >
          <span style={{ color: w.severity === 'blocked' ? 'var(--color-fail)' : 'var(--color-marginal)' }} className="mt-0.5">
            <Icon name={w.severity === 'blocked' ? 'x-circle' : 'alert'} size={16} title={w.severity === 'blocked' ? 'Blocked' : 'Needs attention'} />
          </span>
          <span className="min-w-0 flex-1 text-[var(--color-ink)]">{w.text}</span>
          <button type="button" onClick={() => onGo(w)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline">
            Go to {labelOf(w.section)}
            <Icon name="arrow-right" size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Tile({ label, value, note, onClick }: { label: string; value: ReactNode; note?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <dt className="text-xs font-medium text-[var(--color-ink-3)]">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold text-[var(--color-ink)]">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-[var(--color-ink-3)]">{note}</dd>}
    </>
  );
  const cls = 'block w-full rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-start shadow-[var(--shadow-card)]';
  return onClick ? (
    <div>
      <button type="button" onClick={onClick} className={`${cls} transition-colors hover:border-[var(--color-brand)]`}>
        <dl>{body}</dl>
      </button>
    </div>
  ) : (
    <div className={cls}>
      <dl>{body}</dl>
    </div>
  );
}

const inputCls = 'w-full rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none';

/** A compact labelled number input (tables, dense forms). Empty → null when `nullable`. */
export function Num({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 0.01,
  nullable = false,
  hideLabel = false,
  flag,
  help,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
  hideLabel?: boolean;
  flag?: ReactNode;
  help?: string;
}) {
  const id = useId();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block text-xs font-medium text-[var(--color-ink-2)]'}>
        {label}
        {unit && !hideLabel && <span className="font-normal text-[var(--color-ink-3)]"> ({unit})</span>}
      </label>
      <NumberInput
        id={id}
        className={`${inputCls} ${hideLabel ? '' : 'mt-0.5'} ${err ? 'border-[var(--color-fail)]' : ''}`}
        value={value ?? Number.NaN}
        min={min}
        max={max}
        step={step}
        aria-invalid={err ? true : undefined}
        onValueChange={(v) => {
          if (!Number.isFinite(v)) {
            if (nullable) {
              setErr(null);
              onChange(null);
            } else setErr('Enter a number.');
            return;
          }
          if ((min !== undefined && v < min) || (max !== undefined && v > max)) {
            setErr(`Between ${min ?? '−∞'} and ${max ?? '∞'}${unit ? ` ${unit}` : ''}.`);
            return;
          }
          setErr(null);
          onChange(v);
        }}
      />
      {help && <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">{help}</p>}
      {err && (
        <p role="alert" className="mt-0.5 text-xs font-medium text-[var(--color-fail)]">
          {err}
        </p>
      )}
      {flag}
    </div>
  );
}

export function Text({ label, value, onChange, max = 200, hideLabel = false, multiline = false, help, placeholder }: { label: string; value: string; onChange: (v: string) => void; max?: number; hideLabel?: boolean; multiline?: boolean; help?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block text-xs font-medium text-[var(--color-ink-2)]'}>
        {label}
      </label>
      {multiline ? (
        <textarea id={id} dir="auto" rows={4} value={value} placeholder={placeholder} onChange={(e) => onChange(e.currentTarget.value.slice(0, max))} className={`${inputCls} mt-0.5`} />
      ) : (
        <input id={id} dir="auto" value={value} placeholder={placeholder} onChange={(e) => onChange(e.currentTarget.value.slice(0, max))} className={`${inputCls} ${hideLabel ? '' : 'mt-0.5'}`} />
      )}
      {help && <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">{help}</p>}
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange, hideLabel = false, help }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; hideLabel?: boolean; help?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block text-xs font-medium text-[var(--color-ink-2)]'}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const m = options.find((o) => o.value === e.currentTarget.value);
          if (m) onChange(m.value);
        }}
        className={`${inputCls} ${hideLabel ? '' : 'mt-0.5'}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">{help}</p>}
    </div>
  );
}

export function Check({ label, checked, onChange, help }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]" />
      <label htmlFor={id} className="text-sm text-[var(--color-ink)]">
        {label}
        {help && <span className="block text-xs text-[var(--color-ink-3)]">{help}</span>}
      </label>
    </div>
  );
}

/** "Sample" badge for seeded library entries. */
export function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--color-marginal-soft)', color: 'var(--color-marginal)' }} title="Seeded sample — replace with your own rates and products">
      Sample
    </span>
  );
}
