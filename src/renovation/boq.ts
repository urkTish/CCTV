/**
 * Bill of quantities (spec 6.6, 6.7), pure. Each measured work item becomes a
 * line priced ONLY from a library rate; a missing or empty rate makes the line
 * unpriced and the BOQ incomplete, with the reason (as the CCTV BOM does).
 * Totals reconcile to the sum of the lines:
 *
 *   subtotal = Σ amounts → + contingency % → = before VAT → + VAT % → total
 *
 * Views: by trade (sections 01–14, for the engineer and the contract) and by
 * room (for the client). Q8: until the survey confirms every assumed value the
 * client sees a range (total × (1 − low%) … × (1 + high%)), "subject to survey".
 */

import { rateByCode, rateExpired, type Library } from './library.ts';
import { TRADE_LABEL, TRADES, type Milestone, type PortalData, type RnSettings, type Trade } from './model.ts';
import type { ProjectQuantities, WorkItem } from './quantities.ts';
import { figure, num, type Figure } from './trace.ts';

export interface BoqLine {
  readonly ref: string;
  readonly key: string;
  readonly trade: Trade;
  readonly roomId: string | null;
  readonly roomName: string;
  readonly rateCode: string;
  readonly description: string;
  readonly unit: string;
  readonly quantity: Figure;
  readonly rate: number | null;
  readonly amount: number | null;
  readonly rateSource: string;
  readonly rateSample: boolean;
  readonly rateUnverified: boolean;
  readonly rateExpired: boolean;
  readonly item: WorkItem;
}

export interface BoqGroup {
  readonly id: string;
  readonly label: string;
  readonly lines: readonly BoqLine[];
  readonly subtotal: number;
}

export interface Boq {
  readonly lines: readonly BoqLine[];
  readonly byTrade: readonly BoqGroup[];
  readonly byRoom: readonly BoqGroup[];
  readonly subtotal: number;
  readonly contingency: Figure;
  readonly beforeVat: number;
  readonly vat: Figure;
  readonly total: number;
  readonly currency: string;
  readonly complete: boolean;
  readonly incompleteReasons: readonly string[];
  /** Lines priced with a seeded sample rate (Final is blocked while any). */
  readonly sampleRateLines: number;
  readonly expiredRateLines: number;
  readonly unverifiedRateLines: number;
}

const PROJECT_ROOM = 'Whole project';

export function buildBoq(portal: PortalData, q: ProjectQuantities, today: string): Boq {
  const line = portal.renovation;
  const lib: Library | null = line?.library ?? null;
  const settings = line?.settings;
  const items: WorkItem[] = [...q.projectItems.filter((i) => i.trade === 'prelims'), ...q.rooms.flatMap((r) => r.items), ...q.projectItems.filter((i) => i.trade !== 'prelims')];
  const reasons: string[] = [];
  const counters = new Map<Trade, number>();
  const roomName = (id: string | null) => (id === null ? PROJECT_ROOM : portal.rooms.find((r) => r.id === id)?.name ?? id);

  const lines: BoqLine[] = items.map((it) => {
    const r = lib ? rateByCode(lib, it.rateCode) : null;
    const n = (counters.get(it.trade) ?? 0) + 1;
    counters.set(it.trade, n);
    const sectionNo = TRADE_LABEL[it.trade].slice(0, 2);
    const ref = `${sectionNo}.${String(n).padStart(2, '0')}`;
    let rate: number | null = null;
    if (!r) reasons.push(`${ref} ${it.description} (${roomName(it.roomId)}): rate ${it.rateCode} is not in the library.`);
    else if (r.rate === null) reasons.push(`${ref} ${it.description} (${roomName(it.roomId)}): rate ${it.rateCode} has no price yet.`);
    else rate = r.rate;
    if (r && r.unit !== it.unit) reasons.push(`${ref}: rate ${it.rateCode} is per ${r.unit} but the quantity is in ${it.unit}.`);
    const amount = rate === null ? null : round2(rate * it.quantity.value);
    return {
      ref,
      key: it.key,
      trade: it.trade,
      roomId: it.roomId,
      roomName: roomName(it.roomId),
      rateCode: it.rateCode,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      rate,
      amount,
      rateSource: r?.source ?? '',
      rateSample: r?.sample ?? false,
      rateUnverified: r ? r.unverified || !r.source.trim() : true,
      rateExpired: r ? rateExpired(r, today) : false,
      item: it,
    };
  });

  const sum = (ls: readonly BoqLine[]) => round2(ls.reduce((s, l) => s + (l.amount ?? 0), 0));
  const byTrade: BoqGroup[] = TRADES.map((t) => {
    const ls = lines.filter((l) => l.trade === t);
    return { id: t, label: TRADE_LABEL[t], lines: ls, subtotal: sum(ls) };
  }).filter((g) => g.lines.length > 0);
  const roomIds: (string | null)[] = [null, ...portal.rooms.map((r) => r.id)];
  const byRoom: BoqGroup[] = roomIds
    .map((id) => {
      const ls = lines.filter((l) => l.roomId === id);
      return { id: id ?? 'project', label: roomName(id), lines: ls, subtotal: sum(ls) };
    })
    .filter((g) => g.lines.length > 0);

  const subtotal = sum(lines);
  const cPct = settings?.contingencyPercent ?? 0;
  const contingencyValue = round2((subtotal * cPct) / 100);
  const contingency = figure(contingencyValue, settings?.currency ?? '', `Contingency = ${num(subtotal)} × ${num(cPct)}% = ${num(contingencyValue)}`, [
    { key: 'contingencyPercent', label: 'Contingency', value: cPct, unit: '%', source: 'Project setting', unverified: true },
  ]);
  const beforeVat = round2(subtotal + contingencyValue);
  const vPct = settings?.vatPercent ?? 0;
  const vatValue = round2((beforeVat * vPct) / 100);
  const vat = figure(vatValue, settings?.currency ?? '', `VAT = ${num(beforeVat)} × ${num(vPct)}% = ${num(vatValue)}`, [
    { key: 'vatPercent', label: 'VAT rate', value: vPct, unit: '%', source: 'Settings (owner to confirm, Q4)', unverified: true },
  ]);
  if (lines.length === 0) reasons.push('No priced work yet: specify finishes for at least one room.');
  return {
    lines,
    byTrade,
    byRoom,
    subtotal,
    contingency,
    beforeVat,
    vat,
    total: round2(beforeVat + vatValue),
    currency: settings?.currency ?? '',
    complete: reasons.length === 0,
    incompleteReasons: reasons,
    sampleRateLines: lines.filter((l) => l.rateSample && l.rate !== null).length,
    expiredRateLines: lines.filter((l) => l.rateExpired).length,
    unverifiedRateLines: lines.filter((l) => l.rateUnverified).length,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface PaymentRow {
  readonly milestone: Milestone;
  readonly amount: number;
}

export interface PaymentSchedule {
  readonly rows: readonly PaymentRow[];
  readonly percentTotal: number;
  /** The milestones must add up to 100%. */
  readonly ok: boolean;
}

/** Payment milestones on the total incl. VAT; the last row takes the rounding remainder. */
export function paymentSchedule(total: number, milestones: readonly Milestone[]): PaymentSchedule {
  const pct = milestones.reduce((s, m) => s + m.percent, 0);
  let running = 0;
  const rows = milestones.map((m, i) => {
    const amount = i === milestones.length - 1 && Math.abs(pct - 100) < 1e-9 ? round2(total - running) : round2((total * m.percent) / 100);
    running = round2(running + amount);
    return { milestone: m, amount };
  });
  return { rows, percentTotal: pct, ok: Math.abs(pct - 100) < 1e-9 };
}

export interface PriceRange {
  readonly low: number;
  readonly high: number;
  readonly figure: Figure;
}

/** Q8: the range shown to the client before the survey. */
export function priceRange(total: number, s: Pick<RnSettings, 'rangeLowPercent' | 'rangeHighPercent' | 'currency'>): PriceRange {
  const low = roundTo(total * (1 - s.rangeLowPercent / 100), 100, 'down');
  const high = roundTo(total * (1 + s.rangeHighPercent / 100), 100, 'up');
  return {
    low,
    high,
    figure: figure(high, s.currency, `Range = estimate ${num(total)} − ${num(s.rangeLowPercent)}% … + ${num(s.rangeHighPercent)}%, rounded to 100 = ${num(low)} – ${num(high)}`, [
      { key: 'range', label: 'Range before survey', value: s.rangeHighPercent, unit: '%', source: 'Settings (owner decision Q8)', unverified: true },
    ]),
  };
}

function roundTo(n: number, step: number, dir: 'up' | 'down'): number {
  return (dir === 'up' ? Math.ceil(n / step - 1e-9) : Math.floor(n / step + 1e-9)) * step;
}
