/**
 * Bill of materials (N2). `buildBillOfMaterials(project)` is pure and typed: it
 * runs the whole design pass and lists what to buy, so the later client report
 * can print it without calculating anything.
 *
 * Rules:
 *   - every product line (camera, recorder, drive, switch) carries the
 *     manufacturer datasheet URL and the date it was read;
 *   - commodity lines (CAT6 boxes, RJ45 connectors, patch cords, fibre runs) are
 *     not a specific product: `datasheetUrl` is null and `generic` is true,
 *     never a made-up part number;
 *   - a quantity that depends on an estimate (a placeholder run, a routing
 *     factor, an estimated bitrate) is flagged `isEstimate`;
 *   - a line that needs the engineer's attention (fibre, an engineer-pinned
 *     recorder that fails a check, a drive not on Hikvision's compatibility
 *     list) is `flagged`, with the reason in `notes`;
 *   - anything that could not be designed (no camera for a location, no
 *     recorder, a switch group nothing serves, storage that does not fit) makes
 *     the BOM `complete: false` with the reasons — it is never silently short.
 */

import type { PriceTier } from '../data/shared.ts';
import type { Project } from '../domain/types.ts';
import { designProject, SHIPPED_CATALOGUE, type Catalogue, type ProjectDesign } from './projectDesign.ts';

export type BomCategory = 'camera' | 'recorder' | 'drive' | 'switch' | 'cable' | 'connector' | 'patch-cord' | 'fibre';

export interface BomLine {
  /** Stable key: category + product id (or a fixed key for commodity lines). */
  readonly id: string;
  readonly category: BomCategory;
  readonly manufacturer: string | null;
  /** Manufacturer part number; null for a commodity line. */
  readonly model: string | null;
  readonly description: string;
  readonly quantity: number;
  readonly unit: 'each' | 'box' | 'm';
  readonly datasheetUrl: string | null;
  readonly verifiedOn: string | null;
  /** Editorial price band (ASSUMPTIONS 3.1, 7.9), never a price. */
  readonly priceTier: PriceTier | null;
  /** A commodity item, not a specific product: no datasheet by design. */
  readonly generic: boolean;
  /** The quantity depends on an estimated figure. */
  readonly isEstimate: boolean;
  /** Needs the engineer's attention before ordering; the reason is in `notes`. */
  readonly flagged: boolean;
  /** Where it is used and anything to check, in plain language. */
  readonly notes: readonly string[];
}

export interface BomLocationSummary {
  readonly locationId: string;
  readonly name: string;
  readonly cameraCount: number;
  /** Null when no model satisfies the location. */
  readonly cameraModel: string | null;
  readonly lens: string | null;
  readonly retentionDays: number;
}

export interface BillOfMaterials {
  readonly projectName: string;
  readonly lines: readonly BomLine[];
  readonly locations: readonly BomLocationSummary[];
  readonly totals: {
    readonly cameras: number;
    readonly recorders: number;
    readonly drives: number;
    readonly rawTb: number;
    readonly usableTb: number;
    readonly requiredUsableTb: number | null;
    readonly switches: number;
    readonly cableBoxes: number;
    readonly cableMetresToBuy: number;
    readonly fibreUplinks: number;
  };
  /** False when something could not be designed; see `incompleteReasons`. */
  readonly complete: boolean;
  readonly incompleteReasons: readonly string[];
  /** Every warning that applies, from every stage. */
  readonly warnings: readonly string[];
  /** The full design the BOM was built from (traces, checks, alternatives) for the report. */
  readonly design: ProjectDesign;
}

const CATEGORY_ORDER: readonly BomCategory[] = ['camera', 'recorder', 'drive', 'switch', 'cable', 'connector', 'patch-cord', 'fibre'];

function round1(m: number): number {
  return Math.round(m * 10) / 10;
}

export function buildBillOfMaterials(project: Project, catalogue: Catalogue = SHIPPED_CATALOGUE): BillOfMaterials {
  const design = designProject(project, catalogue);
  const lines: BomLine[] = [];
  const incomplete: string[] = [...design.errors];

  // --- cameras: one line per model + lens, with the locations it serves -------
  const cameraLines = new Map<string, { line: BomLine; where: string[] }>();
  for (const inst of design.instances) {
    const key = `camera:${inst.camera.id}:${inst.lensLabel}`;
    const existing = cameraLines.get(key);
    if (existing) {
      cameraLines.set(key, { ...existing, line: { ...existing.line, quantity: existing.line.quantity + 1 } });
      if (!existing.where.includes(inst.locationName)) existing.where.push(inst.locationName);
      continue;
    }
    cameraLines.set(key, {
      line: {
        id: key,
        category: 'camera',
        manufacturer: 'Hikvision',
        model: inst.camera.model,
        description: `${inst.camera.marketingName}, ${inst.lensLabel}`,
        quantity: 1,
        unit: 'each',
        datasheetUrl: inst.camera.datasheetUrl,
        verifiedOn: inst.camera.verifiedOn,
        priceTier: inst.camera.priceTier,
        generic: false,
        // The camera count itself is the engineer's input, not an estimate.
        isEstimate: false,
        flagged: false,
        notes: [],
      },
      where: [inst.locationName],
    });
  }
  for (const { line, where } of cameraLines.values()) {
    lines.push({ ...line, notes: [`Locations: ${where.join(', ')}.`] });
  }
  if (design.unresolvedLocations.length) {
    incomplete.push(`No camera model satisfies: ${design.unresolvedLocations.join(', ')}. Their cameras are not in this BOM.`);
  }

  // --- recorder and drives ------------------------------------------------------
  const nvr = design.nvr;
  let drives = 0;
  let rawTb = 0;
  let usableTb = 0;
  if (nvr?.primary) {
    const e = nvr.primary.evaluation;
    const pinnedFails = nvr.primary.label === 'chosen by engineer' && e.failed.length > 0;
    lines.push({
      id: `recorder:${e.nvr.id}`,
      category: 'recorder',
      manufacturer: 'Hikvision',
      model: e.nvr.model,
      description: `${e.nvr.marketingName} — ${e.nvr.channels} channels, ${e.nvr.sataBays} bays${e.nvr.poePorts ? `, ${e.nvr.poePorts} PoE ports` : ''}`,
      quantity: 1,
      unit: 'each',
      datasheetUrl: e.nvr.datasheetUrl,
      verifiedOn: e.nvr.verifiedOn,
      priceTier: e.nvr.priceTier,
      generic: false,
      isEstimate: false,
      flagged: pinnedFails,
      notes: [nvr.primary.why, `Weak point: ${nvr.primary.weakPoint}`, design.poeMode.reason],
    });
    if (pinnedFails) incomplete.push(`The engineer-chosen recorder ${e.nvr.model} fails ${e.failed.map((c) => c.label).join(', ')}.`);

    if (e.drivePlan.ok) {
      const c = e.drivePlan.config;
      drives = c.totalDrives;
      rawTb = c.rawTb;
      usableTb = c.usableTb;
      lines.push({
        id: `drive:${c.drive.id}`,
        category: 'drive',
        manufacturer: c.drive.manufacturer,
        model: c.drive.model,
        description: `${c.drive.marketingName} (${c.drive.capacityTb} TB${c.drive.recordingTechnology ? `, ${c.drive.recordingTechnology}` : ''})`,
        quantity: c.totalDrives,
        unit: 'each',
        datasheetUrl: c.drive.datasheetUrl,
        verifiedOn: c.drive.verifiedOn,
        priceTier: c.drive.priceTier,
        generic: false,
        isEstimate: design.storage?.isEstimate ?? false,
        flagged: c.warnings.length > 0,
        notes: [c.explanation, ...c.warnings],
      });
    } else {
      incomplete.push(`No drives listed: ${e.drivePlan.reason}`);
    }
  } else if (nvr) {
    incomplete.push('No recorder in the catalogue passes every check, so no recorder or drives are listed.');
  }
  if (nvr?.storageAdvice) incomplete.push(`${nvr.storageAdvice.message} ${nvr.storageAdvice.suggestions.join(' ')}`);

  // --- switches: one line per model, with what each unit serves ----------------
  const switchLines = new Map<string, BomLine>();
  let switchCount = 0;
  for (const g of design.switches?.groups ?? []) {
    if (g.failure) incomplete.push(`${g.failure.message} ${g.failure.fixes.join(' ')}`);
    for (const s of g.switches) {
      switchCount++;
      const m = s.evaluation.model;
      const key = `switch:${m.id}`;
      const note = `${s.groupLabel}: ${s.cameras.map((c) => c.label).join(', ')}.`;
      const estimate = s.evaluation.checks.some((c) => c.isEstimate);
      const existing = switchLines.get(key);
      if (existing) {
        switchLines.set(key, { ...existing, quantity: existing.quantity + 1, isEstimate: existing.isEstimate || estimate, notes: [...existing.notes, note] });
      } else {
        switchLines.set(key, {
          id: key,
          category: 'switch',
          manufacturer: 'Hikvision',
          model: m.model,
          description: `${m.marketingName} — ${m.poePorts} PoE ports, ${m.poeBudgetWatts} W, ${m.management}`,
          quantity: 1,
          unit: 'each',
          datasheetUrl: m.datasheetUrl,
          verifiedOn: m.verifiedOn,
          priceTier: m.priceTier,
          generic: false,
          isEstimate: estimate,
          flagged: false,
          notes: [note],
        });
      }
    }
  }
  lines.push(...switchLines.values());

  // --- cabling --------------------------------------------------------------------
  const cables = design.cables;
  if (cables) {
    const est = cables.isEstimate;
    const copperRuns = cables.cameraRuns.length + cables.copperUplinks.length;
    if (cables.packing.boxes.length > 0) {
      lines.push({
        id: 'cable:cat6-box',
        category: 'cable',
        manufacturer: null,
        model: null,
        description: `CAT6 U/UTP cable, ${cables.boxMetres} m box`,
        quantity: cables.packing.boxes.length,
        unit: 'box',
        datasheetUrl: null,
        verifiedOn: null,
        priceTier: null,
        generic: true,
        isEstimate: est,
        flagged: false,
        notes: [
          `${copperRuns} run(s), ${round1(cables.packing.totalMetres)} m to buy including waste; packed whole into boxes (first-fit decreasing) — ${cables.packing.naiveBoxCount} by total ÷ ${cables.boxMetres} m.`,
          `Offcut per box: ${cables.packing.boxes.map((b) => `${round1(b.offcutMetres)} m`).join(', ')}.`,
        ],
      });
    }
    if (cables.packing.oversize.length) {
      incomplete.push(`${cables.packing.oversize.length} run(s) are longer than a whole ${cables.boxMetres} m box and cannot be pulled as one CAT6 run.`);
    }
    if (cables.connectors > 0) {
      lines.push({
        id: 'connector:rj45',
        category: 'connector',
        manufacturer: null,
        model: null,
        description: 'RJ45 connector, CAT6',
        quantity: cables.connectors,
        unit: 'each',
        datasheetUrl: null,
        verifiedOn: null,
        priceTier: null,
        generic: true,
        isEstimate: false,
        flagged: false,
        notes: [`${project.settings.cabling.connectorsPerRun} per run × ${copperRuns} copper run(s).`],
      });
    }
    if (cables.patchCords > 0) {
      lines.push({
        id: 'patch-cord:cat6',
        category: 'patch-cord',
        manufacturer: null,
        model: null,
        description: 'CAT6 patch cord',
        quantity: cables.patchCords,
        unit: 'each',
        datasheetUrl: null,
        verifiedOn: null,
        priceTier: null,
        generic: true,
        isEstimate: false,
        flagged: false,
        notes: [`${project.settings.cabling.patchCordsPerRun} per run × ${copperRuns} copper run(s). Length not sized.`],
      });
    }
    for (const f of cables.fibreUplinks) {
      lines.push({
        id: `fibre:${f.id}`,
        category: 'fibre',
        manufacturer: null,
        model: null,
        description: `Fibre — ${f.label}`,
        quantity: round1(f.purchasedMetres),
        unit: 'm',
        datasheetUrl: null,
        verifiedOn: null,
        priceTier: null,
        generic: true,
        isEstimate: f.isEstimate,
        flagged: true,
        notes: [
          `${round1(f.installedMetres)} m installed — over the 90 m TIA-568 permanent link, so fibre, not CAT6.`,
          'Fibre type, connectors and SFP modules at both ends are not sized here; choose them for this distance.',
        ],
      });
    }
  }

  lines.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

  const locations: BomLocationSummary[] = project.locations.map((l) => {
    const calc = design.results.get(l.id)?.primary?.calculation ?? null;
    return {
      locationId: l.id,
      name: l.name,
      cameraCount: l.requirements.cameraCount,
      cameraModel: calc?.camera.model ?? null,
      lens: calc?.lens.label ?? null,
      retentionDays: l.requirements.retentionDays,
    };
  });

  return {
    projectName: project.name,
    lines,
    locations,
    totals: {
      cameras: design.instances.length,
      recorders: nvr?.primary ? 1 : 0,
      drives,
      rawTb,
      usableTb,
      requiredUsableTb: design.storage?.requiredUsableTb ?? null,
      switches: switchCount,
      cableBoxes: cables?.packing.boxes.length ?? 0,
      cableMetresToBuy: cables ? cables.packing.totalMetres : 0,
      fibreUplinks: cables?.fibreUplinks.length ?? 0,
    },
    complete: incomplete.length === 0,
    incompleteReasons: [...new Set(incomplete)],
    warnings: design.warnings,
    design,
  };
}
