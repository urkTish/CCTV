/**
 * Form fields the Jobs section needs and the shared primitives do not have: a
 * date, a multi-line text and an optional amount. Same look as the primitives
 * (shared `controlClass`), same pattern: a visible label and a helper line.
 */

import { useEffect, useId, useState } from 'react';

import { controlClass } from '../../ui/uiStyles.ts';

function Label({ id, children }: { id: string; children: string }) {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
      {children}
    </label>
  );
}

function Helper({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="mt-1 text-xs text-[var(--color-ink-3)]">
      {children}
    </p>
  );
}

export function DateField({ label, helper, value, onChange }: { label: string; helper: string; value: string | null; onChange: (next: string | null) => void }) {
  const id = useId();
  return (
    <div>
      <Label id={id}>{label}</Label>
      <input
        id={id}
        type="date"
        className={`${controlClass} mt-1`}
        value={value ?? ''}
        aria-describedby={`${id}-helper`}
        onChange={(e) => onChange(/^\d{4}-\d{2}-\d{2}$/.test(e.currentTarget.value) ? e.currentTarget.value : null)}
      />
      <Helper id={`${id}-helper`}>{helper}</Helper>
    </div>
  );
}

export function TextAreaField({ label, helper, value, onChange, max, rows = 3 }: { label: string; helper: string; value: string; onChange: (next: string) => void; max: number; rows?: number }) {
  const id = useId();
  return (
    <div>
      <Label id={id}>{label}</Label>
      <textarea
        id={id}
        dir="auto"
        rows={rows}
        className={`${controlClass} mt-1`}
        value={value}
        aria-describedby={`${id}-helper`}
        onChange={(e) => onChange(e.currentTarget.value.slice(0, max))}
      />
      <Helper id={`${id}-helper`}>{helper}</Helper>
    </div>
  );
}

/** An amount in SAR that may be left empty. Keeps what was typed until it is a valid number. */
export function AmountField({ label, helper, value, onChange }: { label: string; helper: string; value: number | null; onChange: (next: number | null) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    // Follow outside changes (another job opened, an import) without fighting the typing.
    setDraft((d) => (Number(d.replace(/,/g, '')) === value || (d.trim() === '' && value === null) ? d : value === null ? '' : String(value)));
  }, [value]);
  return (
    <div>
      <Label id={id}>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-sm text-[var(--color-ink-3)]">SAR</span>
        <input
          id={id}
          inputMode="decimal"
          className={`${controlClass} ${invalid ? 'border-[var(--color-fail)]' : ''}`}
          value={draft}
          aria-invalid={invalid}
          aria-describedby={`${id}-helper`}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            setDraft(raw);
            const clean = raw.replace(/,/g, '').trim();
            if (clean === '') {
              setInvalid(false);
              onChange(null);
              return;
            }
            const n = Number(clean);
            const ok = Number.isFinite(n) && n >= 0 && n <= 1_000_000_000;
            setInvalid(!ok);
            if (ok) onChange(n);
          }}
        />
      </div>
      <Helper id={`${id}-helper`}>{invalid ? 'Type a number, e.g. 18500. It is not saved until it is one.' : helper}</Helper>
    </div>
  );
}
