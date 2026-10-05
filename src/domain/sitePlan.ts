/**
 * Site plan: an uploaded floor/site plan image, its scale calibration, the
 * devices placed on it and the cable routes drawn between them. Pure data and
 * pure maths; the editor in `ui/` only renders and edits this.
 *
 * All positions are in IMAGE pixels, so the plan can be shown at any zoom.
 * Distances come only from the calibration: a line drawn over a known dimension
 * whose real length the engineer typed in. No calibration, no distances — the
 * cable maths then falls back to its flagged placeholder and says why.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PlanImage {
  /** `data:image/png;base64,...` or `data:image/jpeg;base64,...`. */
  readonly dataUri: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly fileName: string;
}

export interface Calibration {
  readonly a: Point;
  readonly b: Point;
  /** Real length of the line a→b, metres. */
  readonly metres: number;
}

export interface PlacedCamera {
  readonly kind: 'camera';
  readonly id: string;
  /** The phase-1 location this camera belongs to. */
  readonly locationId: string;
  /** 1-based index within that location's camera count. */
  readonly index: number;
  readonly x: number;
  readonly y: number;
  /** Direction the camera faces, degrees clockwise from "up" on the plan. */
  readonly rotationDeg: number;
  /** Device id of the switch or NVR this camera is cabled to; null = the NVR. */
  readonly connectTo: string | null;
}

export interface PlacedNvr {
  readonly kind: 'nvr';
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export interface PlacedSwitch {
  readonly kind: 'switch';
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export type PlacedDevice = PlacedCamera | PlacedNvr | PlacedSwitch;

/** A drawn cable route. Length runs from→waypoints→to, so moving a device updates it. */
export interface CableRoute {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly waypoints: readonly Point[];
}

export interface SitePlan {
  readonly image: PlanImage | null;
  readonly calibration: Calibration | null;
  readonly devices: readonly PlacedDevice[];
  readonly routes: readonly CableRoute[];
}

export const EMPTY_SITE_PLAN: SitePlan = { image: null, calibration: null, devices: [], routes: [] };

export class SitePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SitePlanError';
  }
}

// ---------------------------------------------------------------------------
// Scale maths (K2)
// ---------------------------------------------------------------------------

export function distancePx(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Metres per image pixel from a calibration line. */
export function metresPerPixel(cal: Calibration): number {
  const px = distancePx(cal.a, cal.b);
  if (!(px > 0)) throw new SitePlanError('The calibration line has zero length; draw it between two different points.');
  if (!Number.isFinite(cal.metres) || cal.metres <= 0) {
    throw new SitePlanError('The calibration length must be a positive number of metres.');
  }
  return cal.metres / px;
}

export function polylineLengthPx(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distancePx(points[i - 1]!, points[i]!);
  return total;
}

export function polylineLengthMetres(points: readonly Point[], cal: Calibration): number {
  return polylineLengthPx(points) * metresPerPixel(cal);
}

/** Straight-line distance × routing factor: the estimate for an undrawn route. */
export function estimatedRouteMetres(a: Point, b: Point, cal: Calibration, routingFactor: number): number {
  if (!Number.isFinite(routingFactor) || routingFactor < 1) {
    throw new SitePlanError(`The routing factor must be at least 1 (a cable cannot be shorter than a straight line), got ${String(routingFactor)}`);
  }
  return distancePx(a, b) * metresPerPixel(cal) * routingFactor;
}

export function deviceById(plan: SitePlan, id: string): PlacedDevice | null {
  return plan.devices.find((d) => d.id === id) ?? null;
}

/** The first placed NVR — the rack every unassigned camera is cabled back to. */
export function primaryNvr(plan: SitePlan): PlacedNvr | null {
  return plan.devices.find((d): d is PlacedNvr => d.kind === 'nvr') ?? null;
}

/** Key identifying one physical camera across the project: location + index. */
export function cameraKey(locationId: string, index: number): string {
  return `${locationId}#${index}`;
}

export type RunLengthBasis = 'drawn' | 'estimated' | 'unplaced' | 'uncalibrated';

export interface HorizontalRun {
  readonly metres: number | null;
  readonly basis: RunLengthBasis;
  readonly explanation: string;
}

/**
 * Horizontal length of the run between two placed devices: the drawn route if
 * there is one, otherwise straight line × routing factor. Null metres when the
 * plan is not calibrated.
 */
export function horizontalRunBetween(
  plan: SitePlan,
  from: PlacedDevice,
  to: PlacedDevice,
  routingFactor: number,
): HorizontalRun {
  if (!plan.calibration) {
    return { metres: null, basis: 'uncalibrated', explanation: 'The site plan is not calibrated, so no distance can be measured on it.' };
  }
  const cal = plan.calibration;
  const route = plan.routes.find(
    (r) => (r.fromId === from.id && r.toId === to.id) || (r.fromId === to.id && r.toId === from.id),
  );
  if (route) {
    const ordered = route.fromId === from.id ? route.waypoints : [...route.waypoints].reverse();
    const metres = polylineLengthMetres([from, ...ordered, to], cal);
    return {
      metres,
      basis: 'drawn',
      explanation: `Drawn route with ${route.waypoints.length} bend(s): ${metres.toFixed(1)} m at ${metresPerPixel(cal).toFixed(4)} m/px.`,
    };
  }
  const straight = distancePx(from, to) * metresPerPixel(cal);
  const metres = straight * routingFactor;
  return {
    metres,
    basis: 'estimated',
    explanation: `Estimated route: ${straight.toFixed(1)} m straight line × ${routingFactor} routing factor = ${metres.toFixed(1)} m. Draw the route for a real figure.`,
  };
}
