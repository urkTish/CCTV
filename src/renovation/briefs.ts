/**
 * The visual brief pack (spec 5.1–5.5), pure. The portal assembles fixed,
 * versioned prompt templates from the project's data; the engineer runs them
 * outside the portal (owner decision Q2: manual mode A/B) and imports the
 * results, which are paired with their before photo, labelled Illustrative and
 * recorded with their provenance.
 *
 * Templates: T0 RN-PRE (preamble), T1 RN-NARR (narrative), T2 RN-IMG-EDIT
 * (per photo), T3 CV-IMG-GEN (room without a photo), T4 RN-MOOD (mood board),
 * T5 RN-SCHED (schedule check), T8 RN-QA (visual QA). The finishes schedule
 * and the swatch sheet are produced by the portal itself — colours are never
 * AI-painted.
 */

import { colourById, materialById, type Library } from './library.ts';
import {
  BUDGET_LABEL,
  DEFECT_LABEL,
  MOOD_LABEL,
  OCCUPANCY_LABEL,
  PALETTE_LABEL,
  PROPERTY_LABEL,
  QA_CHECKS,
  ROOM_TYPE_LABEL,
  STYLE_LABEL,
  TILE_LAYOUT_LABEL,
  type PortalData,
  type RenovationLine,
  type Room,
  type RoomSpec,
  type VisualView,
} from './model.ts';
import { dataUriBytes, dataUriExt } from './photos.ts';
import { num } from './trace.ts';
import type { ZipEntry } from './zip.ts';

export const TEMPLATES = {
  T0: { id: 'RN-PRE', version: 'v1.0' },
  T1: { id: 'RN-NARR', version: 'v1.0' },
  T2: { id: 'RN-IMG-EDIT', version: 'v1.0' },
  T3: { id: 'CV-IMG-GEN', version: 'v1.0' },
  T4: { id: 'RN-MOOD', version: 'v1.0' },
  T5: { id: 'RN-SCHED', version: 'v1.0' },
  T8: { id: 'RN-QA', version: 'v1.0' },
} as const;

export const DEFAULT_MUST_NOT_SHOW: readonly string[] = [
  'People or pets',
  'Brand logos and readable text',
  'Views out of windows that are not the real view',
  'Structural changes not in scope (new openings, columns, skylights)',
];

export const FURNITURE_CAPTION = 'Furniture for illustration, not included';

// ---------------------------------------------------------------------------
// The finishes schedule (data, not creativity)
// ---------------------------------------------------------------------------

export interface ScheduleRow {
  readonly ref: string;
  readonly roomId: string;
  readonly room: string;
  readonly surface: string;
  readonly product: string;
  readonly colourName: string;
  readonly code: string;
  readonly hex: string | null;
  readonly finish: string;
  readonly size: string;
}

export function scheduleRows(portal: PortalData): ScheduleRow[] {
  const line = portal.renovation;
  if (!line) return [];
  const lib = line.library;
  const rows: ScheduleRow[] = [];
  let n = 0;
  const push = (r: Omit<ScheduleRow, 'ref'>) => {
    n += 1;
    rows.push({ ...r, ref: `F${String(n).padStart(2, '0')}` });
  };
  for (const room of portal.rooms) {
    const s = line.specs.find((x) => x.roomId === room.id);
    if (!s) continue;
    for (const [surface, p] of [
      ['Walls', s.wallPaint],
      ['Ceiling', s.ceilingPaint],
    ] as const) {
      if (!p) continue;
      const c = colourById(lib, p.colourId);
      push({ roomId: room.id, room: room.name, surface, product: materialById(lib, p.productId)?.name ?? '—', colourName: c?.name ?? 'Not chosen', code: c?.code ?? '—', hex: c?.hex ?? null, finish: p.finish, size: `${p.primer ? 'primer + ' : ''}${p.coats} coats` });
    }
    for (const [surface, t] of [
      ['Floor', s.floorTiles],
      ['Wall tiles', s.wallTiles],
    ] as const) {
      if (!t) continue;
      const m = materialById(lib, t.materialId);
      const g = materialById(lib, t.groutId);
      push({
        roomId: room.id,
        room: room.name,
        surface,
        product: m?.name ?? '—',
        colourName: g ? `Grout: ${g.name}` : '—',
        code: '—',
        hex: null,
        finish: m?.finish ?? '',
        size: `${m?.tileLengthMm && m.tileWidthMm ? `${num(m.tileWidthMm / 10)}×${num(m.tileLengthMm / 10)} cm, ` : ''}${TILE_LAYOUT_LABEL[t.layout].toLowerCase()}, ${num(t.jointMm)} mm joints${t.heightM ? `, to ${num(t.heightM)} m` : ''}`,
      });
    }
    if (s.skirtingId) push({ roomId: room.id, room: room.name, surface: 'Skirting', product: materialById(lib, s.skirtingId)?.name ?? '—', colourName: '—', code: '—', hex: null, finish: '', size: '' });
    if (s.gypsumBoardId) push({ roomId: room.id, room: room.name, surface: 'Ceiling board', product: materialById(lib, s.gypsumBoardId)?.name ?? '—', colourName: '—', code: '—', hex: null, finish: '', size: '' });
  }
  return rows;
}

/** The distinct colours in the schedule, most used first (the palette for T4 and the swatch sheet). */
export function paletteInUse(portal: PortalData): { name: string; code: string; hex: string; where: string[] }[] {
  const map = new Map<string, { name: string; code: string; hex: string; where: string[] }>();
  for (const r of scheduleRows(portal)) {
    if (!r.hex) continue;
    const e = map.get(r.code) ?? { name: r.colourName, code: r.code, hex: r.hex, where: [] };
    e.where.push(`${r.room} ${r.surface.toLowerCase()}`);
    map.set(r.code, e);
  }
  return [...map.values()].sort((a, b) => b.where.length - a.where.length);
}

/** Relative luminance, for picking legible text on a swatch. */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

export function inkOn(hex: string): '#10151c' | '#ffffff' {
  return luminance(hex) > 0.35 ? '#10151c' : '#ffffff';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A swatch sheet drawn by the portal from the library's hex values (never AI-painted). */
export function swatchSheetSvg(palette: readonly { name: string; code: string; hex: string; where: readonly string[] }[], title: string): string {
  const W = 200;
  const H = 230;
  const cols = Math.max(1, Math.min(4, palette.length));
  const rows = Math.ceil(palette.length / cols);
  const width = Math.max(cols * (W + 16) + 16, 600);
  const height = rows * (H + 16) + 70;
  const cells = palette
    .map((c, i) => {
      const x = 16 + (i % cols) * (W + 16);
      const y = 56 + Math.floor(i / cols) * (H + 16);
      return `<g><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="8" fill="#ffffff" stroke="#d4dae2"/><rect x="${x}" y="${y}" width="${W}" height="150" rx="8" fill="${c.hex}"/><rect x="${x}" y="${y + 142}" width="${W}" height="8" fill="${c.hex}"/><text x="${x + 12}" y="${y + 174}" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#10151c">${esc(c.code)}</text><text x="${x + 12}" y="${y + 194}" font-family="system-ui,sans-serif" font-size="13" fill="#3a4654">${esc(c.name)}</text><text x="${x + 12}" y="${y + 214}" font-family="system-ui,sans-serif" font-size="11" fill="#5b6878">≈ ${c.hex.toUpperCase()}</text></g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f5f6f8"/><text x="16" y="34" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="#10151c">${esc(title)}</text><text x="16" y="${height - 12}" font-family="system-ui,sans-serif" font-size="11" fill="#5b6878">Screen approximation — check the physical sample. Codes from the ContracTech library.</text>${cells}</svg>`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function preamble(portal: PortalData): string {
  const line = portal.renovation;
  const lang = line?.settings.proposalLanguage === 'ar' ? 'Arabic' : 'English';
  return [
    `[${TEMPLATES.T0.id} ${TEMPLATES.T0.version}]`,
    `You are assisting ContracTech, a contracting company, in preparing a client`,
    `proposal for ${PROPERTY_LABEL[portal.site.propertyType].toLowerCase()} works in ${line?.settings.locale ?? 'the client’s city'}.`,
    '',
    'Rules you must follow:',
    '1. Everything you produce is an ILLUSTRATIVE concept to help the client',
    '   imagine the result. Do not state or imply guarantees.',
    '2. Never invent measurements, prices, quantities, durations, product',
    '   certifications, warranty terms or building-code compliance. Use only the',
    '   facts given below. If something you need is missing, say what is missing',
    '   instead of guessing.',
    '3. Use only the materials, colours and products listed in the specification.',
    '   Refer to colours by the name and code given. Do not suggest substitutes',
    '   unless asked.',
    '4. Respect every "must keep" and "must not show" item.',
    '5. Write for a homeowner, not an engineer: warm, clear, specific, no jargon.',
    `   Language: ${lang}. If Arabic, write natural Modern Standard Arabic`,
    '   suitable for a Gulf client.',
    '6. Do not mention AI, models or prompts in the client-facing text.',
  ].join('\n');
}

function styleLine(line: RenovationLine): string {
  const s = line.style;
  if (!s.primaryStyle) return 'not chosen yet (MISSING)';
  return `${STYLE_LABEL[s.primaryStyle]}${s.secondaryStyle ? ` with a touch of ${STYLE_LABEL[s.secondaryStyle]}` : ''}`;
}

function moods(line: RenovationLine): string {
  return line.style.moods.length ? line.style.moods.map((m) => MOOD_LABEL[m]).join(', ') : 'not given (MISSING)';
}

const LIGHT: Readonly<Record<string, string>> = { warm: 'warm 2700–3000 K', neutral: 'neutral 3500–4000 K', mixed: 'mixed scenes, warm and neutral' };

function lighting(line: RenovationLine, spec: RoomSpec | undefined): string {
  return spec?.lighting.trim() || `${LIGHT[line.style.lightingMood]} (lighting mood from the style profile; no lighting specified for this room)`;
}

function furnitureRule(line: RenovationLine): string {
  if (line.style.furniture === 'keep') return 'keep the existing furniture as it is';
  if (line.style.furniture === 'unfurnished') return 'show the room unfurnished';
  return `suggest simple furniture in the same style; it is ${FURNITURE_CAPTION.toLowerCase()}`;
}

function surfaceLines(lib: Library, spec: RoomSpec | undefined): string[] {
  if (!spec) return ['- No finishes specified yet (MISSING).'];
  const out: string[] = [];
  const paint = (label: string, p: RoomSpec['wallPaint']) => {
    if (!p) return;
    const c = colourById(lib, p.colourId);
    out.push(`- ${label}: ${materialById(lib, p.productId)?.name ?? 'paint'}, ${c ? `${c.name} (${c.code}, approx. ${c.hex})` : 'colour not chosen (MISSING)'}, ${p.finish}`);
  };
  paint('Walls', spec.wallPaint);
  paint('Ceiling', spec.ceilingPaint);
  if (spec.floorTiles) {
    const m = materialById(lib, spec.floorTiles.materialId);
    out.push(`- Floor: ${m?.name ?? 'tiles'}, ${TILE_LAYOUT_LABEL[spec.floorTiles.layout].toLowerCase()}, ${num(spec.floorTiles.jointMm)} mm joints`);
  }
  if (spec.wallTiles) {
    const m = materialById(lib, spec.wallTiles.materialId);
    out.push(`- Wall tiles${spec.wallTiles.heightM ? ` to ${num(spec.wallTiles.heightM)} m` : ''}: ${m?.name ?? 'tiles'}, ${TILE_LAYOUT_LABEL[spec.wallTiles.layout].toLowerCase()}`);
  }
  if (spec.gypsumBoardId) out.push('- Ceiling: new flat gypsum board ceiling');
  if (spec.skirtingId) out.push(`- Skirting: ${materialById(lib, spec.skirtingId)?.name ?? 'as specified'}`);
  return out.length ? out : ['- No finishes specified yet (MISSING).'];
}

function existingLine(room: Room): string {
  const parts = (['walls', 'floor', 'ceiling'] as const).map((k) => {
    const s = room.surfaces[k];
    const desc = [s.existingFinish, s.existingColour].filter(Boolean).join(' in ') || 'not recorded';
    return `${k}: ${desc}${s.condition ? `, condition ${s.condition}/5` : ''}`;
  });
  return parts.join('; ');
}

function dims(room: Room): string {
  const L = room.lengthM;
  const W = room.widthM;
  const H = room.heightM;
  return `${L && W ? `about ${num(L)} × ${num(W)} m (${num(L * W)} m²)` : 'size not measured (MISSING)'}, ceiling ${H ? `${num(H)} m` : 'not measured (MISSING)'}`;
}

function fixedProblems(portal: PortalData, roomId: string): string {
  const d = portal.renovation?.survey.defects.filter((x) => x.roomId === roomId && x.action.trim()) ?? [];
  return d.length ? d.map((x) => `${DEFECT_LABEL[x.type].toLowerCase()} on the ${x.surface}`).join('; ') : 'none listed';
}

function mustKeepFor(portal: PortalData, roomId: string): string[] {
  const line = portal.renovation;
  const spec = line?.specs.find((s) => s.roomId === roomId);
  return [...(line?.style.globalMustKeep ?? []), ...(spec?.mustKeep ?? [])];
}

export function narrativePrompt(portal: PortalData): string {
  const line = portal.renovation;
  if (!line) return '';
  const s = line.style;
  const rooms = portal.rooms.map((r) => {
    const spec = line.specs.find((x) => x.roomId === r.id);
    return [
      `## ${r.name} (${ROOM_TYPE_LABEL[r.type].toLowerCase()}, ${dims(r)})`,
      `Today: ${existingLine(r)}`,
      `Problems we will fix: ${fixedProblems(portal, r.id)}`,
      'Proposed:',
      ...surfaceLines(line.library, spec),
      `- Lighting: ${lighting(line, spec)}`,
      `Must stay as it is: ${mustKeepFor(portal, r.id).join('; ') || 'nothing specified'}`,
    ].join('\n');
  });
  return [
    preamble(portal),
    '',
    `[${TEMPLATES.T1.id} ${TEMPLATES.T1.version}]`,
    'TASK',
    'Write the "Your new home" narrative for the proposal: an introduction, one',
    'short section per room, and a closing paragraph.',
    '',
    'THE CLIENT',
    `- Property: ${PROPERTY_LABEL[portal.site.propertyType].toLowerCase()}, ${OCCUPANCY_LABEL[portal.site.occupancy].toLowerCase()}.`,
    `- In their own words: ${s.clientWords.length ? s.clientWords.map((w) => `"${w}"`).join('; ') : 'none recorded'}`,
    `- Style: ${styleLine(line)}.`,
    `- They want it to feel: ${moods(line)}.`,
    `- They like: ${s.likes || 'not stated'}. They dislike: ${s.dislikes || 'not stated'}.`,
    `- Budget tier: ${s.budgetTier ? BUDGET_LABEL[s.budgetTier] : 'not stated'} (do not mention money).`,
    '',
    'ROOMS',
    ...rooms,
    '',
    'OUTPUT FORMAT',
    '# Introduction (80–120 words): the overall idea in one sentence, then how it',
    '  answers what the client asked for, quoting at most one of their phrases.',
    '# One section per room, headed with the room name (60–100 words each):',
    '  start with how the room will feel, then the two or three changes that make',
    '  the biggest difference, naming the colour and material. Mention a fixed',
    '  problem only if listed.',
    '# Closing (40–60 words): invite the client to review the visuals and samples.',
    'Then, separately, under the heading "MISSING OR UNCLEAR", list any fact you',
    'needed but did not have. Write "None" if nothing.',
  ].join('\n');
}

export function viewBriefPrompt(portal: PortalData, view: VisualView): string {
  const line = portal.renovation;
  const room = portal.rooms.find((r) => r.id === view.roomId);
  if (!line || !room) return '';
  const spec = line.specs.find((x) => x.roomId === room.id);
  const lib = line.library;
  const visible = new Set(view.visibleSurfaces);
  const changes: string[] = [];
  const paint = (key: 'walls' | 'ceiling', p: RoomSpec['wallPaint']) => {
    if (!p || !visible.has(key)) return;
    const c = colourById(lib, p.colourId);
    const ex = room.surfaces[key];
    changes.push(`- ${key === 'walls' ? 'Walls' : 'Ceiling'}: from ${[ex.existingFinish, ex.existingColour].filter(Boolean).join(' ') || 'the current finish'} to ${materialById(lib, p.productId)?.name ?? 'paint'}, colour ${c ? `${c.name} (approx. ${c.hex})` : 'NOT CHOSEN'}, ${p.finish} finish.`);
  };
  paint('walls', spec?.wallPaint ?? null);
  paint('ceiling', spec?.ceilingPaint ?? null);
  if (spec?.floorTiles && visible.has('floor')) {
    const m = materialById(lib, spec.floorTiles.materialId);
    const ex = room.surfaces.floor;
    changes.push(`- Floor: from ${[ex.existingFinish, ex.existingColour].filter(Boolean).join(' ') || 'the current floor'} to ${m?.name ?? 'tiles'}, ${TILE_LAYOUT_LABEL[spec.floorTiles.layout].toLowerCase()}, ${num(spec.floorTiles.jointMm)} mm joints.`);
  }
  if (spec?.wallTiles && visible.has('walls')) changes.push(`- Wall tiles${spec.wallTiles.heightM ? ` to ${num(spec.wallTiles.heightM)} m` : ''}: ${materialById(lib, spec.wallTiles.materialId)?.name ?? 'tiles'}.`);
  if (spec?.gypsumBoardId && visible.has('ceiling')) changes.push('- Ceiling: new flat gypsum board ceiling.');
  if (!changes.length) changes.push('- No proposed finish is visible in this photo (check the visible surfaces).');
  return [
    preamble(portal),
    '',
    `[${TEMPLATES.T2.id} ${TEMPLATES.T2.version}] view ${view.id}`,
    'TASK',
    'Write an image-editing instruction for a photo-editing image model. The model',
    'will receive the attached BEFORE photo and must return the SAME room, from the',
    'SAME camera position, after renovation. Your instruction must be specific,',
    'visual and short (max 180 words), followed by a separate list of things to',
    'preserve and a list of things to avoid.',
    '',
    'THE PHOTO',
    `Room: ${room.name} (${ROOM_TYPE_LABEL[room.type].toLowerCase()}), ${dims(room)}.`,
    `Camera: ${view.facing || 'not recorded'}; ${view.cameraNotes || 'phone photo, eye level'}.`,
    `Visible in this photo: surfaces ${view.visibleSurfaces.join(', ') || 'not marked'}.`,
    `Lighting state wanted: ${view.timeOfDay === 'evening' ? 'evening with the lights on' : 'daytime'}.`,
    '',
    'CHANGES TO SHOW (only those visible in this photo)',
    ...changes,
    `- Lighting: ${lighting(line, spec)}.`,
    `- Furniture: ${furnitureRule(line)}.`,
    `- Defects to remove: ${fixedProblems(portal, room.id)}.`,
    `- Overall style and mood: ${styleLine(line)}, feeling ${moods(line)}.`,
    '',
    'PRESERVE EXACTLY',
    '- Camera position, lens, perspective and framing.',
    '- Room geometry: walls, ceiling height, door and window positions and sizes.',
    ...mustKeepFor(portal, room.id).map((m) => `- ${m}`),
    '',
    'AVOID',
    ...DEFAULT_MUST_NOT_SHOW.map((m) => `- ${m}`),
    '- Adding windows, doors, columns, skylights or changing the view outside.',
    '- Text, logos, watermarks, people.',
    '',
    'OUTPUT FORMAT',
    'EDIT INSTRUCTION: <one paragraph>',
    'PRESERVE: <bullets>',
    'AVOID: <bullets>',
    '',
    '— Step 2 (image model): send the BEFORE photo with the EDIT INSTRUCTION,',
    '  PRESERVE and AVOID text. Ask for the same aspect ratio and resolution class,',
    `  2–4 variants. Save each result as after/${view.id}-v1.jpg, ${view.id}-v2.jpg …`,
  ].join('\n');
}

export function planBriefPrompt(portal: PortalData, room: Room): string {
  const line = portal.renovation;
  if (!line) return '';
  const spec = line.specs.find((x) => x.roomId === room.id);
  return [
    preamble(portal),
    '',
    `[${TEMPLATES.T3.id} ${TEMPLATES.T3.version}] room ${room.id}`,
    'TASK',
    'Write a text-to-image prompt (max 160 words) for an interior architectural',
    'visualisation of this room after renovation. There is no photograph of it.',
    '',
    'SPACE',
    `${room.name}: ${dims(room)}, floor ${room.floor || 'not stated'}.`,
    `Openings: ${room.openings.map((o) => `${o.type} ${num(o.widthM)} × ${num(o.heightM)} m${o.wall ? ` on the ${o.wall} wall` : ''}`).join('; ') || 'not recorded (MISSING)'}.`,
    'Viewpoint: standing at the entrance door, eye level 1.6 m, natural lens',
    '(approx. 24–28 mm full-frame equivalent), no fisheye.',
    'Finishes:',
    ...surfaceLines(line.library, spec),
    `Lighting: ${lighting(line, spec)}; time: daytime.`,
    `Style and mood: ${styleLine(line)}, ${moods(line)}; regional context ${line.settings.locale}.`,
    '',
    'OUTPUT FORMAT',
    'PROMPT: <one paragraph, photographic architectural style, realistic',
    'proportions matching the dimensions>',
    'NEGATIVE: <bullets: people, text, logos, distorted proportions, extra openings>',
    'NOTE FOR ENGINEER: <any dimension or detail that was ambiguous>',
    '',
    'The portal prints this visual as "Concept visualisation — not based on a photograph of your site".',
  ].join('\n');
}

export function moodBoardPrompt(portal: PortalData): string {
  const line = portal.renovation;
  if (!line) return '';
  const palette = paletteInUse(portal);
  const materials = [...new Set(line.specs.flatMap((s) => [s.floorTiles?.materialId, s.wallTiles?.materialId].filter((x): x is string => !!x)))].map((id) => materialById(line.library, id)).filter((m) => m !== null);
  return [
    preamble(portal),
    '',
    `[${TEMPLATES.T4.id} ${TEMPLATES.T4.version}]`,
    'TASK',
    'Compose a one-page mood board for the whole home.',
    '',
    'INPUTS',
    `Style: ${styleLine(line)}; mood ${moods(line)}.`,
    `Palette card the client chose: ${line.style.palette ? PALETTE_LABEL[line.style.palette] : 'none'}.`,
    'Palette (use only these, in this order of dominance):',
    ...(palette.length ? palette.map((c) => `- ${c.name} ${c.code} (approx. ${c.hex}, LRV not recorded) — used on ${c.where.join(', ')}`) : ['- No colours specified yet (MISSING)']),
    'Materials (use only these):',
    ...(materials.length ? materials.map((m) => `- ${m.name}, ${m.finish || 'finish not stated'}, sample photo materials/${m.id}.jpg (if supplied)`) : ['- None specified yet']),
    `Lighting: ${LIGHT[line.style.lightingMood]}.`,
    `Client inspiration notes: ${line.style.likes || 'none'}; avoid ${line.style.dislikes || 'nothing stated'}.`,
    '',
    'OUTPUT FORMAT',
    '1. TITLE: 3–6 words naming the concept.',
    '2. CONCEPT LINE: one sentence.',
    '3. LAYOUT: a 3 × 3 grid. For each cell: cell number, content type (colour',
    '   swatch / material sample photo by fileRef / lighting mood image brief /',
    '   furniture or fixture image brief), and a caption of max 8 words. Colour',
    '   swatches must quote name and code exactly.',
    '4. PROPORTION BAR: the palette as percentages of visible surface.',
    '',
    'The portal renders the colour swatches itself (swatches.svg) — do not paint them.',
  ].join('\n');
}

export function schedulePrompt(portal: PortalData): string {
  const line = portal.renovation;
  if (!line) return '';
  const rows = scheduleRows(portal);
  return [
    preamble(portal),
    '',
    `[${TEMPLATES.T5.id} ${TEMPLATES.T5.version}]`,
    'TASK',
    'Review this finishes schedule for consistency and write a one-line client',
    'caption for each row. Do not change any code, product or quantity.',
    '',
    'SCHEDULE',
    '| Ref | Room | Surface | Material / product | Colour name | Code | Finish | Size / pattern |',
    ...rows.map((r) => `| ${r.ref} | ${r.room} | ${r.surface} | ${r.product} | ${r.colourName} | ${r.code} | ${r.finish} | ${r.size} |`),
    '',
    `Style intent: ${styleLine(line)}, mood ${moods(line)}.`,
    '',
    'OUTPUT FORMAT',
    'CAPTIONS: a table with columns Ref | Caption (max 12 words).',
    'CONSISTENCY NOTES: bullets for anything that looks inconsistent with the',
    'style intent or with other rows. For each note, say which rows and why.',
    'Write "None" if none. (These notes are for the engineer only.)',
  ].join('\n');
}

export function qaPrompt(portal: PortalData, view: VisualView): string {
  const line = portal.renovation;
  const room = portal.rooms.find((r) => r.id === view.roomId);
  if (!line || !room) return '';
  const spec = line.specs.find((x) => x.roomId === room.id);
  const checks = QA_CHECKS.map((c, i) => `${i + 1}. ${c}.`);
  return [
    preamble(portal),
    '',
    `[${TEMPLATES.T8.id} ${TEMPLATES.T8.version}] view ${view.id}`,
    'TASK',
    'Compare the BEFORE photo and the generated AFTER image (both attached).',
    'Answer each check with PASS, FAIL or UNSURE and a short reason:',
    ...checks,
    `Must keep: ${mustKeepFor(portal, room.id).join('; ') || 'nothing specified'}.`,
    `Must not show: ${DEFAULT_MUST_NOT_SHOW.join('; ')}.`,
    'Proposed finishes in view:',
    ...surfaceLines(line.library, spec),
    `Room size for the realism check: ${dims(room)}.`,
    'Finally: RECOMMEND = USE / REGENERATE / NEEDS ENGINEER LOOK, and if REGENERATE,',
    'one sentence to add to the edit instruction.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// The pack
// ---------------------------------------------------------------------------

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'room';
}

export interface PackManifest {
  readonly format: 'contractech-renovation-brief-pack';
  readonly v: 1;
  readonly projectName: string;
  readonly createdOn: string;
  readonly templates: Readonly<Record<string, string>>;
  readonly views: readonly { viewId: string; room: string; beforeFile: string; briefFile: string; expectedResults: string }[];
  readonly planBriefs: readonly { room: string; briefFile: string }[];
}

export function buildBriefPack(portal: PortalData, projectName: string, today: string): { entries: ZipEntry[]; manifest: PackManifest } {
  const line = portal.renovation;
  const entries: ZipEntry[] = [];
  if (!line) return { entries, manifest: { format: 'contractech-renovation-brief-pack', v: 1, projectName, createdOn: today, templates: {}, views: [], planBriefs: [] } };
  entries.push({ name: '00-preamble-RN-PRE.txt', data: preamble(portal) });
  entries.push({ name: '01-narrative-RN-NARR.txt', data: narrativePrompt(portal) });
  entries.push({ name: '02-mood-board-RN-MOOD.txt', data: moodBoardPrompt(portal) });
  entries.push({ name: '03-schedule-check-RN-SCHED.txt', data: schedulePrompt(portal) });
  entries.push({ name: 'swatches.svg', data: swatchSheetSvg(paletteInUse(portal), `${projectName} — colour schedule`) });
  const views: PackManifest['views'][number][] = [];
  for (const v of line.views) {
    const room = portal.rooms.find((r) => r.id === v.roomId);
    const photo = portal.photos.find((p) => p.id === v.photoId);
    if (!room || !photo) continue;
    const base = `${v.id}-${slug(room.name)}`;
    const beforeFile = `before/${v.id}.${dataUriExt(photo.dataUri)}`;
    entries.push({ name: beforeFile, data: dataUriBytes(photo.dataUri) });
    entries.push({ name: `views/${base}-RN-IMG-EDIT.txt`, data: viewBriefPrompt(portal, v) });
    entries.push({ name: `qa/${base}-RN-QA.txt`, data: qaPrompt(portal, v) });
    views.push({ viewId: v.id, room: room.name, beforeFile, briefFile: `views/${base}-RN-IMG-EDIT.txt`, expectedResults: `after/${v.id}-v1.jpg (and -v2, -v3 …)` });
  }
  const viewRooms = new Set(line.views.map((v) => v.roomId));
  const planBriefs: PackManifest['planBriefs'][number][] = [];
  for (const r of portal.rooms.filter((x) => !viewRooms.has(x.id) && line.specs.some((s) => s.roomId === x.id))) {
    const f = `views/${slug(r.name)}-CV-IMG-GEN.txt`;
    entries.push({ name: f, data: planBriefPrompt(portal, r) });
    planBriefs.push({ room: r.name, briefFile: f });
  }
  const manifest: PackManifest = {
    format: 'contractech-renovation-brief-pack',
    v: 1,
    projectName,
    createdOn: today,
    templates: Object.fromEntries(Object.values(TEMPLATES).map((t) => [t.id, t.version])),
    views,
    planBriefs,
  };
  entries.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
  entries.unshift({ name: 'README.txt', data: readme(projectName, today, views.length, planBriefs.length) });
  return { entries, manifest };
}

function readme(projectName: string, today: string, views: number, plans: number): string {
  return [
    `ContracTech — visual brief pack for "${projectName}" (${today})`,
    '',
    'This pack was assembled by the ContracTech portal. Nothing was sent anywhere:',
    'run the prompts yourself and import the results back into the portal.',
    '',
    '1. Paste 01-narrative-RN-NARR.txt into Claude. Paste the answer back in',
    '   Admin → Renovation → Visuals → Narrative, then review it.',
    `2. For each of the ${views} photo view(s): paste views/<view>-RN-IMG-EDIT.txt into`,
    '   Claude with the photo from before/. Send the EDIT INSTRUCTION, PRESERVE and',
    '   AVOID text and the same photo to the image-editing tool.',
    '   Save each result as after/<view id>-v1.jpg, -v2.jpg … (e.g. view-1-v1.jpg).',
    '3. Optional: run qa/<view>-RN-QA.txt with the before and after images, and',
    '   record PASS / FAIL / UNSURE in the portal’s QA checklist.',
    `4. ${plans} room(s) have no photo: views/<room>-CV-IMG-GEN.txt gives a concept`,
    '   prompt; such visuals are printed as "Concept visualisation".',
    '5. 02-mood-board and 03-schedule-check are for the mood board captions and the',
    '   engineer’s consistency check. swatches.svg is drawn by the portal from the',
    '   library and is the colour reference — never use an AI-painted swatch.',
    '6. In the portal: Visuals → Import after images, select every file in after/.',
    '   Each is paired with its before photo by its file name.',
    '',
    'Every after image is labelled "Illustrative" by the portal on import, and the',
    'exact prompt, provider, model and date are recorded with it (provenance).',
    'Client photos: handle under the client’s consent; do not use them for',
    'training or marketing without separate consent.',
  ].join('\n');
}

/** Pair an imported file with a view by its name: "view-3-v2.jpg", "after_view-3.png" … */
export function viewFromFileName(fileName: string, viewIds: readonly string[]): { viewId: string; variant: number } | null {
  const m = /(view-\d+)(?:[-_ ]?v(\d+))?/i.exec(fileName);
  if (!m) return null;
  const id = m[1]!.toLowerCase();
  if (!viewIds.includes(id)) return null;
  return { viewId: id, variant: m[2] ? Math.max(1, Math.min(99, parseInt(m[2], 10))) : 1 };
}
