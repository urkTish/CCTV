import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  BRAND_FILES,
  LOGO_LIGHT_URL,
  LOGO_DARK_URL,
  STAMP_URL,
  BRAND_BLUE,
  COMPANY_NAME,
  APP_TITLE,
  LOGO_INTRINSIC,
} from './brand.ts';

const BRAND_DIR = resolve(__dirname, 'assets', 'brand');

/** Width, height and PNG colour type straight from the IHDR chunk. */
function pngHeader(path: string): { width: number; height: number; colourType: number } {
  const buf = readFileSync(path);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colourType: buf.readUInt8(25) };
}

describe('brand module', () => {
  it('every exported file resolves to a real, non-empty file in src/assets/brand', () => {
    for (const [key, name] of Object.entries(BRAND_FILES)) {
      const path = join(BRAND_DIR, name);
      expect(existsSync(path), key).toBe(true);
      expect(statSync(path).size, key).toBeGreaterThan(1000);
    }
  });

  it('the imported URLs point at those same files', () => {
    expect(LOGO_LIGHT_URL).toMatch(new RegExp(`${BRAND_FILES.logoLight.replace('.', '\\.')}$`));
    expect(LOGO_DARK_URL).toMatch(new RegExp(`${BRAND_FILES.logoDark.replace('.', '\\.')}$`));
    expect(STAMP_URL).toMatch(new RegExp(`${BRAND_FILES.stamp.replace('.', '\\.')}$`));
  });

  it('the processed images are RGBA PNGs (they carry transparency)', () => {
    for (const name of [BRAND_FILES.logoLight, BRAND_FILES.logoDark, BRAND_FILES.stamp]) {
      expect(pngHeader(join(BRAND_DIR, name)).colourType, name).toBe(6);
    }
  });

  it('keeps the stamp at full source resolution', () => {
    const stamp = pngHeader(join(BRAND_DIR, BRAND_FILES.stamp));
    const original = pngHeader(join(BRAND_DIR, BRAND_FILES.stampOriginal));
    expect([stamp.width, stamp.height]).toEqual([original.width, original.height]);
    expect([stamp.width, stamp.height]).toEqual([1024, 1024]);
  });

  it('records the logo’s real intrinsic size, and both variants match it', () => {
    for (const name of [BRAND_FILES.logoLight, BRAND_FILES.logoDark]) {
      const h = pngHeader(join(BRAND_DIR, name));
      expect([h.width, h.height], name).toEqual([LOGO_INTRINSIC.width, LOGO_INTRINSIC.height]);
    }
  });

  it('exports the company name, title and a valid brand-blue hex', () => {
    expect(COMPANY_NAME).toBe('ContracTech');
    expect(APP_TITLE).toMatch(/^ContracTech/);
    expect(BRAND_BLUE).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('never references the Desktop source folder from code', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx|css|json|html)$/.test(entry)) continue;
        if (/Desktop[\\/]+Contractech/i.test(readFileSync(p, 'utf8')) && !p.endsWith('brand.test.ts')) offenders.push(p);
      }
    };
    walk(resolve(__dirname));
    expect(offenders).toEqual([]);
  });
});
