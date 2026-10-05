/**
 * The QR encoder (U15). Its output was also decoded by an independent decoder
 * (ZXing-C++ 3.1.1): 75 / 75 codes — every datasheet URL in the data files at
 * ECC L/M/Q/H, versions 1–13, all eight masks, plus UTF-8 text — decoded to
 * exactly the input. These tests pin the structure so a regression shows here.
 */

import { describe, it, expect } from 'vitest';

import { encodeQr, qrPath, QrError } from './qr.ts';

const finderAt = (m: readonly (readonly boolean[])[], x0: number, y0: number) =>
  Array.from({ length: 7 }, (_, y) => Array.from({ length: 7 }, (_, x) => (m[y0 + y]![x0 + x] ? 1 : 0)).join('')).join('/');
const FINDER = '1111111/1000001/1011101/1011101/1011101/1000001/1111111';

describe('QR encoder', () => {
  it('picks the smallest version and the size that goes with it', () => {
    expect(encodeQr('HELLO').version).toBe(1);
    expect(encodeQr('HELLO').size).toBe(21);
    const url = 'https://assets.hikvision.com/prd/public/all/files/202306/1686213513823.pdf';
    const q = encodeQr(url, 'M');
    expect(q.size).toBe(q.version * 4 + 17);
    expect(q.version).toBeGreaterThanOrEqual(4);
    expect(q.version).toBeLessThanOrEqual(6);
  });

  it('draws the three finder patterns and the timing lines', () => {
    const q = encodeQr('https://example.com/datasheet.pdf');
    const n = q.size;
    expect(finderAt(q.modules, 0, 0)).toBe(FINDER);
    expect(finderAt(q.modules, n - 7, 0)).toBe(FINDER);
    expect(finderAt(q.modules, 0, n - 7)).toBe(FINDER);
    for (let i = 8; i < n - 8; i++) {
      expect(q.modules[6]![i]).toBe(i % 2 === 0);
      expect(q.modules[i]![6]).toBe(i % 2 === 0);
    }
    expect(q.modules[n - 8]![8]).toBe(true); // the dark module
  });

  it('is deterministic', () => {
    expect(qrPath(encodeQr('same'))).toBe(qrPath(encodeQr('same')));
  });

  it('refuses text that no version can hold', () => {
    expect(() => encodeQr('x'.repeat(3000), 'H')).toThrow(QrError);
  });

  it('renders one unit square per dark module, offset by the quiet zone', () => {
    const q = encodeQr('A');
    const dark = q.modules.flat().filter(Boolean).length;
    const path = qrPath(q, 4);
    expect(path.match(/M/g)).toHaveLength(dark);
    expect(path.startsWith('M4 4h1v1h-1z')).toBe(true);
  });
});
