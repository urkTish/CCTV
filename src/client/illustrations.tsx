/**
 * Small line illustrations for the client's plain-language choices. Drawn in
 * `currentColor` with the brand blue as the one accent, so they work in both
 * themes. Decorative: each sits beside its own text, so they are aria-hidden.
 */

import type { ReactNode } from 'react';

import type { Premises, SeeChoice } from './intakeTypes.ts';

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 48" width="64" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="shrink-0">
      {children}
    </svg>
  );
}

const ACCENT = 'var(--color-brand)';

const SEE: Readonly<Record<SeeChoice, ReactNode>> = {
  // a wide yard with a small figure and a car: "something is there"
  activity: (
    <>
      <path d="M2 38h60" />
      <path d="M8 38V26l8-6 8 6v12" />
      <circle cx="38" cy="27" r="2.2" stroke={ACCENT} />
      <path d="M38 29.5v5M38 34.5l-2 3.5M38 34.5l2 3.5M35.5 31h5" stroke={ACCENT} />
      <path d="M46 36h12M47 36l2-5h6l2 5" />
    </>
  ),
  // a person carrying a box
  actions: (
    <>
      <circle cx="26" cy="11" r="4" />
      <path d="M26 15v14M26 29l-5 11M26 29l5 11" />
      <path d="M26 19l8 4" />
      <rect x="33" y="18" width="12" height="10" rx="1" stroke={ACCENT} />
    </>
  ),
  // a familiar person with a tick
  recognise: (
    <>
      <circle cx="26" cy="15" r="7" />
      <path d="M13 42c1-9 6-13 13-13s12 4 13 13" />
      <circle cx="47" cy="14" r="8" stroke={ACCENT} />
      <path d="m43 14 3 3 5-6" stroke={ACCENT} />
    </>
  ),
  // a face close-up in a viewfinder
  identify: (
    <>
      <path d="M8 10V6h6M50 6h6v4M56 38v4h-6M14 42H8v-4" stroke={ACCENT} />
      <ellipse cx="32" cy="23" rx="10" ry="12" />
      <path d="M28 21h.01M36 21h.01M29 29c2 1.5 4 1.5 6 0" />
    </>
  ),
  // a number plate
  plates: (
    <>
      <rect x="6" y="14" width="52" height="20" rx="3" />
      <path d="M13 29V19l4 10V19M24 19h5v10h-5M24 24h4M35 19l3 10 3-10M46 19h5l-5 10h5" stroke={ACCENT} />
    </>
  ),
  // a cash register
  till: (
    <>
      <path d="M10 40h44l-4-16H14z" />
      <rect x="20" y="8" width="24" height="10" rx="1" />
      <path d="M32 18v6" />
      <path d="M22 30h4M30 30h4M38 30h4M24 35h16" stroke={ACCENT} />
    </>
  ),
};

export function SeeIllustration({ choice }: { choice: SeeChoice }) {
  return <Frame>{SEE[choice]}</Frame>;
}

const PREMISES_ICON: Readonly<Record<Premises, ReactNode>> = {
  home: <path d="M10 24 32 8l22 16M16 20v20h32V20M28 40V30h8v10" />,
  shop: (
    <>
      <path d="M10 18h44l-3-8H13zM12 18v22h40V18M24 40V28h16v12" />
      <path d="M10 18c0 3 2.5 5 5.5 5s5.5-2 5.5-5c0 3 2.5 5 5.5 5S32 21 32 18c0 3 2.5 5 5.5 5s5.5-2 5.5-5c0 3 2.5 5 5.5 5s5.5-2 5.5-5" stroke={ACCENT} />
    </>
  ),
  office: (
    <>
      <path d="M18 40V8h28v32M12 40h40" />
      <path d="M24 14h4M36 14h4M24 22h4M36 22h4M24 30h4M36 30h4" stroke={ACCENT} />
    </>
  ),
  warehouse: (
    <>
      <path d="M8 40V18l24-10 24 10v22" />
      <path d="M20 40V26h24v14M20 31h24M20 36h24" stroke={ACCENT} />
    </>
  ),
  public: (
    <>
      <path d="M8 16 32 6l24 10M10 40h44M14 18v18M24 18v18M40 18v18M50 18v18" />
      <path d="M8 16h48" stroke={ACCENT} />
    </>
  ),
  other: (
    <>
      <circle cx="32" cy="24" r="14" />
      <path d="M27 20a5 5 0 1 1 6 5v3M33 33h.01" stroke={ACCENT} />
    </>
  ),
};

export function PremisesIllustration({ premises }: { premises: Premises }) {
  return <Frame>{PREMISES_ICON[premises]}</Frame>;
}
