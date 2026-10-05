/**
 * Unit handling.
 *
 * The whole domain layer works in SI (metres, millimetres, degrees). Imperial is
 * a presentation concern only: inputs are converted on the way in, outputs on the
 * way out. Nothing downstream of here ever sees feet.
 *
 * Conversion factor: 1 international foot = 0.3048 m exactly (NIST SP 811,
 * Appendix B.8 — https://www.nist.gov/pml/special-publication-811).
 */

export const METRES_PER_FOOT = 0.3048;

export type UnitSystem = 'metric' | 'imperial';

export function feetToMetres(ft: number): number {
  return ft * METRES_PER_FOOT;
}

export function metresToFeet(m: number): number {
  return m / METRES_PER_FOOT;
}

/** px/m -> px/ft. A foot is shorter than a metre, so the number gets smaller. */
export function pxPerMetreToPxPerFoot(pxPerMetre: number): number {
  return pxPerMetre * METRES_PER_FOOT;
}

export function pxPerFootToPxPerMetre(pxPerFoot: number): number {
  return pxPerFoot / METRES_PER_FOOT;
}

/** Interpret a length the user typed in their chosen unit system, in metres. */
export function lengthToMetres(value: number, system: UnitSystem): number {
  return system === 'metric' ? value : feetToMetres(value);
}

/** Render a length held in metres back into the user's chosen unit system. */
export function lengthFromMetres(metres: number, system: UnitSystem): number {
  return system === 'metric' ? metres : metresToFeet(metres);
}

export function lengthUnitLabel(system: UnitSystem): 'm' | 'ft' {
  return system === 'metric' ? 'm' : 'ft';
}

export function areaUnitLabel(system: UnitSystem): 'm²' | 'ft²' {
  return system === 'metric' ? 'm²' : 'ft²';
}

export function densityUnitLabel(system: UnitSystem): 'px/m' | 'px/ft' {
  return system === 'metric' ? 'px/m' : 'px/ft';
}

/** m² -> ft². Squared factor, so 1 m² = 10.7639 ft². */
export function squareMetresToSquareFeet(m2: number): number {
  return m2 / (METRES_PER_FOOT * METRES_PER_FOOT);
}

export function areaFromSquareMetres(m2: number, system: UnitSystem): number {
  return system === 'metric' ? m2 : squareMetresToSquareFeet(m2);
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Round for display without pretending to precision the inputs do not have. */
export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
