/**
 * The shared UI vocabulary. Every control in the app is built from these so
 * spacing, radius, type and focus behaviour stay identical everywhere.
 *
 * All inputs are labelled, all take a helper line, and all surface validation
 * inline rather than through an alert.
 */

import type { InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Icon, type IconName } from './icons.tsx';
import { buttonClass, STATUS_STYLE, tabIds, type ButtonSize, type ButtonVariant, type StatusKind } from './uiStyles.ts';

export function Card({
  title,
  subtitle,
  children,
  actions,
  id,
  className,
  flush = false,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  /** No inner padding (the content brings its own, e.g. a full-bleed table). */
  flush?: boolean;
}) {
  return (
    <section
      id={id}
      className={`min-w-0 rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${className ?? ''}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-[var(--color-ink)]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-[var(--color-ink-3)]">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={flush ? '' : 'px-4 py-4'}>{children}</div>
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
  flag,
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
  /** A marker shown under the helper, e.g. "assumed from client intake". */
  flag?: ReactNode;
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
      {flag}
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
  flag,
}: {
  label: string;
  helper: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
  flag?: ReactNode;
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
      {flag}
    </div>
  );
}

export function CheckboxField({
  label,
  helper,
  checked,
  onChange,
  flag,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  flag?: ReactNode;
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
        aria-describedby={helper ? helperId : undefined}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
          {label}
        </label>
        {helper && (
          <p id={helperId} className="text-xs text-[var(--color-ink-3)]">
            {helper}
          </p>
        )}
        {flag}
      </div>
    </div>
  );
}

export function TextField({
  label,
  helper,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  flag,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (next: string) => void;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  placeholder?: string;
  flag?: ReactNode;
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
        type={type}
        className={`${controlClass} mt-1`}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-describedby={helperId}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      <p id={helperId} className="mt-1 text-xs text-[var(--color-ink-3)]">
        {helper}
      </p>
      {flag}
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
  size = 'md',
  type = 'button',
  icon,
  disabled,
  ariaLabel,
  title,
  className,
  ariaExpanded,
  ariaControls,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit';
  icon?: IconName;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  className?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      title={title}
      className={`${buttonClass(variant, size)} ${className ?? ''}`}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
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

// ---------------------------------------------------------------------------
// Status: icon + text + colour, never colour alone
// ---------------------------------------------------------------------------

/** A compact status: icon and short text in the status colour. */
export function StatusBadge({ kind, children, compact = false }: { kind: StatusKind; children?: ReactNode; compact?: boolean }) {
  const s = STATUS_STYLE[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${compact ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs'}`}
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <Icon name={s.icon} size={compact ? 12 : 14} />
      {children ?? s.label}
    </span>
  );
}

/** A banner for a message that needs reading: info, warning or error. */
export function Notice({
  kind = 'info',
  title,
  children,
  role,
  actions,
}: {
  kind?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
  actions?: ReactNode;
}) {
  const map = {
    info: { border: 'var(--color-brand)', bg: 'var(--color-accent-soft)', fg: 'var(--color-ink)', icon: 'info' },
    warning: { border: 'var(--color-marginal)', bg: 'var(--color-marginal-soft)', fg: 'var(--color-marginal)', icon: 'alert' },
    error: { border: 'var(--color-fail)', bg: 'var(--color-fail-soft)', fg: 'var(--color-fail)', icon: 'x-circle' },
    success: { border: 'var(--color-pass)', bg: 'var(--color-pass-soft)', fg: 'var(--color-pass)', icon: 'check-circle' },
  } as const;
  const m = map[kind];
  return (
    <div
      role={role}
      className="flex gap-2.5 rounded-control border-l-4 px-3 py-2.5 text-sm"
      style={{ borderColor: m.border, background: m.bg, color: m.fg }}
    >
      <Icon name={m.icon} size={18} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** A big-number tile for the dashboard. */
export function Stat({ label, value, note, onClick, icon }: { label: string; value: ReactNode; note?: ReactNode; onClick?: () => void; icon?: IconName }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-3)]">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </span>
      <span className="mt-1 block font-mono text-lg font-semibold text-[var(--color-ink)]">{value}</span>
      {note && <span className="mt-0.5 block text-xs text-[var(--color-ink-3)]">{note}</span>}
    </>
  );
  const cls = 'block w-full rounded-card border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-card)]';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:border-[var(--color-brand)]`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-[var(--color-border-strong)] px-4 py-8 text-center">
      <span className="text-[var(--color-ink-3)]">
        <Icon name={icon} size={28} />
      </span>
      <p className="font-semibold text-[var(--color-ink)]">{title}</p>
      {children && <div className="max-w-prose text-sm text-[var(--color-ink-2)]">{children}</div>}
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs (WAI-ARIA tabs pattern: arrow keys, Home / End, roving tabindex)
// ---------------------------------------------------------------------------

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  /** Short text after the label, e.g. a count. */
  readonly badge?: ReactNode;
}

export function Tabs<T extends string>({
  label,
  idBase,
  tabs,
  active,
  onChange,
  size = 'md',
  wrap = false,
}: {
  label: string;
  idBase: string;
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
  /** Wrap onto a second row instead of scrolling sideways. */
  wrap?: boolean;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const to =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (to === null) return;
    e.preventDefault();
    const t = tabs[to];
    if (!t) return;
    onChange(t.id);
    refs.current.get(t.id)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`flex min-w-0 gap-x-1 border-b border-[var(--color-border)] ${wrap ? 'flex-wrap' : 'overflow-x-auto'}`}>
      {tabs.map((t, i) => {
        const selected = t.id === active;
        const ids = tabIds(idBase, t.id);
        return (
          <button
            key={t.id}
            ref={(el) => {
              if (el) refs.current.set(t.id, el);
              else refs.current.delete(t.id);
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 font-medium whitespace-nowrap transition-colors ${
              size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
            } ${
              selected
                ? 'border-[var(--color-brand)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, id, children, className }: { idBase: string; id: string; children: ReactNode; className?: string }) {
  const ids = tabIds(idBase, id);
  return (
    <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} tabIndex={0} className={`focus-visible:outline-offset-4 ${className ?? ''}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Advanced disclosure
// ---------------------------------------------------------------------------

/**
 * Rarely changed inputs. The summary says how many differ from their defaults,
 * so a changed allowance is never hidden without a trace.
 */
export function Advanced({ changed, children, label = 'Advanced', defaultOpen = false }: { changed: number; children: ReactNode; label?: string; defaultOpen?: boolean }) {
  return (
    <details className="group mt-4 rounded-control border border-[var(--color-border)] bg-[var(--color-surface)]" open={defaultOpen || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
        <Icon name="chevron-right" size={16} className="transition-transform group-open:rotate-90" />
        {label}
        {changed > 0 ? (
          <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
            {changed} changed from default
          </span>
        ) : (
          <span className="text-xs font-normal text-[var(--color-ink-3)]">all at defaults</span>
        )}
      </summary>
      <div className="grid gap-3 border-t border-[var(--color-border)] px-3 py-3">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Modal dialog: focus moves in, Tab is trapped, Escape closes, focus returns.
// ---------------------------------------------------------------------------

export function Dialog({
  title,
  open,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button');
    first?.focus();
    return () => previous?.focus();
  }, [open]);
  if (!open) return null;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const focusable = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]')];
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    if (!firstEl || !lastEl) return;
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" onKeyDown={onKey}>
      <div className="absolute inset-0 bg-[var(--color-scrim)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[90vh] w-full flex-col rounded-t-card bg-[var(--color-surface)] shadow-[var(--shadow-popover)] sm:rounded-card ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-[var(--color-ink)]">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-control p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)]" aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 text-sm text-[var(--color-ink-2)]">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
