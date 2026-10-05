import { describe, it, expect } from 'vitest';
import { nvrs, poeSwitches, hdds, nvrDataset, switchDataset, hddDataset } from './products.ts';
import { parseOrThrow, ProductDataError } from './shared.ts';
import {
  nvrDatasetSchema,
  nvrSchema,
  poeSwitchSchema,
  hddSchema,
  switchDatasetSchema,
} from './productSchemas.ts';

const OFFICIAL_HOSTS: Record<string, RegExp> = {
  Hikvision: /^https:\/\/(assets\.hikvision\.com|www\.hikvision\.com)\//,
  Seagate: /^https:\/\/www\.seagate\.com\//,
  'Western Digital': /^https:\/\/documents\.westerndigital\.com\//,
};

describe('NVR dataset', () => {
  it('loads 12 to 20 models', () => {
    expect(nvrs.length).toBeGreaterThanOrEqual(12);
    expect(nvrs.length).toBeLessThanOrEqual(20);
    expect(nvrDataset.schemaVersion).toBe(1);
  });

  it('sources every model from an official Hikvision URL with a real date', () => {
    for (const n of nvrs) {
      expect(n.datasheetUrl, n.model).toMatch(OFFICIAL_HOSTS.Hikvision!);
      expect(Number.isNaN(Date.parse(n.verifiedOn)), n.model).toBe(false);
    }
  });

  it('spans 4 to 64 channels, PoE and non-PoE, 1 to 8+ bays, with and without RAID', () => {
    const ch = nvrs.map((n) => n.channels);
    expect(Math.min(...ch)).toBe(4);
    expect(Math.max(...ch)).toBeGreaterThanOrEqual(64);
    expect(nvrs.some((n) => n.poePorts > 0)).toBe(true);
    expect(nvrs.some((n) => n.poePorts === 0)).toBe(true);
    expect(Math.min(...nvrs.map((n) => n.sataBays))).toBe(1);
    expect(Math.max(...nvrs.map((n) => n.sataBays))).toBeGreaterThanOrEqual(8);
    expect(nvrs.some((n) => n.raidLevels.length > 0)).toBe(true);
    expect(nvrs.some((n) => n.redundantPsu)).toBe(true);
  });

  it('never has more PoE ports than channels', () => {
    for (const n of nvrs) expect(n.poePorts, n.model).toBeLessThanOrEqual(n.channels);
  });

  it('only calls a chassis 19-inch rack when it is at least 440 mm wide', () => {
    for (const n of nvrs) {
      const width = Number(/^(\d+(?:\.\d+)?)/.exec(n.dimensions ?? '')?.[1] ?? NaN);
      if (Number.isNaN(width)) continue;
      expect(n.rackWidth19in, n.model).toBe(width >= 440);
    }
  });

  it('rejects a PoE recorder with no published PoE budget', () => {
    const bad = { ...nvrs.find((n) => n.poePorts > 0)!, poeBudgetWatts: null };
    expect(nvrSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects hot spare without RAID', () => {
    const bad = { ...nvrs.find((n) => n.raidLevels.length === 0)!, hotSpare: true };
    expect(nvrSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown field', () => {
    expect(nvrSchema.safeParse({ ...nvrs[0]!, surprise: 1 }).success).toBe(false);
  });

  it('fails loudly on a corrupt file, naming the path', () => {
    const broken = structuredClone(nvrDataset) as { items: { channels: unknown }[] };
    broken.items[2]!.channels = 'many';
    expect(() => parseOrThrow(nvrDatasetSchema, broken, 'hikvision-nvrs.json')).toThrow(ProductDataError);
    expect(() => parseOrThrow(nvrDatasetSchema, broken, 'hikvision-nvrs.json')).toThrow(/items\.2\.channels/);
  });

  it('rejects duplicate ids', () => {
    const dup = { ...nvrDataset, items: [nvrs[0]!, nvrs[0]!] };
    expect(nvrDatasetSchema.safeParse(dup).success).toBe(false);
  });
});

describe('PoE switch dataset', () => {
  it('loads 10 to 15 models from official Hikvision URLs', () => {
    expect(poeSwitches.length).toBeGreaterThanOrEqual(10);
    expect(poeSwitches.length).toBeLessThanOrEqual(15);
    for (const s of poeSwitches) expect(s.datasheetUrl, s.model).toMatch(OFFICIAL_HOSTS.Hikvision!);
    expect(switchDataset.schemaVersion).toBe(1);
  });

  it('covers unmanaged and managed, long-range, and at least one 802.3bt port', () => {
    expect(poeSwitches.some((s) => s.management === 'unmanaged')).toBe(true);
    expect(poeSwitches.some((s) => s.management === 'smart-managed')).toBe(true);
    expect(poeSwitches.some((s) => s.longRangePorts > 0)).toBe(true);
    expect(poeSwitches.some((s) => s.hiPoePorts > 0)).toBe(true);
  });

  it('never states a long-range speed it did not source (only one model has it)', () => {
    const withSpeed = poeSwitches.filter((s) => s.longRangeSpeedMbps !== null);
    expect(withSpeed.map((s) => s.id)).toEqual(['ds-3e0326p-e-m-b']);
    expect(withSpeed[0]!.longRangeSpeedMbps).toBe(10);
  });

  it('never has a per-port maximum above the total budget', () => {
    for (const s of poeSwitches) {
      expect(s.maxPortPowerWatts, s.model).toBeLessThanOrEqual(s.poeBudgetWatts);
      if (s.hiPoeMaxPortPowerWatts !== null) {
        expect(s.hiPoeMaxPortPowerWatts, s.model).toBeLessThanOrEqual(s.poeBudgetWatts);
      }
    }
  });

  it('rejects a switch with no uplink', () => {
    const bad = { ...poeSwitches[0]!, uplinkCopperPorts: 0, uplinkSfpPorts: 0, uplinkComboPorts: 0 };
    expect(poeSwitchSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a long-range switch with no published reach', () => {
    const bad = { ...poeSwitches.find((s) => s.longRangePorts > 0)!, longRangeMaxMetres: null };
    expect(poeSwitchSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a duplicate id', () => {
    const dup = { ...switchDataset, items: [poeSwitches[0]!, poeSwitches[0]!] };
    expect(switchDatasetSchema.safeParse(dup).success).toBe(false);
  });
});

describe('HDD dataset', () => {
  it('sources every drive from its manufacturer’s own domain', () => {
    expect(hdds.length).toBeGreaterThan(10);
    for (const h of hdds) expect(h.datasheetUrl, h.model).toMatch(OFFICIAL_HOSTS[h.manufacturer]!);
    expect(hddDataset.schemaVersion).toBe(1);
  });

  it('includes no SMR drives', () => {
    expect(hdds.some((h) => h.recordingTechnology === 'SMR')).toBe(false);
  });

  it('records the Hikvision compatibility-list check for every drive', () => {
    for (const h of hdds) expect(h.onHikvisionCompatList, h.model).not.toBeNull();
  });

  it('confirms a Hikvision-branded drive exists and is flagged as off the compatibility list', () => {
    const hik = hdds.filter((h) => h.manufacturer === 'Hikvision');
    expect(hik.length).toBeGreaterThan(0);
    for (const h of hik) expect(h.onHikvisionCompatList).toBe(false);
  });

  it('covers every capacity an NVR in the catalogue can take, up to 16 TB', () => {
    const caps = new Set(hdds.map((h) => h.capacityTb));
    for (const c of [1, 2, 4, 6, 8, 10, 12, 14, 16]) expect(caps, `${c} TB`).toContain(c);
  });

  it('rejects an unknown manufacturer', () => {
    expect(hddSchema.safeParse({ ...hdds[0]!, manufacturer: 'Acme' }).success).toBe(false);
  });
});
