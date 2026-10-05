/**
 * WCAG 2.x contrast of the design tokens, computed — not judged by eye.
 *
 * Reads the colour tokens straight out of src/index.css for both themes and
 * checks every foreground/background pair the UI actually uses:
 *   - text pairs need 4.5:1 (WCAG 1.4.3, normal-size text);
 *   - control boundaries, focus rings and status indicators need 3:1 (1.4.11).
 * Relative luminance and the ratio follow the WCAG 2.2 definitions
 * (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { BRAND_BLUE } from '../brand.ts';

const css = readFileSync(resolve(__dirname, '..', 'index.css'), 'utf8');

function block(selectorPattern: RegExp): Record<string, string> {
  const m = selectorPattern.exec(css);
  if (!m) throw new Error(`token block not found: ${selectorPattern}`);
  const start = css.indexOf('{', m.index) + 1;
  const end = css.indexOf('}', start);
  const out: Record<string, string> = {};
  for (const [, name, value] of css.slice(start, end).matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[name!] = value!.toLowerCase();
  }
  return out;
}

const LIGHT = block(/^:root \{/m);
const DARK = block(/^:root\[data-theme='dark'\] \{/m);
const DARK_MEDIA = block(/^ {2}:root:not\(\[data-theme='light'\]\) \{/m);

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** [foreground, background] token names. */
const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ...['canvas', 'surface', 'surface-2', 'surface-3'].map((bg) => ['ink', bg] as const),
  ...['canvas', 'surface', 'surface-2', 'surface-3'].map((bg) => ['ink-2', bg] as const),
  ...['canvas', 'surface', 'surface-2'].map((bg) => ['ink-3', bg] as const),
  ...['canvas', 'surface', 'surface-2', 'accent-soft', 'brand-soft'].map((bg) => ['accent', bg] as const),
  ['ink', 'accent-soft'],
  ['accent-ink', 'accent'],
  ['accent-ink', 'accent-hover'],
  ['pass', 'pass-soft'],
  ['pass', 'surface'],
  ['marginal', 'marginal-soft'],
  ['marginal', 'surface'],
  ['fail', 'fail-soft'],
  ['fail', 'surface'],
  ['estimate', 'estimate-soft'],
  ['estimate', 'surface'],
];

/** Non-text: input borders, focus ring, nav indicator, progress bar, selected outline. */
const UI_PAIRS: readonly (readonly [string, string])[] = [
  ['border-strong', 'surface'],
  ['border-strong', 'canvas'],
  ['brand', 'surface'],
  ['brand', 'canvas'],
  ['brand', 'surface-2'],
  ['accent', 'surface'],
];

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('%s theme tokens', (_name, t) => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('indicator %s on %s is at least 3:1', (fg, bg) => {
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(3);
  });
});

describe('brand blue in the token set', () => {
  it('is the blue sampled from the logo, in both themes', () => {
    expect(LIGHT.brand).toBe(BRAND_BLUE.toLowerCase());
    expect(DARK.brand).toBe(BRAND_BLUE.toLowerCase());
  });

  it('is not used for body text: it fails 4.5:1 on white, which is why --color-accent exists', () => {
    expect(contrast(BRAND_BLUE, '#ffffff')).toBeLessThan(4.5);
    expect(contrast(BRAND_BLUE, '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('is never a status colour', () => {
    for (const t of [LIGHT, DARK]) {
      for (const s of ['pass', 'marginal', 'fail']) expect(t[s]).not.toBe(t.brand);
    }
  });
});

describe('theme blocks stay in sync', () => {
  it('the OS-dark block and the explicit dark block define the same colours', () => {
    expect(DARK_MEDIA).toEqual(DARK);
  });

  it('both themes define the same token names', () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort());
  });
});
