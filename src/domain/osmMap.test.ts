/**
 * OpenStreetMap reference view (M5): the tile-policy constants, the measuring
 * maths and the notice shown above the map. Also guards that Leaflet stays out of
 * the main bundle: only `ui/osmLeaflet.ts` may import it, and only lazily.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  addMeasurePoint,
  greatCircleMetres,
  measuredMetres,
  OSM_COPYRIGHT_URL,
  OSM_MAX_ZOOM,
  OSM_OFFLINE_MESSAGE,
  OSM_TILE_URL,
  osmNotice,
  type OsmStatus,
} from './osmMap.ts';

describe('tile policy constants', () => {
  it('uses exactly the standard HTTPS tile URL, no subdomains', () => {
    expect(OSM_TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('caps zoom at 19 and links attribution to the copyright page', () => {
    expect(OSM_MAX_ZOOM).toBe(19);
    expect(OSM_COPYRIGHT_URL).toBe('https://www.openstreetmap.org/copyright');
  });
});

describe('measuring', () => {
  it('one degree of latitude is π/180 × 6 371 km', () => {
    expect(greatCircleMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_194.93, 1);
  });

  it('a degree of longitude shrinks with cos(latitude)', () => {
    // At 60° N, 0.001° of longitude ≈ 111 194.93 × 0.5 × 0.001 = 55.6 m.
    expect(greatCircleMetres({ lat: 60, lng: 10 }, { lat: 60, lng: 10.001 })).toBeCloseTo(55.597, 2);
  });

  it('is symmetric and zero for the same point', () => {
    const a = { lat: 25.2, lng: 55.27 };
    const b = { lat: 25.21, lng: 55.29 };
    expect(greatCircleMetres(a, b)).toBeCloseTo(greatCircleMetres(b, a), 9);
    expect(greatCircleMetres(a, a)).toBe(0);
  });

  it('two clicks make a line; a third starts a new one', () => {
    const p = (lat: number) => ({ lat, lng: 0 });
    let pts = addMeasurePoint([], p(1));
    expect(measuredMetres(pts)).toBeNull();
    pts = addMeasurePoint(pts, p(2));
    expect(measuredMetres(pts)).toBeCloseTo(111_194.93, 1);
    pts = addMeasurePoint(pts, p(3));
    expect(pts).toEqual([p(3)]);
    expect(measuredMetres(pts)).toBeNull();
  });
});

describe('notice above the map', () => {
  const ok: OsmStatus = { online: true, protocol: 'https:', load: 'ready', loadError: null, tileErrors: 0 };

  it('says nothing when the map is loaded and online', () => {
    expect(osmNotice(ok)).toBeNull();
  });

  it('says loading while Leaflet is being fetched', () => {
    expect(osmNotice({ ...ok, load: 'loading' })).toEqual({ kind: 'info', text: 'Loading the map…' });
  });

  it('puts offline first, above every other problem', () => {
    expect(osmNotice({ ...ok, online: false, load: 'failed', tileErrors: 3, protocol: 'file:' })).toEqual({
      kind: 'error',
      text: OSM_OFFLINE_MESSAGE,
    });
  });

  it('reports a failed load with its reason', () => {
    expect(osmNotice({ ...ok, load: 'failed', loadError: 'chunk missing' })?.text).toBe(
      'The map could not be loaded: chunk missing. The plan-image mode is unaffected.',
    );
  });

  it('counts failed tiles', () => {
    expect(osmNotice({ ...ok, tileErrors: 1 })?.text).toMatch(/^1 map tile failed to load/);
    expect(osmNotice({ ...ok, tileErrors: 4 })?.text).toMatch(/^4 map tiles failed to load/);
  });

  it('warns that a page opened from a file sends no Referer', () => {
    expect(osmNotice({ ...ok, protocol: 'file:' })?.text).toMatch(/no Referer header/);
  });
});

describe('Leaflet stays out of the main bundle', () => {
  const srcDir = join(__dirname, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
    });

  it('only ui/osmLeaflet.ts imports leaflet', () => {
    const importers = files(srcDir)
      .filter((p) => /from 'leaflet'|import 'leaflet/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(srcDir, p).replaceAll('\\', '/'));
    expect(importers).toEqual(['ui/osmLeaflet.ts']);
  });

  it('osmLeaflet.ts is reached only through a dynamic import()', () => {
    for (const p of files(srcDir)) {
      const text = readFileSync(p, 'utf8');
      expect(text, relative(srcDir, p)).not.toMatch(/^import (?!type\b)[^;]*osmLeaflet/m);
    }
    expect(readFileSync(join(srcDir, 'ui/OsmReferenceMap.tsx'), 'utf8')).toMatch(/import\('\.\/osmLeaflet\.ts'\)/);
  });
});
