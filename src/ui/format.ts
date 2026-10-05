/** Presentation helpers shared by the BOM section and the report. */

import type { BomCategory } from '../engine/billOfMaterials.ts';

export const CATEGORY_LABEL: Readonly<Record<BomCategory, string>> = {
  camera: 'Cameras',
  recorder: 'Recorder',
  drive: 'Hard drives',
  switch: 'PoE switches',
  cable: 'Cable',
  connector: 'Connectors',
  'patch-cord': 'Patch cords',
  fibre: 'Fibre',
};

export function formatMoney(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

