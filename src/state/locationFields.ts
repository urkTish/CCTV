/**
 * Field keys for a location's inputs ("geometry.mountHeightMetres", …), used to
 * mark values assumed from a client intake and to clear the mark when the
 * engineer edits the value. Pure; reads the shape, changes nothing.
 */

import type { Location } from './projectTypes.ts';

export type LocationGroup = 'geometry' | 'environment' | 'requirements';
export type LocationFieldKey = `${LocationGroup}.${string}` | 'purpose' | 'name';

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  return Object.is(a, b);
}

/** Keys whose value differs between two versions of the same location. */
export function changedLocationFields(prev: Location, next: Location): LocationFieldKey[] {
  const out: LocationFieldKey[] = [];
  if (prev.name !== next.name) out.push('name');
  if (prev.purpose !== next.purpose) out.push('purpose');
  for (const group of ['geometry', 'environment', 'requirements'] as const) {
    const a = prev[group] as unknown as Record<string, unknown>;
    const b = next[group] as unknown as Record<string, unknown>;
    for (const k of Object.keys(b)) if (!same(a[k], b[k])) out.push(`${group}.${k}`);
  }
  return out;
}

/** How many fields of a group differ from a reference (the defaults), among `keys`. */
export function countChanged<T extends object>(value: T, reference: T, keys: readonly (keyof T)[]): number {
  return keys.filter((k) => !same(value[k], reference[k])).length;
}

/** The Admin input tab a field lives on (null for the essentials above the tabs). */
export type InputTab = 'geometry' | 'purpose' | 'environment' | 'requirements';

export function inputTabOfField(key: string): InputTab | null {
  if (key === 'name' || key === 'requirements.cameraCount') return null;
  const group = key.split('.')[0];
  return group === 'geometry' || group === 'purpose' || group === 'environment' || group === 'requirements' ? group : null;
}
