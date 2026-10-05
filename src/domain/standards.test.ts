import { describe, it, expect } from 'vitest';
import {
  TIA568,
  HIKVISION_EXTEND_MODE,
  DECIMAL_BYTES_PER_TB,
  DEFAULT_FORMATTING_OVERHEAD,
  FORMATTING_OVERHEAD_IS_ESTIMATE,
  DEFAULT_CABLE_BOX_METRES,
} from './standards.ts';

describe('published limits', () => {
  it('uses the TIA-568 channel model: 90 m link + 10 m cords = 100 m channel', () => {
    expect(TIA568.permanentLinkMaxMetres).toBe(90);
    expect(TIA568.channelMaxMetres).toBe(100);
    expect(TIA568.permanentLinkMaxMetres + TIA568.patchCordAllowanceMetres).toBe(
      TIA568.channelMaxMetres,
    );
    expect(TIA568.sourceUrl).toMatch(/^https:\/\/www\.flukenetworks\.com\//);
  });

  it('uses Hikvision’s published extend-mode figures (300 m at 10 Mbps), not an assumed 250 m', () => {
    expect(HIKVISION_EXTEND_MODE.maxMetres).toBe(300);
    expect(HIKVISION_EXTEND_MODE.linkSpeedMbps).toBe(10);
    expect(HIKVISION_EXTEND_MODE.sourceUrl).toMatch(/assets\.hikvision\.com/);
  });

  it('treats drive capacity as decimal, per the manufacturers', () => {
    expect(DECIMAL_BYTES_PER_TB).toBe(1e12);
  });

  it('flags the formatting overhead as an estimate', () => {
    expect(FORMATTING_OVERHEAD_IS_ESTIMATE).toBe(true);
    expect(DEFAULT_FORMATTING_OVERHEAD).toBeGreaterThan(0);
    expect(DEFAULT_FORMATTING_OVERHEAD).toBeLessThan(0.2);
  });

  it('defaults to a 305 m (1000 ft) box', () => {
    expect(DEFAULT_CABLE_BOX_METRES).toBe(305);
  });
});
