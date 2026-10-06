/** Presentation helpers shared by the BOM section, the report and the Site map. */

import type { BomCategory } from '../engine/billOfMaterials.ts';
import type { CanvasSides, LayoutCanvas } from '../domain/layoutShapes.ts';
import { lengthFromMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { UnitSystemState } from '../state/projectTypes.ts';

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

/** "Canvas 20 × 16 m · grid 1 m", in the engineer's length unit. */
export function canvasReadout(canvas: LayoutCanvas, gridMetres: number, units: UnitSystemState): string {
  const u = lengthUnitLabel(units);
  const m = (v: number, dp: number) => round(lengthFromMetres(v, units), dp);
  return `Canvas ${m(canvas.widthMetres, 1)} × ${m(canvas.heightMetres, 1)} ${u} · grid ${m(gridMetres, 2)} ${u}`;
}

/** "left 2 m, right 3.5 m" — the sides drawn shapes reach past, or '' when none. */
export function overflowText(o: CanvasSides, units: UnitSystemState): string {
  const u = lengthUnitLabel(units);
  return (['left', 'right', 'top', 'bottom'] as const)
    .filter((k) => o[k] > 0)
    .map((k) => `${k} ${round(lengthFromMetres(o[k], units), 1)} ${u}`)
    .join(', ');
}
