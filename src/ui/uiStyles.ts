import type { IconName } from './icons.tsx';

/**
 * Class-name helpers shared by components (kept out of the .tsx files so those
 * export components only, which React Fast Refresh needs).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-control font-medium transition-colors duration-[var(--duration-fast)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50';
export const BUTTON_SIZE = { sm: 'px-2.5 py-1 text-xs', md: 'px-3 py-1.5 text-sm', lg: 'px-4 py-2.5 text-base' } as const;
const BUTTON_STYLE: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-hover)]',
  secondary:
    'border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]',
  ghost: 'text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
  danger: 'border border-[var(--color-fail)] bg-[var(--color-surface)] text-[var(--color-fail)] hover:bg-[var(--color-fail-soft)]',
};

export type ButtonSize = keyof typeof BUTTON_SIZE;

/** Classes for something that should look like a button but is not one (a file label, a link). */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_STYLE[variant]}`;
}

export function tabIds(base: string, id: string) {
  return { tab: `${base}-tab-${id}`, panel: `${base}-panel-${id}` };
}


export type StatusKind = 'not-started' | 'in-progress' | 'complete' | 'attention' | 'blocked';

export const STATUS_STYLE: Readonly<Record<StatusKind, { icon: IconName; fg: string; bg: string; label: string }>> = {
  'not-started': { icon: 'circle-dashed', fg: 'var(--color-ink-3)', bg: 'var(--color-surface-2)', label: 'Not started' },
  'in-progress': { icon: 'circle-half', fg: 'var(--color-accent)', bg: 'var(--color-accent-soft)', label: 'In progress' },
  complete: { icon: 'check-circle', fg: 'var(--color-pass)', bg: 'var(--color-pass-soft)', label: 'Complete' },
  attention: { icon: 'alert', fg: 'var(--color-marginal)', bg: 'var(--color-marginal-soft)', label: 'Needs attention' },
  blocked: { icon: 'x-circle', fg: 'var(--color-fail)', bg: 'var(--color-fail-soft)', label: 'Blocked' },
};

