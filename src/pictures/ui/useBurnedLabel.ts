/**
 * Burn a label into a picture for print (browser canvas), cached per picture
 * and text. Returns null until the burned copy is ready, or when no canvas is
 * available (the caller then lays the same words over the picture).
 */

import { useEffect, useState } from 'react';

import { burnLabel } from '../../renovation/photos.ts';

const burned = new Map<string, string>();

export function useBurnedLabel(src: string, text: string): string | null {
  const key = `${text}\u0000${src}`;
  const [out, setOut] = useState<string | null>(() => burned.get(key) ?? null);
  useEffect(() => {
    const hit = burned.get(key);
    if (hit) {
      setOut(hit);
      return;
    }
    setOut(null);
    let live = true;
    burnLabel(src, text)
      .then((r) => {
        if (!r) return;
        burned.set(key, r.dataUri);
        if (live) setOut(r.dataUri);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key, src, text]);
  return out;
}

