/**
 * A simple programme (spec 6.8), pure. Each trade's quantity across the
 * project becomes an activity:
 *
 *   Duration (days) = Quantity ÷ (Productivity per worker-day × Crew size),
 *   rounded up to half days, plus hold times
 *
 * Activities follow the standard renovation sequence one after another (no
 * resource levelling in the MVP). Productivities and holds are Unverified rule
 * constants from the library; crew sizes are per project (default 2).
 */

import { ruleOf, type Library } from './library.ts';
import type { Trade } from './model.ts';
import type { ProjectQuantities, WorkItem } from './quantities.ts';
import { ceilHalf, constantOf, figure, num, type Figure, type TraceConstant } from './trace.ts';

export interface Activity {
  readonly id: string;
  readonly label: string;
  readonly trade: Trade;
  readonly quantity: number;
  readonly unit: string;
  readonly crew: number;
  readonly duration: Figure;
  /** Day offsets from the start (0-based), half-day resolution. */
  readonly start: number;
  readonly end: number;
  readonly rooms: readonly string[];
  readonly milestone: boolean;
}

export interface Programme {
  readonly activities: readonly Activity[];
  readonly totalDays: number;
  readonly warnings: readonly string[];
}

interface Step {
  readonly id: string;
  readonly label: string;
  readonly trade: Trade;
  readonly match: (it: WorkItem) => boolean;
  readonly prodKey: string | null;
  /** Quantity used: area × coats for paint. */
  readonly qty?: (it: WorkItem) => number;
  readonly perTeamOf?: number;
  readonly holdKey?: string;
  readonly fixedDays?: number;
}

const SEQUENCE: readonly Step[] = [
  { id: 'setup', label: 'Protection and set-up', trade: 'prelims', match: (it) => it.trade === 'prelims', prodKey: null, fixedDays: 0.5 },
  { id: 'strip', label: 'Strip-out', trade: 'demolition', match: (it) => it.activity === 'demolition', prodKey: 'prodDemolition' },
  { id: 'repairs', label: 'Civil repairs and surface preparation', trade: 'repairs', match: (it) => it.activity === 'paint', prodKey: 'prodPrep' },
  { id: 'ceiling', label: 'Gypsum ceilings', trade: 'ceiling', match: (it) => it.activity === 'gypsum', prodKey: 'prodGypsum', perTeamOf: 2 },
  { id: 'wall-tile', label: 'Wall tiling', trade: 'wall', match: (it) => it.activity === 'wall-tile', prodKey: 'prodWallTile', holdKey: 'holdAdhesiveGrout' },
  { id: 'floor-tile', label: 'Floor tiling', trade: 'floor', match: (it) => it.activity === 'floor-tile', prodKey: 'prodFloorTile', holdKey: 'holdAdhesiveGrout' },
  { id: 'floor-tile-large', label: 'Floor tiling, large format', trade: 'floor', match: (it) => it.activity === 'floor-tile-large', prodKey: 'prodFloorTileLarge', holdKey: 'holdAdhesiveGrout' },
  { id: 'skirting', label: 'Skirting', trade: 'floor', match: (it) => it.activity === 'skirting', prodKey: 'prodSkirting' },
  { id: 'paint', label: 'Painting (all coats)', trade: 'painting', match: (it) => it.activity === 'paint', prodKey: 'prodPaint', qty: (it) => it.quantity.value * (it.coats ?? 1), holdKey: 'holdPaintRecoat' },
  { id: 'clean', label: 'Snagging and final clean', trade: 'cleaning', match: (it) => it.trade === 'cleaning', prodKey: null, fixedDays: 0.5 },
];

export const DEFAULT_CREW = 2;

export function buildProgramme(q: ProjectQuantities, lib: Library, crews: Partial<Record<Trade, number>>, roomName: (id: string | null) => string): Programme {
  const items = [...q.projectItems, ...q.rooms.flatMap((r) => r.items)];
  const activities: Activity[] = [];
  const warnings: string[] = [];
  let day = 0;
  for (const step of SEQUENCE) {
    const matched = items.filter(step.match);
    if (matched.length === 0) continue;
    const crew = crews[step.trade] ?? DEFAULT_CREW;
    const rooms = [...new Set(matched.map((m) => roomName(m.roomId)))];
    let duration: Figure;
    let quantity = 0;
    let unit = matched[0]!.unit;
    if (step.prodKey === null) {
      duration = figure(step.fixedDays ?? 0.5, 'days', `${num(step.fixedDays ?? 0.5)} day (fixed allowance)`);
      unit = 'item';
    } else {
      quantity = matched.reduce((s, it) => s + (step.qty ? step.qty(it) : it.quantity.value), 0);
      const prod = ruleOf(lib, step.prodKey);
      const consts: TraceConstant[] = [constantOf(prod)];
      const teams = step.perTeamOf ? crew / step.perTeamOf : crew;
      const raw = prod.value * teams > 0 ? quantity / (prod.value * teams) : 0;
      let days = ceilHalf(raw);
      let holdText = '';
      if (step.holdKey) {
        const hold = ruleOf(lib, step.holdKey);
        if (hold.value > 0) {
          days += hold.value;
          holdText = ` + ${num(hold.value)} day hold`;
          consts.push(constantOf(hold));
        }
      }
      const crewText = step.perTeamOf ? `${num(teams)} team${teams === 1 ? '' : 's'} of ${step.perTeamOf}` : `crew ${crew}`;
      const qtyText = step.qty ? `${num(quantity)} ${unit} (area × coats)` : `${num(quantity)} ${unit}`;
      duration = figure(days, 'days', `${qtyText} ÷ (${num(prod.value)} ${prod.rule.unit} × ${crewText}) = ${num(raw)} → ${num(ceilHalf(raw))} days${holdText}`, consts);
      if (step.id === 'paint' || step.id === 'repairs') unit = 'm²';
    }
    const start = day;
    day += duration.value;
    activities.push({ id: step.id, label: step.label, trade: step.trade, quantity, unit, crew, duration, start, end: day, rooms, milestone: false });
  }
  if (activities.length > 0) {
    activities.push({ id: 'handover', label: 'Handover', trade: 'cleaning', quantity: 0, unit: '', crew: 0, duration: figure(0, 'days', 'Milestone'), start: day, end: day, rooms: [], milestone: true });
  } else warnings.push('No work items yet, so there is no programme.');
  return { activities, totalDays: day, warnings };
}
