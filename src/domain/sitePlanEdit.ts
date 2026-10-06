/**
 * Edits to a site plan (M2–M4), as pure functions `SitePlan → SitePlan`. The map
 * editor and its keyboard/list alternative both call these, so the two paths
 * cannot drift apart, and every rule (a removed switch frees its cameras, a new
 * image invalidates the old scale...) is tested once here.
 *
 * Also the FOV-cone geometry the map draws for each camera.
 */

import {
  SitePlanError,
  deviceById,
  metresPerPixel,
  primaryNvr,
  type Calibration,
  type CableRoute,
  type PlacedCamera,
  type PlacedDevice,
  type PlanImage,
  type Point,
  type SitePlan,
} from './sitePlan.ts';
import { canvasCalibration, canvasPx, layoutOf } from './layoutShapes.ts';

/** Canvas used when no plan image is loaded: devices can still be placed and runs typed in. */
export const BLANK_CANVAS = { widthPx: 1000, heightPx: 700 } as const;

/** The plan image's size; else the drawn layout's canvas; else the blank default. */
export function canvasSize(plan: SitePlan): { readonly widthPx: number; readonly heightPx: number } {
  if (plan.image) return { widthPx: plan.image.widthPx, heightPx: plan.image.heightPx };
  const canvas = layoutOf(plan).canvas;
  return canvas ? canvasPx(canvas) : BLANK_CANVAS;
}

export function canvasCentre(plan: SitePlan): Point {
  const { widthPx, heightPx } = canvasSize(plan);
  return { x: Math.round(widthPx / 2), y: Math.round(heightPx / 2) };
}

/** First unused id of the form `${prefix}-${n}`. */
export function nextId(plan: SitePlan, prefix: string): string {
  const taken = new Set<string>([...plan.devices.map((d) => d.id), ...plan.routes.map((r) => r.id)]);
  let n = 1;
  while (taken.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** Degrees into [0, 360). */
export function normaliseDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Image and calibration
// ---------------------------------------------------------------------------

/**
 * A new image keeps the devices and drawn routes (their pixel positions may
 * still be right if it is a re-export of the same drawing) but drops the
 * calibration: the scale belongs to the old image, so it must be re-measured.
 * The UI says so.
 */
export function replaceImage(plan: SitePlan, image: PlanImage): SitePlan {
  return { ...plan, image, calibration: null };
}

/** Without the image the scale goes too — unless a drawn layout's canvas supplies it. */
export function removeImage(plan: SitePlan): SitePlan {
  const canvas = layoutOf(plan).canvas;
  return { ...plan, image: null, calibration: canvas ? canvasCalibration(canvas) : null };
}

/** Throws `SitePlanError` for a zero-length line or a non-positive length. */
export function calibrate(plan: SitePlan, cal: Calibration): SitePlan {
  metresPerPixel(cal); // validates
  return { ...plan, calibration: cal };
}

export function clearCalibration(plan: SitePlan): SitePlan {
  return { ...plan, calibration: null };
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

function clampToCanvas(plan: SitePlan, p: Point): Point {
  const { widthPx, heightPx } = canvasSize(plan);
  const clamp = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
  return { x: clamp(p.x, widthPx), y: clamp(p.y, heightPx) };
}

export function placedCamera(plan: SitePlan, locationId: string, index: number): PlacedCamera | null {
  return plan.devices.find((d): d is PlacedCamera => d.kind === 'camera' && d.locationId === locationId && d.index === index) ?? null;
}

/** Put camera `index` of a location on the plan, or move it there if it is already placed. */
export function placeCamera(plan: SitePlan, locationId: string, index: number, at: Point): SitePlan {
  const existing = placedCamera(plan, locationId, index);
  if (existing) return moveDevice(plan, existing.id, at);
  const p = clampToCanvas(plan, at);
  const cam: PlacedCamera = {
    kind: 'camera',
    id: nextId(plan, 'cam'),
    locationId,
    index,
    x: p.x,
    y: p.y,
    rotationDeg: 0,
    connectTo: null,
    runMetresOverride: null,
  };
  return { ...plan, devices: [...plan.devices, cam] };
}

export function placeNvr(plan: SitePlan, at: Point, label = 'NVR / rack'): SitePlan {
  const p = clampToCanvas(plan, at);
  return { ...plan, devices: [...plan.devices, { kind: 'nvr', id: nextId(plan, 'nvr'), label, x: p.x, y: p.y }] };
}

export function placeSwitch(plan: SitePlan, at: Point, label?: string): SitePlan {
  const id = nextId(plan, 'sw');
  const n = plan.devices.filter((d) => d.kind === 'switch').length + 1;
  const p = clampToCanvas(plan, at);
  return {
    ...plan,
    devices: [...plan.devices, { kind: 'switch', id, label: label ?? `Switch ${n}`, x: p.x, y: p.y, runMetresOverride: null }],
  };
}

function mapDevice(plan: SitePlan, id: string, f: (d: PlacedDevice) => PlacedDevice): SitePlan {
  if (!deviceById(plan, id)) throw new SitePlanError(`No device "${id}" on the plan`);
  return { ...plan, devices: plan.devices.map((d) => (d.id === id ? f(d) : d)) };
}

export function moveDevice(plan: SitePlan, id: string, to: Point): SitePlan {
  const p = clampToCanvas(plan, to);
  return mapDevice(plan, id, (d) => ({ ...d, x: p.x, y: p.y }));
}

export function rotateCamera(plan: SitePlan, id: string, rotationDeg: number): SitePlan {
  return mapDevice(plan, id, (d) => (d.kind === 'camera' ? { ...d, rotationDeg: normaliseDeg(rotationDeg) } : d));
}

export function renameDevice(plan: SitePlan, id: string, label: string): SitePlan {
  return mapDevice(plan, id, (d) => (d.kind === 'camera' ? d : { ...d, label: label.slice(0, 80) }));
}

/** Engineer-typed horizontal run (camera to endpoint, or switch uplink). null = use the plan. */
export function setRunOverride(plan: SitePlan, id: string, metres: number | null): SitePlan {
  if (metres !== null && (!Number.isFinite(metres) || metres < 0)) {
    throw new SitePlanError('A run length must be zero or more metres.');
  }
  return mapDevice(plan, id, (d) => (d.kind === 'nvr' ? d : { ...d, runMetresOverride: metres }));
}

/**
 * The device a camera is cabled to: its chosen switch, else the primary NVR.
 * Same rule as `buildTopology`, so the map and the cable maths always agree.
 */
export function endpointIdOf(plan: SitePlan, cam: PlacedCamera): string | null {
  const target = cam.connectTo ? deviceById(plan, cam.connectTo) : null;
  if (target && target.kind === 'switch') return target.id;
  return primaryNvr(plan)?.id ?? null;
}

/**
 * Cable a camera to a placed switch, or (null) back to the NVR rack — the first
 * NVR on the plan, the one recorder the design sizes. A drawn route to its old
 * endpoint no longer describes the cable, so it is removed.
 */
export function connectCamera(plan: SitePlan, cameraId: string, toId: string | null): SitePlan {
  const cam = deviceById(plan, cameraId);
  if (!cam || cam.kind !== 'camera') throw new SitePlanError(`No camera "${cameraId}" on the plan`);
  if (toId !== null) {
    const target = deviceById(plan, toId);
    if (!target || target.kind !== 'switch') throw new SitePlanError('A camera is cabled to a switch, or back to the NVR rack.');
  }
  const oldEnd = endpointIdOf(plan, cam);
  const next = mapDevice(plan, cameraId, (d) => (d.kind === 'camera' ? { ...d, connectTo: toId } : d));
  const newEnd = endpointIdOf(next, { ...cam, connectTo: toId });
  if (oldEnd === newEnd) return next;
  return { ...next, routes: next.routes.filter((r) => !isRouteBetween(r, cameraId, oldEnd)) };
}

/** Remove a device, its routes, and any camera's link to it (those fall back to the NVR). */
export function removeDevice(plan: SitePlan, id: string): SitePlan {
  if (!deviceById(plan, id)) return plan;
  return {
    ...plan,
    devices: plan.devices
      .filter((d) => d.id !== id)
      .map((d) => (d.kind === 'camera' && d.connectTo === id ? { ...d, connectTo: null } : d)),
    routes: plan.routes.filter((r) => r.fromId !== id && r.toId !== id),
  };
}

/** Drop placed cameras whose location is gone or whose index is beyond the location's count. */
export function pruneCameras(
  plan: SitePlan,
  locations: readonly { readonly id: string; readonly cameraCount: number }[],
): SitePlan {
  const counts = new Map(locations.map((l) => [l.id, l.cameraCount]));
  const orphans = plan.devices.filter((d) => d.kind === 'camera' && !(d.index <= (counts.get(d.locationId) ?? 0)));
  return orphans.reduce((p, d) => removeDevice(p, d.id), plan);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function isRouteBetween(r: CableRoute, a: string, b: string | null): boolean {
  return b !== null && ((r.fromId === a && r.toId === b) || (r.fromId === b && r.toId === a));
}

export function routeBetween(plan: SitePlan, a: string, b: string): CableRoute | null {
  return plan.routes.find((r) => isRouteBetween(r, a, b)) ?? null;
}

/** Draw (or redraw) the route between two devices; replaces any existing one. */
export function setRoute(plan: SitePlan, fromId: string, toId: string, waypoints: readonly Point[]): SitePlan {
  if (fromId === toId) throw new SitePlanError('A route needs two different devices.');
  if (!deviceById(plan, fromId) || !deviceById(plan, toId)) throw new SitePlanError('A route must join two placed devices.');
  const kept = plan.routes.filter((r) => !isRouteBetween(r, fromId, toId));
  const route: CableRoute = { id: nextId(plan, 'route'), fromId, toId, waypoints: waypoints.map((w) => clampToCanvas(plan, w)) };
  return { ...plan, routes: [...kept, route] };
}

export function removeRoute(plan: SitePlan, routeId: string): SitePlan {
  return { ...plan, routes: plan.routes.filter((r) => r.id !== routeId) };
}

// ---------------------------------------------------------------------------
// FOV cone
// ---------------------------------------------------------------------------

/**
 * The camera's horizontal field of view as a wedge on the plan: apex at the
 * camera, opening `hfovDeg` centred on `rotationDeg` (clockwise from "up",
 * matching image coordinates where y grows downwards), radius = coverage
 * distance ÷ metres-per-pixel. Returned as polygon points, apex first.
 *
 * A plan-view wedge is a simplification of the 3-D frustum: it shows the
 * direction and reach the camera was sized for, not the blind spot under it.
 */
export function fovCone(
  apex: Point,
  rotationDeg: number,
  hfovDeg: number,
  rangeMetres: number,
  metresPerPx: number,
  segments = 16,
): Point[] {
  if (!(metresPerPx > 0) || !(rangeMetres > 0) || !(hfovDeg > 0)) return [];
  const r = rangeMetres / metresPerPx;
  const half = Math.min(hfovDeg, 359.9) / 2;
  const pts: Point[] = [apex];
  for (let i = 0; i <= segments; i++) {
    const deg = rotationDeg - half + (2 * half * i) / segments;
    const rad = (deg * Math.PI) / 180;
    pts.push({ x: apex.x + r * Math.sin(rad), y: apex.y - r * Math.cos(rad) });
  }
  return pts;
}
