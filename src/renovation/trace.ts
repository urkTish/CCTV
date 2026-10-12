/**
 * A traced figure: every number the renovation engine produces carries the
 * formula as applied, the constants it used (with their source and Unverified
 * flag) and notes. The UI shows it in a "How this was calculated" disclosure,
 * as the CCTV engine does.
 */

import type { RuleLookup } from './library.ts';

export interface TraceConstant {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly source: string;
  readonly unverified: boolean;
}

export interface Figure {
  readonly value: number;
  readonly unit: string;
  /** The formula with the numbers substituted, e.g. "46.26 m² × 2 ÷ 10 m²/L × 1.05 = 9.71 L". */
  readonly formula: string;
  readonly constants: readonly TraceConstant[];
  readonly notes: readonly string[];
}

export function constantOf(r: RuleLookup): TraceConstant {
  return { key: r.rule.key, label: r.rule.label, value: r.value, unit: r.rule.unit, source: r.rule.source, unverified: r.rule.unverified };
}

export function figure(value: number, unit: string, formula: string, constants: readonly TraceConstant[] = [], notes: readonly string[] = []): Figure {
  return { value, unit, formula, constants, notes };
}

export function isUnverified(f: Figure): boolean {
  return f.constants.some((c) => c.unverified);
}

/** A number for a formula or a table: at most `dp` decimals, trailing zeros dropped. */
export function num(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 10 ** dp) / 10 ** dp;
  return r.toLocaleString('en-GB', { maximumFractionDigits: dp, useGrouping: false });
}

/** Round up, tolerating floating-point noise (59.4444 → 60, but 60.0000000001 → 60). */
export function ceilSafe(x: number): number {
  return Math.ceil(x - 1e-9);
}

/** Round up to the next half (durations in half days). */
export function ceilHalf(x: number): number {
  return ceilSafe(x * 2) / 2;
}
