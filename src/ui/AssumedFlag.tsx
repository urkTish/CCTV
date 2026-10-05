/**
 * "Assumed from client intake — please confirm": the marker on every input whose
 * value was not given by the client but defaulted by the intake mapping. It
 * clears when the engineer confirms the value or edits it.
 */

import { Icon } from './icons.tsx';

export const ASSUMED_TEXT = 'Assumed from client intake — please confirm';

export function AssumedFlag({ reason, onConfirm, fieldLabel }: { reason: string; onConfirm: () => void; fieldLabel: string }) {
  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-dashed px-2 py-1 text-xs"
      style={{ borderColor: 'var(--color-estimate)', background: 'var(--color-estimate-soft)', color: 'var(--color-estimate)' }}
    >
      <Icon name="info" size={14} />
      <span className="font-semibold">{ASSUMED_TEXT}</span>
      <span className="text-[var(--color-ink-2)]">{reason}</span>
      <button
        type="button"
        onClick={onConfirm}
        className="ml-auto rounded-control border border-[var(--color-estimate)] bg-[var(--color-surface)] px-2 py-0.5 font-semibold text-[var(--color-estimate)] hover:bg-[var(--color-surface-2)]"
        aria-label={`Confirm ${fieldLabel}`}
      >
        Confirm
      </button>
    </div>
  );
}
