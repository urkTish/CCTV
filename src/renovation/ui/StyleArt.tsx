/**
 * Style-quiz vignettes and paint chips.
 *
 * The vignettes are small geometric room scenes (rectangles, arcs and lines on
 * a coarse grid — no freehand drawing), one per style, each in that style's own
 * colours. They are pictures, like photographs, so they keep their colours in
 * both themes on a fixed light "paper" background. Decorative: the card text
 * names the style.
 *
 * PaintChips is the renovation module's signature element: a fan-deck chip
 * strip — colour field above, a white tab with the code below — used for the
 * client's palette cards, the swatch sheet and the proposal's schedule.
 */

import type { ReactNode } from 'react';

import { inkOn } from '../briefs.ts';
import type { StyleId } from '../model.ts';

function Scene({ children, wall, floor }: { children: ReactNode; wall: string; floor: string }) {
  return (
    <svg viewBox="0 0 120 72" className="block h-auto w-full" aria-hidden="true" focusable="false">
      <rect width="120" height="72" fill={wall} />
      <rect y="54" width="120" height="18" fill={floor} />
      <path d="M0 54h120" stroke="#00000022" strokeWidth="1" />
      {children}
    </svg>
  );
}

const ART: Readonly<Record<StyleId, ReactNode>> = {
  'modern-minimal': (
    <Scene wall="#eef0f1" floor="#d9dcdd">
      <rect x="14" y="12" width="30" height="22" fill="#ffffff" stroke="#c4c8cb" />
      <rect x="58" y="40" width="44" height="12" rx="2" fill="#9aa1a6" />
      <rect x="60" y="34" width="40" height="7" rx="2" fill="#b7bdc1" />
      <path d="M86 6v14" stroke="#30363a" strokeWidth="1" />
      <circle cx="86" cy="22" r="3" fill="#30363a" />
    </Scene>
  ),
  'warm-contemporary': (
    <Scene wall="#efe3d3" floor="#c9a985">
      <rect x="12" y="10" width="26" height="30" rx="13" fill="#e2c9a6" />
      <rect x="52" y="36" width="52" height="16" rx="8" fill="#b9805d" />
      <rect x="56" y="30" width="44" height="9" rx="4.5" fill="#d1a07a" />
      <circle cx="30" cy="48" r="5" fill="#6f8a5a" />
      <rect x="28" y="48" width="4" height="6" fill="#8a6a4e" />
    </Scene>
  ),
  'contemporary-arabic': (
    <Scene wall="#efe6d8" floor="#bfa784">
      <path d="M14 54V24a14 14 0 0 1 28 0v30" fill="#d9c3a0" stroke="#a88a5f" strokeWidth="1.5" />
      <path d="M78 54V24a14 14 0 0 1 28 0v30" fill="#d9c3a0" stroke="#a88a5f" strokeWidth="1.5" />
      <rect x="46" y="44" width="28" height="10" rx="2" fill="#7a3b2e" />
      <path d="M50 49h20" stroke="#d9b36c" strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M60 8l4 4-4 4-4-4z" fill="#a88a5f" />
    </Scene>
  ),
  classic: (
    <Scene wall="#f1ece3" floor="#b9a68c">
      <rect x="10" y="10" width="28" height="36" fill="none" stroke="#c9b99c" strokeWidth="1.5" />
      <rect x="14" y="14" width="20" height="28" fill="none" stroke="#c9b99c" strokeWidth="1" />
      <rect x="82" y="10" width="28" height="36" fill="none" stroke="#c9b99c" strokeWidth="1.5" />
      <rect x="86" y="14" width="20" height="28" fill="none" stroke="#c9b99c" strokeWidth="1" />
      <rect x="46" y="38" width="28" height="14" rx="3" fill="#5c6f86" />
      <path d="M0 6h120" stroke="#c9b99c" strokeWidth="2" />
    </Scene>
  ),
  scandinavian: (
    <Scene wall="#f6f5f1" floor="#dcc7a6">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${84 + i * 5} 8v46`} stroke="#d8c09a" strokeWidth="3" />
      ))}
      <rect x="12" y="38" width="44" height="14" rx="3" fill="#c7cdd1" />
      <rect x="16" y="32" width="36" height="8" rx="3" fill="#dde2e5" />
      <circle cx="66" cy="44" r="6" fill="#8fa889" />
      <rect x="64" y="44" width="4" height="10" fill="#c9a77a" />
    </Scene>
  ),
  industrial: (
    <Scene wall="#8b8f92" floor="#5d6164">
      <rect x="12" y="8" width="40" height="30" fill="#2f3438" />
      <path d="M32 8v30M12 23h40" stroke="#8b8f92" strokeWidth="1.5" />
      <rect x="62" y="38" width="46" height="14" rx="1" fill="#7a4b33" />
      <path d="M62 52v2M108 52v2" stroke="#1d2124" strokeWidth="2" />
      <path d="M90 0v14" stroke="#1d2124" strokeWidth="1" />
      <path d="M85 14h10l-2 5h-6z" fill="#1d2124" />
    </Scene>
  ),
};

export function StyleVignette({ style }: { style: StyleId }) {
  return <span className="block overflow-hidden rounded-control border border-[var(--color-border)]">{ART[style]}</span>;
}

export interface Chip {
  readonly hex: string;
  readonly code?: string;
  readonly name?: string;
}

/** A strip of paint chips: colour field, code tab. `size="sm"` drops the tab text. */
export function PaintChips({ chips, size = 'md' }: { chips: readonly Chip[]; size?: 'sm' | 'md' }) {
  return (
    <span className="flex w-full gap-1" aria-hidden={size === 'sm' ? true : undefined}>
      {chips.map((c, i) => (
        <span key={`${c.hex}-${i}`} className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[4px] border border-[#00000026] bg-white">
          <span className={size === 'sm' ? 'h-8' : 'h-14'} style={{ background: c.hex }} />
          {size === 'md' && (
            <span className="truncate px-1 py-0.5 font-mono text-2xs leading-tight text-[#3a4654]" style={{ borderTop: `3px solid ${c.hex}` }}>
              {c.code ?? c.hex.toUpperCase()}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** A single swatch with legible text on it (Admin tables, the proposal). */
export function Swatch({ hex, label }: { hex: string; label?: string }) {
  return (
    <span
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-[4px] border border-[#00000033] px-1 font-mono text-2xs"
      style={{ background: hex, color: inkOn(hex) }}
      title={`${label ?? ''} ≈ ${hex.toUpperCase()} (screen approximation — check the physical sample)`}
    >
      {label}
    </span>
  );
}
