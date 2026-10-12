/**
 * Renovation quantities (spec 6.3), pure. Net quantity first, then wastage,
 * then rounded UP to purchasable packs, boxes, bags and boards; both the net
 * and the purchased figure are kept, each with its trace.
 *
 * Worked examples reproduced by quantities.test.ts:
 *   walls 46.26 m², 2 coats, 10 m²/L, 5% → 9.71 L → 3 × 3.6 L (10.8 L)
 *   primer 46.26 m², 8 m²/L, 5% → 6.07 L
 *   floor 20 m², 60×60 straight 7% → 59.4 → 60 tiles → 15 boxes (21.6 m²)
 *   grout 600×600, 3 mm joint, 10 mm deep, ρ 1.6 → 0.16 kg/m² → 3.2 kg (+10%)
 *   gypsum 20 m² × 1.1 ÷ 2.88 → 7.6 → 8 boards
 *
 * The AI never feeds any of these; only library items and measured inputs do.
 */

import { roomGeometry, tiledWallArea, type PlanMeasure, type RoomGeometry } from './geometry.ts';
import { colourById, materialById, ruleOf, type Library, type Material } from './library.ts';
import {
  TILE_LAYOUT_LABEL,
  type PaintSpec,
  type PortalData,
  type PropertyType,
  type Room,
  type RoomSpec,
  type TileLayout,
  type TileSpec,
  type Trade,
} from './model.ts';
import { ceilSafe, constantOf, figure, num, type Figure, type TraceConstant } from './trace.ts';

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

export interface PaintLitres {
  readonly finish: Figure;
  readonly primer: Figure | null;
}

/** Litres = Area × Coats ÷ (spreading rate × rough factor) × (1 + waste). */
export function paintLitres(areaM2: number, spec: Pick<PaintSpec, 'coats' | 'primer' | 'roughSurface'>, product: Material | null, primer: Material | null, lib: Library): PaintLitres {
  const waste = ruleOf(lib, 'paintWaste');
  const rough = ruleOf(lib, 'roughFactor');
  const roughK = spec.roughSurface ? rough.value : 1;
  const roughText = spec.roughSurface ? ` × ${num(rough.value)}` : '';
  const one = (coats: number, prod: Material | null, ruleKey: 'emulsionSpreading' | 'primerSpreading', what: string): Figure => {
    const fromTds = prod?.spreadingM2PerL ?? null;
    const generic = ruleOf(lib, ruleKey);
    const rate = fromTds ?? generic.value;
    const constants: TraceConstant[] = [constantOf(waste)];
    if (fromTds === null) constants.push(constantOf(generic));
    else
      constants.push({
        key: `${prod?.id ?? ''}.spreading`,
        label: `${prod?.name ?? ''} spreading rate`,
        value: rate,
        unit: 'm²/L per coat',
        source: prod?.source ?? '',
        unverified: prod?.unverified ?? true,
      });
    if (spec.roughSurface) constants.push(constantOf(rough));
    const litres = ((areaM2 * coats) / (rate * roughK)) * (1 + waste.value / 100);
    return figure(
      litres,
      'L',
      `${what}: ${num(areaM2)} m² × ${coats} coat${coats === 1 ? '' : 's'} ÷ (${num(rate)} m²/L${roughText}) × ${num(1 + waste.value / 100, 3)} = ${num(litres)} L`,
      constants,
      fromTds === null ? ['No product spreading rate: the generic rule was used.'] : [],
    );
  };
  return {
    finish: one(spec.coats, product, 'emulsionSpreading', 'Finish'),
    primer: spec.primer ? one(1, primer, 'primerSpreading', 'Primer') : null,
  };
}

export interface PackChoice {
  readonly packs: readonly { readonly sizeL: number; readonly count: number }[];
  readonly totalL: number;
  readonly leftoverL: number;
  readonly figure: Figure;
}

/**
 * Packs for `litres`: every combination of the pack sizes that covers the need
 * is scored as leftover + allowance × number of packs, and the lowest wins
 * (ties: fewer packs, then less leftover). The allowance is a rule constant
 * (Unverified company rule) so a pile of 1 L tins never beats a few larger packs
 * for a few hundred millilitres of saving.
 */
export function choosePacks(litres: number, sizesL: readonly number[], lib: Library): PackChoice {
  const allowance = ruleOf(lib, 'packAllowance');
  const sizes = [...new Set(sizesL)].filter((s) => s > 0).sort((a, b) => b - a);
  if (litres <= 0 || sizes.length === 0) {
    return { packs: [], totalL: 0, leftoverL: 0, figure: figure(0, 'L', sizes.length ? 'Nothing to buy.' : 'No pack sizes in the library for this product.') };
  }
  let best: { counts: number[]; total: number; packs: number; score: number } | null = null;
  const counts = new Array<number>(sizes.length).fill(0);
  const visit = (i: number, total: number, packs: number) => {
    if (i === sizes.length) {
      if (total + 1e-9 < litres) return;
      const leftover = total - litres;
      const score = leftover + allowance.value * packs;
      if (
        !best ||
        score < best.score - 1e-9 ||
        (Math.abs(score - best.score) <= 1e-9 && (packs < best.packs || (packs === best.packs && total < best.total)))
      ) {
        best = { counts: [...counts], total, packs, score };
      }
      return;
    }
    const size = sizes[i]!;
    const max = ceilSafe(Math.max(0, litres - total) / size);
    for (let c = 0; c <= max; c++) {
      counts[i] = c;
      visit(i + 1, total + c * size, packs + c);
    }
    counts[i] = 0;
  };
  visit(0, 0, 0);
  const b = best as { counts: number[]; total: number; packs: number; score: number } | null;
  if (!b) return { packs: [], totalL: 0, leftoverL: 0, figure: figure(0, 'L', 'No combination found.') };
  const packs = sizes.map((sizeL, i) => ({ sizeL, count: b.counts[i] ?? 0 })).filter((p) => p.count > 0);
  const text = packs.map((p) => `${p.count} × ${num(p.sizeL)} L`).join(' + ');
  return {
    packs,
    totalL: b.total,
    leftoverL: b.total - litres,
    figure: figure(
      b.total,
      'L',
      `${num(litres)} L needed → ${text} = ${num(b.total)} L (leftover ${num(b.total - litres)} L); chosen for the least leftover + ${num(allowance.value)} L per pack`,
      [constantOf(allowance)],
    ),
  };
}

// ---------------------------------------------------------------------------
// Tiles, adhesive, grout
// ---------------------------------------------------------------------------

const LAYOUT_RULE: Readonly<Record<TileLayout, string>> = {
  straight: 'tileWasteStraight',
  offset: 'tileWasteOffset',
  diagonal: 'tileWasteDiagonal',
  herringbone: 'tileWasteHerringbone',
};

export interface TileQuantities {
  readonly wastePct: Figure;
  readonly tiles: Figure;
  readonly boxes: Figure | null;
  readonly adhesiveKg: Figure;
  readonly groutKgPerM2: Figure | null;
  readonly groutKg: Figure | null;
}

export function isLargeFormat(tile: Material): boolean {
  return Math.max(tile.tileLengthMm ?? 0, tile.tileWidthMm ?? 0) >= 1200;
}

export function tileQuantities(
  areaM2: number,
  tile: Material,
  spec: Pick<TileSpec, 'layout' | 'jointMm' | 'manyCutOuts'>,
  adhesive: Material | null,
  grout: Material | null,
  lib: Library,
): TileQuantities | { readonly error: string } {
  const A = tile.tileLengthMm;
  const B = tile.tileWidthMm;
  if (A === null || B === null) return { error: `${tile.name} has no tile size in the library.` };
  // Waste
  const base = ruleOf(lib, LAYOUT_RULE[spec.layout]);
  const consts: TraceConstant[] = [constantOf(base)];
  let w = base.value;
  const wParts = [`${num(base.value)}% (${TILE_LAYOUT_LABEL[spec.layout].toLowerCase()})`];
  if (spec.manyCutOuts) {
    const c = ruleOf(lib, 'tileWasteCutOuts');
    w += c.value;
    consts.push(constantOf(c));
    wParts.push(`${num(c.value)}% (many cut-outs)`);
  }
  const large = isLargeFormat(tile);
  if (large) {
    const c = ruleOf(lib, 'tileWasteLargeFormat');
    w += c.value;
    consts.push(constantOf(c));
    wParts.push(`${num(c.value)}% (large format)`);
  }
  const wastePct = figure(w, '%', `Waste = ${wParts.join(' + ')} = ${num(w)}%`, consts);
  const tileM2 = (A / 1000) * (B / 1000);
  const raw = (areaM2 * (1 + w / 100)) / tileM2;
  const tiles = figure(
    ceilSafe(raw),
    'tiles',
    `Tiles = ceil(${num(areaM2)} m² × ${num(1 + w / 100, 3)} ÷ (${num(A / 1000, 3)} × ${num(B / 1000, 3)} m²)) = ceil(${num(raw)}) = ${ceilSafe(raw)}`,
    consts,
  );
  let boxes: Figure | null = null;
  if (tile.tilesPerBox) {
    const n = ceilSafe(tiles.value / tile.tilesPerBox);
    boxes = figure(
      n,
      'boxes',
      `Boxes = ceil(${tiles.value} ÷ ${tile.tilesPerBox} per box) = ${n} (${num(n * tile.tilesPerBox * tileM2)} m²)`,
      [{ key: `${tile.id}.perBox`, label: `${tile.name} tiles per box`, value: tile.tilesPerBox, unit: 'tiles', source: tile.source, unverified: tile.unverified }],
    );
  }
  // Adhesive
  const generic = ruleOf(lib, 'adhesiveKgPerM2');
  const perM2 = adhesive?.consumptionKgPerM2 ?? generic.value;
  const aConsts: TraceConstant[] = [
    adhesive?.consumptionKgPerM2
      ? { key: `${adhesive.id}.consumption`, label: `${adhesive.name} consumption`, value: perM2, unit: 'kg/m²', source: adhesive.source, unverified: adhesive.unverified }
      : constantOf(generic),
  ];
  let adhesivePerM2 = perM2;
  let bb = '';
  if (large) {
    const extra = ruleOf(lib, 'adhesiveBackButter');
    adhesivePerM2 += extra.value;
    aConsts.push(constantOf(extra));
    bb = ` + ${num(extra.value)} (back-buttering)`;
  }
  const adhesiveKg = figure(areaM2 * adhesivePerM2, 'kg', `Adhesive = ${num(areaM2)} m² × (${num(perM2)}${bb}) kg/m² = ${num(areaM2 * adhesivePerM2)} kg`, aConsts);
  // Grout: (A + B) ÷ (A × B) × C × D × ρ   (kg/m², A B C D in mm, ρ kg/dm³)
  const D = tile.tileThicknessMm;
  let groutKgPerM2: Figure | null = null;
  let groutKg: Figure | null = null;
  if (D !== null) {
    const rhoRule = ruleOf(lib, 'groutDensity');
    const rho = grout?.densityKgPerDm3 ?? rhoRule.value;
    const C = spec.jointMm;
    const perM2g = ((A + B) / (A * B)) * C * D * rho;
    const rhoConst: TraceConstant = grout?.densityKgPerDm3
      ? { key: `${grout.id}.density`, label: `${grout.name} density`, value: rho, unit: 'kg/dm³', source: grout.source, unverified: grout.unverified }
      : constantOf(rhoRule);
    groutKgPerM2 = figure(perM2g, 'kg/m²', `Grout = (A + B) ÷ (A × B) × C × D × ρ = (${num(A)} + ${num(B)}) ÷ (${num(A)} × ${num(B)}) × ${num(C)} × ${num(D)} × ${num(rho)} = ${num(perM2g, 3)} kg/m²`, [rhoConst]);
    const gw = ruleOf(lib, 'groutWaste');
    const total = perM2g * areaM2 * (1 + gw.value / 100);
    groutKg = figure(total, 'kg', `Grout = ${num(perM2g, 3)} kg/m² × ${num(areaM2)} m² = ${num(perM2g * areaM2)} kg, × ${num(1 + gw.value / 100, 3)} waste = ${num(total)} kg`, [rhoConst, constantOf(gw)]);
  }
  return { wastePct, tiles, boxes, adhesiveKg, groutKgPerM2, groutKg };
}

// ---------------------------------------------------------------------------
// Skirting, gypsum boards, demolition
// ---------------------------------------------------------------------------

export function skirtingPieces(lengthM: number, piece: Material, lib: Library): Figure | { readonly error: string } {
  if (!piece.pieceLengthM) return { error: `${piece.name} has no piece length in the library.` };
  const w = ruleOf(lib, 'skirtingWaste');
  const raw = (lengthM * (1 + w.value / 100)) / piece.pieceLengthM;
  return figure(ceilSafe(raw), 'pieces', `Pieces = ceil(${num(lengthM)} m × ${num(1 + w.value / 100, 3)} ÷ ${num(piece.pieceLengthM)} m) = ceil(${num(raw)}) = ${ceilSafe(raw)}`, [constantOf(w)]);
}

export function gypsumBoards(areaM2: number, board: Material, lib: Library): Figure | { readonly error: string } {
  if (!board.boardLengthM || !board.boardWidthM) return { error: `${board.name} has no sheet size in the library.` };
  const w = ruleOf(lib, 'boardWaste');
  const sheet = board.boardLengthM * board.boardWidthM;
  const raw = (areaM2 * (1 + w.value / 100)) / sheet;
  return figure(ceilSafe(raw), 'boards', `Boards = ceil(${num(areaM2)} m² × ${num(1 + w.value / 100, 3)} ÷ ${num(sheet)} m²) = ceil(${num(raw)}) = ${ceilSafe(raw)}`, [constantOf(w)]);
}

/** Debris volume (m³, bulked) from stripping `areaM2` to `depthKey`. */
export function debrisVolume(areaM2: number, depthKey: 'floorStripDepth' | 'wallTileStripDepth', lib: Library): Figure {
  const d = ruleOf(lib, depthKey);
  const k = ruleOf(lib, 'debrisBulking');
  const v = areaM2 * d.value * k.value;
  return figure(v, 'm³', `Debris = ${num(areaM2)} m² × ${num(d.value)} m × ${num(k.value)} bulking = ${num(v, 3)} m³`, [constantOf(d), constantOf(k)]);
}

// ---------------------------------------------------------------------------
// Per room and per project
// ---------------------------------------------------------------------------

/** A measured quantity that becomes a BOQ line through a library rate. */
export interface WorkItem {
  readonly key: string;
  readonly roomId: string | null;
  readonly rateCode: string;
  readonly trade: Trade;
  readonly description: string;
  readonly unit: string;
  readonly quantity: Figure;
  /** For the programme: what productivity applies. */
  readonly activity: 'demolition' | 'prep' | 'paint' | 'floor-tile' | 'floor-tile-large' | 'wall-tile' | 'gypsum' | 'skirting' | 'repairs' | 'other';
  /** Paint coats incl. primer (programme: area × coats). */
  readonly coats?: number;
}

/** A material to order, aggregated across rooms before rounding to packs. */
export interface MaterialNeed {
  readonly key: string;
  readonly materialId: string;
  readonly colourId: string | null;
  readonly roomId: string;
  readonly kind: 'paint-L' | 'tiles' | 'adhesive-kg' | 'grout-kg' | 'skirting-pieces' | 'boards' | 'angle-m';
  readonly amount: Figure;
}

export interface RoomQuantities {
  readonly roomId: string;
  readonly roomName: string;
  readonly geometry: RoomGeometry | null;
  readonly items: readonly WorkItem[];
  readonly needs: readonly MaterialNeed[];
  /** Per-room paint litres and tile figures for the trace view. */
  readonly figures: readonly { readonly label: string; readonly figure: Figure }[];
  readonly warnings: readonly string[];
}

function paintDescription(spec: PaintSpec, lib: Library, where: string): string {
  const c = colourById(lib, spec.colourId);
  const p = materialById(lib, spec.productId);
  return `${where}: ${spec.primer ? '1 coat primer + ' : ''}${spec.coats} coat${spec.coats === 1 ? '' : 's'} ${p?.name ?? 'paint'}, ${spec.finish}${c ? `, ${c.name} (${c.code})` : ''}`;
}

export function roomQuantities(room: Room, spec: RoomSpec, lib: Library, propertyType: PropertyType, plan: PlanMeasure | null): RoomQuantities {
  const warnings: string[] = [];
  const items: WorkItem[] = [];
  const needs: MaterialNeed[] = [];
  const figures: { label: string; figure: Figure }[] = [];
  const g = roomGeometry(room, lib, propertyType, plan);
  if (!g.ok) return { roomId: room.id, roomName: room.name, geometry: null, items, needs, figures, warnings: [g.reason] };
  warnings.push(...g.warnings);
  const geo = g.geo;
  const R = room.id;
  const item = (w: Omit<WorkItem, 'roomId'>) => items.push({ ...w, roomId: R });
  const need = (n: Omit<MaterialNeed, 'roomId' | 'key'>) => needs.push({ ...n, roomId: R, key: `${n.kind}|${n.materialId}|${n.colourId ?? ''}` });

  // Wall tiles first: painting covers the wall above them.
  let wallTiled: Figure | null = null;
  if (spec.wallTiles) {
    const tile = materialById(lib, spec.wallTiles.materialId);
    const h = spec.wallTiles.heightM ?? geo.height.value;
    wallTiled = tiledWallArea(room, geo, h, lib);
    if (!tile) warnings.push(`${room.name}: the wall tile is not in the library.`);
    else {
      item({ key: `${R}-wall-tile`, rateCode: 'RN-WAL-TILE', trade: 'wall', unit: 'm²', quantity: wallTiled, activity: 'wall-tile', description: `Wall tiles to ${num(h)} m: ${tile.name}, ${TILE_LAYOUT_LABEL[spec.wallTiles.layout].toLowerCase()}, ${num(spec.wallTiles.jointMm)} mm joints` });
      addTiles(`${room.name} wall tiles`, wallTiled.value, tile, spec.wallTiles);
    }
  }

  function addTiles(label: string, area: number, tile: Material, ts: TileSpec) {
    const adhesive = materialById(lib, ts.adhesiveId);
    const grout = materialById(lib, ts.groutId);
    const t = tileQuantities(area, tile, ts, adhesive, grout, lib);
    if ('error' in t) {
      warnings.push(`${room.name}: ${t.error}`);
      return;
    }
    figures.push({ label: `${label}: waste`, figure: t.wastePct }, { label: `${label}: tiles`, figure: t.tiles });
    if (t.boxes) figures.push({ label: `${label}: boxes (this room alone)`, figure: t.boxes });
    figures.push({ label: `${label}: adhesive`, figure: t.adhesiveKg });
    need({ materialId: tile.id, colourId: null, kind: 'tiles', amount: t.tiles });
    need({ materialId: adhesive?.id ?? 'generic-adhesive', colourId: null, kind: 'adhesive-kg', amount: t.adhesiveKg });
    if (t.groutKgPerM2 && t.groutKg) {
      figures.push({ label: `${label}: grout per m²`, figure: t.groutKgPerM2 }, { label: `${label}: grout`, figure: t.groutKg });
      need({ materialId: grout?.id ?? 'generic-grout', colourId: null, kind: 'grout-kg', amount: t.groutKg });
    } else warnings.push(`${room.name}: ${tile.name} has no thickness, so grout cannot be calculated.`);
    if (!adhesive) warnings.push(`${room.name}: no adhesive chosen for ${label.toLowerCase()}; the generic consumption was used for the quantity.`);
  }

  // Demolition
  if (spec.removeFloor) {
    item({ key: `${R}-dem-floor`, rateCode: 'RN-DEM-FLR', trade: 'demolition', unit: 'm²', quantity: geo.floorArea, activity: 'demolition', description: 'Remove existing floor finish and bed' });
    figures.push({ label: 'Floor strip-out debris', figure: debrisVolume(geo.floorArea.value, 'floorStripDepth', lib) });
  }
  if (spec.removeWallTiles) {
    const area = wallTiled ?? geo.netWall;
    if (!wallTiled) warnings.push(`${room.name}: wall tile removal assumes the full net wall area (no new wall tile height given) — please confirm.`);
    item({ key: `${R}-dem-wall`, rateCode: 'RN-DEM-WTL', trade: 'demolition', unit: 'm²', quantity: area, activity: 'demolition', description: 'Remove existing wall tiles' });
    figures.push({ label: 'Wall tile strip-out debris', figure: debrisVolume(area.value, 'wallTileStripDepth', lib) });
  }

  // Floor
  if (spec.floorTiles) {
    const tile = materialById(lib, spec.floorTiles.materialId);
    if (!tile) warnings.push(`${room.name}: the floor tile is not in the library.`);
    else {
      item({
        key: `${R}-floor-tile`,
        rateCode: 'RN-FLR-TILE',
        trade: 'floor',
        unit: 'm²',
        quantity: geo.floorArea,
        activity: isLargeFormat(tile) ? 'floor-tile-large' : 'floor-tile',
        description: `Floor tiles: ${tile.name}, ${TILE_LAYOUT_LABEL[spec.floorTiles.layout].toLowerCase()}, ${num(spec.floorTiles.jointMm)} mm joints`,
      });
      addTiles(`${room.name} floor tiles`, geo.floorArea.value, tile, spec.floorTiles);
    }
  }
  if (spec.skirtingId) {
    const piece = materialById(lib, spec.skirtingId);
    item({ key: `${R}-skirting`, rateCode: 'RN-FLR-SKRT', trade: 'floor', unit: 'm', quantity: geo.skirting, activity: 'skirting', description: `Skirting: ${piece?.name ?? 'as specified'}` });
    if (piece) {
      const p = skirtingPieces(geo.skirting.value, piece, lib);
      if ('error' in p) warnings.push(`${room.name}: ${p.error}`);
      else {
        figures.push({ label: 'Skirting pieces', figure: p });
        need({ materialId: piece.id, colourId: null, kind: 'skirting-pieces', amount: p });
      }
    } else warnings.push(`${room.name}: the skirting is not in the library.`);
  }

  // Ceiling
  if (spec.gypsumBoardId) {
    const board = materialById(lib, spec.gypsumBoardId);
    item({ key: `${R}-gypsum`, rateCode: 'RN-CLG-GYP', trade: 'ceiling', unit: 'm²', quantity: geo.ceilingArea, activity: 'gypsum', description: `Gypsum board ceiling: ${board?.name ?? 'as specified'}` });
    if (board) {
      const b = gypsumBoards(geo.ceilingArea.value, board, lib);
      if ('error' in b) warnings.push(`${room.name}: ${b.error}`);
      else {
        figures.push({ label: 'Gypsum boards', figure: b });
        need({ materialId: board.id, colourId: null, kind: 'boards', amount: b });
        const angle = figure(geo.perimeter.value, 'm', `Perimeter angle = P = ${num(geo.perimeter.value)} m`);
        figures.push({ label: 'Perimeter angle', figure: angle });
        need({ materialId: board.id, colourId: null, kind: 'angle-m', amount: angle });
      }
    } else warnings.push(`${room.name}: the gypsum board is not in the library.`);
  }

  // Paint
  const paint = (ps: PaintSpec, area: Figure, where: 'Walls' | 'Ceiling', rateCode: string) => {
    const product = materialById(lib, ps.productId);
    if (!product) warnings.push(`${room.name}: the ${where.toLowerCase()} paint is not in the library.`);
    const primer = lib.materials.find((m) => m.category === 'primer') ?? null;
    item({ key: `${R}-paint-${where}`, rateCode, trade: 'painting', unit: 'm²', quantity: area, activity: 'paint', coats: ps.coats + (ps.primer ? 1 : 0), description: paintDescription(ps, lib, where) });
    if (ps.colourId === null) warnings.push(`${room.name}: no colour chosen for the ${where.toLowerCase()} — pick one from the library.`);
    const l = paintLitres(area.value, ps, product, primer, lib);
    figures.push({ label: `${where} paint`, figure: l.finish });
    if (product) need({ materialId: product.id, colourId: ps.colourId, kind: 'paint-L', amount: l.finish });
    if (l.primer) {
      figures.push({ label: `${where} primer`, figure: l.primer });
      if (primer) need({ materialId: primer.id, colourId: null, kind: 'paint-L', amount: l.primer });
      else warnings.push(`${room.name}: no primer in the library; primer litres are shown but cannot be packed.`);
    }
  };
  if (spec.wallPaint) {
    const area = wallTiled
      ? figure(Math.max(0, geo.netWall.value - wallTiled.value), 'm²', `Painted walls = A_w − tiled = ${num(geo.netWall.value)} − ${num(wallTiled.value)} = ${num(Math.max(0, geo.netWall.value - wallTiled.value))} m²`)
      : geo.netWall;
    if (area.value > 0) paint(spec.wallPaint, area, 'Walls', 'RN-PNT-WALL');
  }
  if (spec.ceilingPaint) paint(spec.ceilingPaint, geo.ceilingArea, 'Ceiling', 'RN-PNT-CLG');

  // Simple items, quantity typed by the engineer
  for (const s of spec.items) {
    const r = lib.rates.find((x) => x.code === s.rateCode);
    items.push({
      key: `${R}-item-${s.id}`,
      roomId: R,
      rateCode: s.rateCode,
      trade: r?.trade ?? 'fixtures',
      unit: r?.unit ?? 'no.',
      quantity: figure(s.quantity, r?.unit ?? 'no.', `${num(s.quantity)} ${r?.unit ?? 'no.'} (typed by the engineer)`),
      activity: 'other',
      description: s.description || r?.description || s.rateCode,
    });
  }
  return { roomId: R, roomName: room.name, geometry: geo, items, needs, figures, warnings };
}

export interface OrderLine {
  readonly key: string;
  readonly materialId: string;
  readonly colourId: string | null;
  readonly name: string;
  readonly colour: string | null;
  readonly kind: MaterialNeed['kind'];
  /** Sum across rooms, before rounding. */
  readonly net: Figure;
  /** What to buy, rounded up to packs / boxes / bags. */
  readonly purchase: Figure;
  /** Paint: the packs to buy, e.g. "1 × 18 L + 1 × 1 L". */
  readonly packs: string | null;
  readonly rooms: readonly string[];
}

export interface ProjectQuantities {
  readonly rooms: readonly RoomQuantities[];
  /** Project-level items: protection, skips, final clean. */
  readonly projectItems: readonly WorkItem[];
  readonly order: readonly OrderLine[];
  readonly debrisM3: Figure;
  readonly warnings: readonly string[];
}

/** Measure each room in the plan it was promoted from (null when not linked). */
export type PlanLookup = (room: Room) => PlanMeasure | null;

export function projectQuantities(portal: PortalData, planOf: PlanLookup = () => null): ProjectQuantities | null {
  const line = portal.renovation;
  if (!line) return null;
  const lib = line.library;
  const rooms = portal.rooms.map((r) => roomQuantities(r, line.specs.find((s) => s.roomId === r.id) ?? emptyRoomSpec(r.id), lib, portal.site.propertyType, planOf(r)));
  const warnings = rooms.flatMap((r) => r.warnings);

  // Aggregate needs by kind + material + colour.
  const groups = new Map<string, MaterialNeed[]>();
  for (const n of rooms.flatMap((r) => r.needs)) groups.set(n.key, [...(groups.get(n.key) ?? []), n]);
  const order: OrderLine[] = [];
  for (const [key, list] of groups) {
    const first = list[0]!;
    const mat = materialById(lib, first.materialId);
    const col = colourById(lib, first.colourId);
    const total = list.reduce((s, n) => s + n.amount.value, 0);
    const roomNames = [...new Set(list.map((n) => portal.rooms.find((r) => r.id === n.roomId)?.name ?? n.roomId))];
    const net = figure(total, first.amount.unit, `Σ rooms = ${list.map((n) => num(n.amount.value)).join(' + ')} = ${num(total)} ${first.amount.unit}`, list.flatMap((n) => n.amount.constants));
    let purchase: Figure;
    let packs: string | null = null;
    switch (first.kind) {
      case 'paint-L': {
        const c = mat ? choosePacks(total, mat.packSizesL, lib) : null;
        purchase = c ? c.figure : net;
        packs = c && c.packs.length ? c.packs.map((x) => `${x.count} × ${num(x.sizeL)} L`).join(' + ') : null;
        break;
      }
      case 'tiles': {
        const per = mat?.tilesPerBox ?? null;
        purchase = per ? figure(ceilSafe(total / per), 'boxes', `Boxes = ceil(${num(total)} tiles ÷ ${per} per box) = ${ceilSafe(total / per)}`) : net;
        break;
      }
      case 'adhesive-kg':
      case 'grout-kg': {
        const bag = mat?.bagKg ?? null;
        purchase = bag ? figure(ceilSafe(total / bag), 'bags', `Bags = ceil(${num(total)} kg ÷ ${num(bag)} kg) = ${ceilSafe(total / bag)}`) : net;
        break;
      }
      default:
        purchase = net;
    }
    order.push({
      key,
      materialId: first.materialId,
      colourId: first.colourId,
      name: mat?.name ?? (first.kind === 'adhesive-kg' ? 'Tile adhesive (generic consumption, no product chosen)' : first.kind === 'grout-kg' ? 'Grout (generic density, no product chosen)' : first.materialId),
      colour: col ? `${col.name} (${col.code})` : null,
      kind: first.kind,
      net,
      purchase,
      packs,
      rooms: roomNames,
    });
  }

  // Project-level items
  const projectItems: WorkItem[] = [];
  const anyWork = rooms.some((r) => r.items.length > 0);
  if (anyWork) {
    projectItems.push({ key: 'prj-protection', roomId: null, rateCode: 'RN-PRL-PROT', trade: 'prelims', unit: 'item', quantity: figure(1, 'item', '1 item for the project'), activity: 'other', description: 'Protection, set-up and daily clean-up' });
  }
  const debrisFigs = rooms.flatMap((r) => r.figures.filter((f) => f.label.endsWith('debris')).map((f) => f.figure));
  const debris = debrisFigs.reduce((s, f) => s + f.value, 0);
  const debrisM3 = figure(debris, 'm³', debrisFigs.length ? `Σ debris = ${debrisFigs.map((f) => num(f.value, 3)).join(' + ')} = ${num(debris, 3)} m³` : 'No strip-out.', debrisFigs.flatMap((f) => f.constants));
  if (debris > 0) {
    const cap = ruleOf(lib, 'skipCapacity');
    const n = ceilSafe(debris / cap.value);
    projectItems.push({
      key: 'prj-skips',
      roomId: null,
      rateCode: 'RN-DEM-SKIP',
      trade: 'demolition',
      unit: 'no.',
      quantity: figure(n, 'no.', `Skips = ceil(${num(debris, 3)} m³ ÷ ${num(cap.value)} m³) = ${n}`, [...debrisM3.constants, constantOf(cap)]),
      activity: 'other',
      description: 'Debris disposal: skips / truck loads',
    });
  }
  const floorArea = rooms.reduce((s, r) => s + (r.items.length && r.geometry ? r.geometry.floorArea.value : 0), 0);
  if (floorArea > 0) {
    projectItems.push({
      key: 'prj-clean',
      roomId: null,
      rateCode: 'RN-CLN-FINAL',
      trade: 'cleaning',
      unit: 'm²',
      quantity: figure(floorArea, 'm²', `Σ floor area of the rooms with works = ${num(floorArea)} m²`),
      activity: 'other',
      description: 'Final clean of the rooms with works',
    });
  }
  return { rooms, projectItems, order, debrisM3, warnings };
}

function emptyRoomSpec(roomId: string): RoomSpec {
  return { roomId, wallPaint: null, ceilingPaint: null, floorTiles: null, wallTiles: null, skirtingId: null, gypsumBoardId: null, removeFloor: false, removeWallTiles: false, items: [], mustKeep: [], lighting: '' };
}
