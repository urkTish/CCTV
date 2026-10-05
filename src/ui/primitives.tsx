/**
 * The shared UI vocabulary. Every control in the app is built from these so
 * spacing, radius, type and focus behaviour stay identical everywhere.
 *
 * All inputs are labelled, all take a helper line, and all surface validation
 * inline rather than through an alert.
 */

import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId, useState } from 'react';

export function Card({
  title,
  subtitle,
  children,
  actions,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div>
            {title && <h2 className="text-base font-semibold text-[var(--color-ink)]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-[var(--color-ink-3)]">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export function Fieldset({
  legend,
  helper,
  children,
}: {
  legend: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="mb-section border-0 p-0">
      <legend className="mb-1 text-sm font-semibold tracking-wide text-[var(--color-ink)] uppercase">
        {legend}
      </legend>
      {helper && <p className="mb-3 text-sm text-[var(--color-ink-3)]">{helper}</p>}
      <div className="grid gap-3">{children}</div>
    </fieldset>
  );
}

const controlClass =
  'w-full rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] ' +
  'focus:border-[var(--color-accent)] focus:outline-none';

export function NumberField({
  label,
  helper,
  unit,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  error,
}: {
  label: string;
  helper: string;
  unit?: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string | null;
}) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
        {label}
        {unit && <span className="ml-1 font-normal text-[var(--color-ink-3)]">({unit})</span>}
      </label>
      <NumberInput
        id={id}
        className={`${controlClass} mt-1 ${error ? 'border-[var(--color-fail)]' : ''}`}
        value={value}
        min={min}
        max={max}
        step={step}
        aria-describedby={error ? `${helperId} ${errorId}` : helperId}
        aria-invalid={error ? true : undefined}
        onValueChange={onChange}
      />
      <p id={helperId} className="mt-1 text-xs text-[var(--color-ink-3)]">
        {helper}
      </p>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-[var(--color-fail)]">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A number `<input>` that keeps what the engineer is typing.
 *
 * A plain controlled number input snaps back to the stored value whenever the
 * text is not (yet) a number — an emptied field, a lone "-" — because the parent
 * refuses NaN. Clearing "305" and typing "3" then gave "3053". While the field
 * has focus this shows the typed text as-is and reports every keystroke
 * (`NaN` when it is not a number); on blur it shows the stored value again, so a
 * clamped or rounded value appears once the engineer leaves the field.
 */
export function NumberInput({
  value,
  onValueChange,
  onBlur,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  /** The typed number, or NaN when the text is empty or not a number; `raw` is the text. */
  onValueChange: (next: number, raw: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...rest}
      type="number"
      value={draft ?? (Number.isFinite(value) ? value : '')}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        setDraft(raw);
        onValueChange(raw.trim() === '' ? Number.NaN : e.currentTarget.valueAsNumber, raw);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}

export function SelectField<T extends string | number>({
  label,
  helper,
  value,
  options,
  onChange,
}: {
  label: string;
  helper: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  const id = useId();
  const helperId = `${id}-helper`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
        {label}
      </label>
      <select
        id={id}
        className={`${controlClass} mt-1`}
        value={String(value)}
        aria-describedby={helperId}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          const match = options.find((o) => String(o.value) === raw);
          if (match) onChange(match.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <p id={helperId} className="mt-1 text-xs text-[var(--color-ink-3)]">
        {helper}
      </p>
    </div>
  );
}

export function CheckboxField({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  const helperId = `${id}-helper`;
  return (
    <div className="flex gap-2.5">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
        checked={checked}
        aria-describedby={helperId}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
          {label}
        </label>
        <p id={helperId} className="text-xs text-[var(--color-ink-3)]">
          {helper}
        </p>
      </div>
    </div>
  );
}

export function TextField({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = useId();
  const helperId = `${id}-helper`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        className={`${controlClass} mt-1`}
        value={value}
        aria-describedby={helperId}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      <p id={helperId} className="mt-1 text-xs text-[var(--color-ink-3)]">
        {helper}
      </p>
    </div>
  );
}

export type Verdict = 'pass' | 'marginal' | 'fail' | 'info';

const VERDICT_STYLE: Record<Verdict, { bg: string; fg: string; label: string }> = {
  pass: { bg: 'var(--color-pass-soft)', fg: 'var(--color-pass)', label: 'Pass' },
  marginal: { bg: 'var(--color-marginal-soft)', fg: 'var(--color-marginal)', label: 'Marginal' },
  fail: { bg: 'var(--color-fail-soft)', fg: 'var(--color-fail)', label: 'Fail' },
  info: { bg: 'var(--color-surface-2)', fg: 'var(--color-ink-2)', label: 'Info' },
};

export function VerdictBadge({ verdict, children }: { verdict: Verdict; children?: ReactNode }) {
  const style = VERDICT_STYLE[verdict];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {children ?? style.label}
    </span>
  );
}

export function EstimateBadge({ title }: { title?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: 'var(--color-estimate-soft)', color: 'var(--color-estimate)' }}
      title={title ?? 'This figure is an estimate or an engineering allowance, not a sourced value.'}
    >
      Unverified
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition-colors';
  const styles = {
    primary:
      'bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90',
    secondary:
      'border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]',
    ghost: 'text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]',
  } as const;
  return (
    <button type={type} onClick={onClick} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  );
}

/** The "how this was calculated" disclosure. No number is shown without one. */
export function Explain({ formula, sourceUrl }: { formula: string; sourceUrl: string | null }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-[var(--color-accent)] hover:underline">
        How this was calculated
      </summary>
      <div className="mt-1 rounded-control bg-[var(--color-surface-2)] p-2 text-xs leading-relaxed text-[var(--color-ink-2)]">
        <p className="font-mono">{formula}</p>
        {sourceUrl && (
          <p className="mt-1.5">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--color-accent)] underline"
            >
              Source
            </a>
          </p>
        )}
      </div>
    </details>
  );
}
