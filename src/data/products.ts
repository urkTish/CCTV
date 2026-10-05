/**
 * Validating loaders for the phase-2 product categories. Each file is parsed at
 * import time and fails loudly, naming the offending path, exactly like the
 * camera loader.
 */

import rawNvrs from './hikvision-nvrs.json';
import rawSwitches from './hikvision-switches.json';
import rawHdds from './hdds.json';
import { parseOrThrow } from './shared.ts';
import {
  nvrDatasetSchema,
  switchDatasetSchema,
  hddDatasetSchema,
  type Nvr,
  type PoeSwitch,
  type Hdd,
} from './productSchemas.ts';

export const nvrDataset = parseOrThrow(nvrDatasetSchema, rawNvrs, 'hikvision-nvrs.json');
export const switchDataset = parseOrThrow(switchDatasetSchema, rawSwitches, 'hikvision-switches.json');
export const hddDataset = parseOrThrow(hddDatasetSchema, rawHdds, 'hdds.json');

export const nvrs: readonly Nvr[] = nvrDataset.items;
export const poeSwitches: readonly PoeSwitch[] = switchDataset.items;
export const hdds: readonly Hdd[] = hddDataset.items;

export function nvrById(id: string): Nvr | null {
  return nvrs.find((n) => n.id === id) ?? null;
}
export function switchById(id: string): PoeSwitch | null {
  return poeSwitches.find((s) => s.id === id) ?? null;
}
export function hddById(id: string): Hdd | null {
  return hdds.find((h) => h.id === id) ?? null;
}

export type { Nvr, PoeSwitch, Hdd } from './productSchemas.ts';
