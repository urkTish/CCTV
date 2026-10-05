/**
 * PoE power accounting.
 *
 * ## Standards
 *
 * IEEE 802.3 defines what a port must guarantee at the *powered device*, which is
 * less than the switch must supply because of cable loss:
 *
 *   | Standard   | Common name | Max at PSE port | Guaranteed at PD |
 *   |------------|-------------|-----------------|------------------|
 *   | 802.3af    | PoE         | 15.4 W          | 12.95 W          |
 *   | 802.3at    | PoE+        | 30 W            | 25.5 W           |
 *   | 802.3bt T3 | PoE++ /T3   | 60 W            | 51 W             |
 *   | 802.3bt T4 | PoE++ /T4   | 100 W           | 71 W             |
 *
 * Those are the figures in IEEE 802.3-2022 Clause 33/145; they are also what
 * Hikvision quotes on its switch datasheets. A camera datasheet states the draw
 * *at the camera*, so switch budget must be sized on the PSE side.
 *
 * Verified 2026-10-04 against the IEEE 802.3bt overview published by the Ethernet
 * Alliance: https://ethernetalliance.org/technology/poe/
 *
 * ## Why this module exists now
 *
 * Phase 2 picks the PoE switch. It needs the total port count, the per-port class
 * and the total budget. All three come out of here, so phase 2 is a consumer, not
 * a rewrite.
 */

export const POE_SOURCE_URL = 'https://ethernetalliance.org/technology/poe/';

export type PoeStandard = '802.3af' | '802.3at' | '802.3bt-type3' | '802.3bt-type4' | 'none';

export interface PoeStandardSpec {
  readonly id: PoeStandard;
  readonly label: string;
  /** Maximum the switch port must be able to source, watts. */
  readonly maxPseWatts: number;
  /** Maximum guaranteed at the camera after worst-case cable loss, watts. */
  readonly maxPdWatts: number;
}

export const POE_STANDARDS: readonly PoeStandardSpec[] = [
  { id: '802.3af', label: 'PoE (802.3af)', maxPseWatts: 15.4, maxPdWatts: 12.95 },
  { id: '802.3at', label: 'PoE+ (802.3at)', maxPseWatts: 30, maxPdWatts: 25.5 },
  { id: '802.3bt-type3', label: 'PoE++ (802.3bt Type 3)', maxPseWatts: 60, maxPdWatts: 51 },
  { id: '802.3bt-type4', label: 'PoE++ (802.3bt Type 4)', maxPseWatts: 100, maxPdWatts: 71 },
  { id: 'none', label: 'Not PoE powered', maxPseWatts: 0, maxPdWatts: 0 },
];

const BY_ID = new Map<PoeStandard, PoeStandardSpec>(POE_STANDARDS.map((s) => [s.id, s]));

export function poeStandard(id: PoeStandard): PoeStandardSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`Unknown PoE standard: ${String(id)}`);
  return spec;
}

export interface PoeCheck {
  readonly ok: boolean;
  readonly standard: PoeStandardSpec;
  readonly cameraDrawWatts: number | null;
  readonly explanation: string;
}

/**
 * Sanity-check a camera's stated draw against the standard it claims.
 *
 * A camera whose datasheet draw exceeds the PD guarantee of its own stated
 * standard is a data-entry error, not a product — worth catching loudly.
 */
export function checkPoeDraw(id: PoeStandard, cameraDrawWatts: number | null): PoeCheck {
  const standard = poeStandard(id);
  if (id === 'none') {
    return {
      ok: true,
      standard,
      cameraDrawWatts,
      explanation: 'Model is not PoE powered; it needs a local DC or AC supply.',
    };
  }
  if (cameraDrawWatts === null) {
    return {
      ok: true,
      standard,
      cameraDrawWatts: null,
      explanation: `${standard.label}; no max draw published for this model, so budget on the ${standard.maxPseWatts} W port maximum.`,
    };
  }
  const ok = cameraDrawWatts <= standard.maxPdWatts;
  return {
    ok,
    standard,
    cameraDrawWatts,
    explanation: ok
      ? `${cameraDrawWatts} W at the camera, inside the ${standard.maxPdWatts} W that ${standard.label} guarantees. Budget ${standard.maxPseWatts} W at the switch port.`
      : `${cameraDrawWatts} W at the camera EXCEEDS the ${standard.maxPdWatts} W ${standard.label} guarantees — check the datasheet entry.`,
  };
}

export interface PoeTotals {
  readonly portCount: number;
  /** Sum of published camera draws, watts. Cameras with no figure fall back to the port maximum. */
  readonly totalCameraWatts: number;
  /** Sum of the PSE-side port maxima, watts — what the switch must be able to source. */
  readonly totalPseBudgetWatts: number;
  readonly byStandard: Readonly<Record<string, number>>;
  readonly explanation: string;
}

export interface PoeLineItem {
  readonly standard: PoeStandard;
  readonly drawWatts: number | null;
  readonly quantity: number;
}

/**
 * Total PoE load for a project. Phase 2's switch selector is a pure function of
 * this result plus the port count.
 */
export function poeTotals(items: readonly PoeLineItem[]): PoeTotals {
  let portCount = 0;
  let totalCameraWatts = 0;
  let totalPseBudgetWatts = 0;
  const byStandard: Record<string, number> = {};

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      throw new RangeError(`PoE line quantity must be a non-negative integer, got ${String(item.quantity)}`);
    }
    if (item.standard === 'none' || item.quantity === 0) continue;
    const spec = poeStandard(item.standard);
    portCount += item.quantity;
    totalCameraWatts += (item.drawWatts ?? spec.maxPdWatts) * item.quantity;
    totalPseBudgetWatts += spec.maxPseWatts * item.quantity;
    byStandard[spec.label] = (byStandard[spec.label] ?? 0) + item.quantity;
  }

  return {
    portCount,
    totalCameraWatts,
    totalPseBudgetWatts,
    byStandard,
    explanation:
      portCount === 0
        ? 'No PoE-powered cameras in this project.'
        : `${portCount} PoE port(s) drawing ${totalCameraWatts.toFixed(1)} W at the cameras. Size the switch on the ${totalPseBudgetWatts.toFixed(1)} W port-maximum budget, not the camera figure.`,
  };
}
