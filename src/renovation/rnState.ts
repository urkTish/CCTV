/**
 * Small pure updates on the portal spine, used by the Admin screens (and
 * tested without a DOM): add / remove a line, update a room or its spec, promote
 * a drawn shape to a room, and the browser's "house library" default.
 */

import type { SitePlan } from '../domain/sitePlan.ts';
import { isClosedArea, measureShape } from './geometry.ts';
import { confirmRoomFields } from './intake.ts';
import { librarySchema, sampleLibrary, type Library } from './library.ts';
import {
  emptyPortal,
  emptySpec,
  newRenovationLine,
  newRoom,
  nextId,
  type PortalData,
  type RenovationLine,
  type Room,
  type RoomSpec,
  type ServiceLine,
} from './model.ts';

export type PortalUpdate = (fn: (p: PortalData) => PortalData) => void;

export function ensurePortal(p: PortalData | undefined): PortalData {
  return p ?? emptyPortal(['cctv']);
}

/** Add the renovation line (keeps CCTV when it is there). */
export function addRenovationLine(p: PortalData | undefined, library: Library): PortalData {
  const base = ensurePortal(p);
  return {
    ...base,
    lines: base.lines.includes('renovation') ? base.lines : [...base.lines, 'renovation'],
    renovation: base.renovation ?? newRenovationLine(library),
  };
}

/** Remove a line. A project keeps at least one line; removing CCTV only hides it (its file part is kept). */
export function removeLine(p: PortalData, line: ServiceLine): PortalData {
  const lines = p.lines.filter((l) => l !== line);
  if (lines.length === 0) return p;
  return { ...p, lines, renovation: line === 'renovation' ? null : p.renovation };
}

export function updateLine(p: PortalData, fn: (l: RenovationLine) => RenovationLine): PortalData {
  return p.renovation ? { ...p, renovation: fn(p.renovation) } : p;
}

export function updateRoom(p: PortalData, roomId: string, fn: (r: Room) => Room, confirmKeys: readonly string[] = []): PortalData {
  return { ...p, rooms: p.rooms.map((r) => (r.id === roomId ? confirmRoomFields(fn(r), confirmKeys) : r)) };
}

export function updateSpec(p: PortalData, roomId: string, fn: (s: RoomSpec) => RoomSpec): PortalData {
  return updateLine(p, (l) => {
    const existing = l.specs.find((s) => s.roomId === roomId);
    const next = fn(existing ?? emptySpec(roomId));
    return { ...l, specs: existing ? l.specs.map((s) => (s.roomId === roomId ? next : s)) : [...l.specs, next] };
  });
}

export function addRoom(p: PortalData, name?: string): { portal: PortalData; roomId: string } {
  const id = nextId('room', p.rooms.map((r) => r.id));
  const room = newRoom(id, name ?? `Room ${p.rooms.length + 1}`);
  return { portal: { ...p, rooms: [...p.rooms, room] }, roomId: id };
}

export function removeRoom(p: PortalData, roomId: string): PortalData {
  return {
    ...p,
    rooms: p.rooms.filter((r) => r.id !== roomId),
    photos: p.photos.map((ph) => (ph.roomId === roomId ? { ...ph, roomId: null } : ph)),
    renovation: p.renovation
      ? {
          ...p.renovation,
          specs: p.renovation.specs.filter((s) => s.roomId !== roomId),
          views: p.renovation.views.filter((v) => v.roomId !== roomId),
          assets: p.renovation.assets.filter((a) => p.renovation!.views.some((v) => v.id === a.viewId && v.roomId !== roomId)),
          survey: { ...p.renovation.survey, defects: p.renovation.survey.defects.filter((d) => d.roomId !== roomId) },
        }
      : null,
  };
}

/** Copy heights and finishes from the previous room ("same as previous room", spec 4.6). */
export function sameAsPrevious(p: PortalData, roomId: string): PortalData {
  const i = p.rooms.findIndex((r) => r.id === roomId);
  const prev = i > 0 ? p.rooms[i - 1] : undefined;
  if (!prev) return p;
  let next = updateRoom(p, roomId, (r) => ({ ...r, heightM: prev.heightM, surfaces: { walls: { ...prev.surfaces.walls }, floor: { ...prev.surfaces.floor }, ceiling: { ...prev.surfaces.ceiling } } }), prev.heightM !== null ? ['heightM'] : []);
  const prevSpec = p.renovation?.specs.find((s) => s.roomId === prev.id);
  if (prevSpec) next = updateSpec(next, roomId, () => ({ ...prevSpec, roomId, items: [], mustKeep: [] }));
  return next;
}

/** Closed shapes on the drawn plan, with what each measures and the room it is linked to. */
export function drawnRooms(p: PortalData | undefined, plan: SitePlan): { shapeId: string; areaM2: number; perimeterM: number; label: string; roomId: string | null }[] {
  const shapes = plan.layout?.shapes ?? [];
  let n = 0;
  return shapes.filter(isClosedArea).map((s) => {
    n += 1;
    const m = measureShape(s, plan.calibration);
    const linked = p?.rooms.find((r) => r.planShapeId === s.id) ?? null;
    return { shapeId: s.id, areaM2: m.areaM2, perimeterM: m.perimeterM, label: `Drawn area ${n} (${s.kind === 'rect' ? 'rectangle' : s.kind === 'polyline' ? 'polygon' : 'curve'}, ${s.fill === 'room' ? 'room fill' : s.fill})`, roomId: linked?.id ?? null };
  });
}

/** Promote a drawn closed shape to a new room record; its area and perimeter then come from the drawing. */
export function promoteShape(p: PortalData, shapeId: string, name: string): { portal: PortalData; roomId: string } {
  const { portal, roomId } = addRoom(p, name);
  return { portal: updateRoom(portal, roomId, (r) => ({ ...r, planShapeId: shapeId })), roomId };
}

export function linkShape(p: PortalData, roomId: string, shapeId: string | null): PortalData {
  return { ...p, rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, planShapeId: shapeId } : r.planShapeId === shapeId && shapeId !== null ? { ...r, planShapeId: null } : r)) };
}

// ---------------------------------------------------------------------------
// House library: the engineer's own library, kept in this browser as the
// default for new renovation lines. A convenience; the project file always
// carries its own copy.
// ---------------------------------------------------------------------------

const HOUSE_KEY = 'contractech-renovation.house-library';

export function loadHouseLibrary(): Library {
  try {
    const raw = globalThis.localStorage?.getItem(HOUSE_KEY);
    if (!raw) return sampleLibrary();
    const r = librarySchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : sampleLibrary();
  } catch {
    return sampleLibrary();
  }
}

export function saveHouseLibrary(lib: Library): string | null {
  try {
    globalThis.localStorage?.setItem(HOUSE_KEY, JSON.stringify(lib));
    return null;
  } catch (err) {
    return `Could not save the library in this browser (${err instanceof Error ? err.message : 'unknown error'}).`;
  }
}
