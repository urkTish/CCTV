/**
 * NVR recommendation (I2–I4).
 *
 * Same shape as the camera engine: hard checks first — each reported pass/fail
 * with its margin — then score and rank the survivors, explain every pick with
 * a reason and an honest weak point, list every rejection with its reason, and
 * never return nothing silently.
 *
 * The storage ↔ recorder compatibility check is the drive-configuration search
 * in `storagePlan.ts`, run against each recorder's own bays, per-bay maximum and
 * RAID support.
 */

import type { Hdd, Nvr } from '../data/products.ts';
import type { NvrAnalytic, VideoOutputResolution } from '../data/productSchemas.ts';
import type { PriceTier } from '../data/shared.ts';
import { NVR_ANALYTIC_LABELS, type NvrFormFactorPreference } from '../domain/designSettings.ts';
import { poeStandard, type PoeStandard } from '../domain/power.ts';
import { RAID_LABELS, type RaidLevel, type StorageRequirement } from '../domain/storage.ts';
import { planDrives, type DrivePlan } from './storagePlan.ts';
import { NVR_WEIGHTS } from './weights.ts';

export interface PoeLoad {
  readonly standard: PoeStandard;
  /** Published draw at the camera, W, or null (then the standard's PD maximum is used). */
  readonly drawWatts: number | null;
}

export interface NvrRequirement {
  readonly cameraCount: number;
  readonly channelHeadroomPercent: number;
  /** Sum of camera PEAK bitrates, Mbps — what the recorder must be able to ingest. */
  readonly incomingMbps: number;
  readonly maxCameraMegapixels: number;
  readonly storage: StorageRequirement;
  readonly raidLevel: RaidLevel;
  readonly hotSpare: boolean;
  /** 'built-in': these cameras are powered from the recorder's own PoE ports. */
  readonly poeMode: 'built-in' | 'external';
  readonly builtInPoeLoads: readonly PoeLoad[];
  readonly poeHeadroomPercent: number;
  readonly analytics: readonly NvrAnalytic[];
  readonly monitors: number;
  readonly outputResolution: VideoOutputResolution;
  readonly formFactor: NvrFormFactorPreference;
  readonly redundantPsu: boolean;
  readonly budgetTier: PriceTier | 'any';
  /** Engineer-chosen recorder. It is evaluated and shown even if it fails a check. */
  readonly pinnedNvrId: string | null;
}

export type NvrCheckId =
  | 'channels'
  | 'bandwidth'
  | 'resolution'
  | 'storage'
  | 'raid'
  | 'poe-ports'
  | 'poe-budget'
  | 'poe-standard'
  | 'analytics'
  | 'outputs'
  | 'output-resolution'
  | 'form-factor'
  | 'redundancy';

export interface NvrCheck {
  readonly id: NvrCheckId;
  readonly label: string;
  readonly verdict: 'pass' | 'fail' | 'info';
  readonly required: string;
  readonly offered: string;
  /** Plain-language margin: "+3 channels", "−40 W". */
  readonly margin: string;
}

export interface NvrEvaluation {
  readonly nvr: Nvr;
  readonly checks: readonly NvrCheck[];
  readonly failed: readonly NvrCheck[];
  readonly drivePlan: DrivePlan;
  readonly score: number;
}

export type NvrTradeOff =
  | 'primary recommendation'
  | 'chosen by engineer'
  | 'budget option'
  | 'more storage expansion'
  | 'more channel headroom'
  | 'closest alternative';

export interface NvrRecommendation {
  readonly evaluation: NvrEvaluation;
  readonly label: NvrTradeOff;
  readonly why: string;
  readonly weakPoint: string;
}

export interface StorageAdvice {
  readonly message: string;
  readonly suggestions: readonly string[];
}

export interface NvrResult {
  readonly channelsNeeded: number;
  readonly primary: NvrRecommendation | null;
  readonly alternatives: readonly NvrRecommendation[];
  readonly rejections: readonly { readonly nvr: Nvr; readonly reasons: readonly string[] }[];
  /** Only when `primary` is null. */
  readonly nearMisses: readonly NvrEvaluation[];
  /** Only when `primary` is null. */
  readonly suggestedFixes: readonly string[];
  /** Set whenever the storage does not fit (no primary, or every recorder fails storage). */
  readonly storageAdvice: StorageAdvice | null;
  readonly notices: readonly string[];
}

// ---------------------------------------------------------------------------

const POE_RANK: Readonly<Record<PoeStandard, number>> = {
  none: 0,
  '802.3af': 1,
  '802.3at': 2,
  '802.3bt-type3': 3,
  '802.3bt-type4': 4,
};
const OUTPUT_RANK: Readonly<Record<VideoOutputResolution, number>> = { '1080p': 1, '4K': 2, '8K': 3 };
const TIER_RANK: Readonly<Record<PriceTier, number>> = { economy: 0, standard: 1, premium: 2 };

export function channelsNeeded(cameraCount: number, headroomPercent: number): number {
  // Round the headroom up: 13 cameras + 25 % = 16.25 → 17 channels.
  return Math.ceil(cameraCount * (1 + headroomPercent / 100) - 1e-9);
}

function signed(n: number, unit: string, digits = 0): string {
  const v = n.toFixed(digits);
  return `${n >= 0 ? '+' : '−'}${v.replace('-', '')} ${unit}`.trim();
}

function poeLoadWatts(loads: readonly PoeLoad[]): number {
  return loads.reduce((s, l) => s + (l.drawWatts ?? poeStandard(l.standard).maxPdWatts), 0);
}

function formFactorOk(nvr: Nvr, pref: NvrFormFactorPreference): boolean {
  if (pref === 'any') return true;
  if (pref === 'rack') return nvr.rackWidth19in;
  return nvr.formFactor === pref;
}

export function evaluateNvr(nvr: Nvr, req: NvrRequirement, drives: readonly Hdd[]): NvrEvaluation {
  const checks: NvrCheck[] = [];
  const need = channelsNeeded(req.cameraCount, req.channelHeadroomPercent);

  checks.push({
    id: 'channels',
    label: 'Channels',
    verdict: nvr.channels >= need ? 'pass' : 'fail',
    required: `${need} (${req.cameraCount} cameras + ${req.channelHeadroomPercent}% headroom)`,
    offered: `${nvr.channels}`,
    margin: signed(nvr.channels - need, 'channels'),
  });

  checks.push({
    id: 'bandwidth',
    label: 'Incoming bandwidth',
    verdict: nvr.incomingBandwidthMbps >= req.incomingMbps ? 'pass' : 'fail',
    required: `${req.incomingMbps.toFixed(1)} Mbps (sum of camera peak bitrates)`,
    offered: `${nvr.incomingBandwidthMbps} Mbps`,
    margin: signed(nvr.incomingBandwidthMbps - req.incomingMbps, 'Mbps', 1),
  });

  checks.push({
    id: 'resolution',
    label: 'Recording resolution',
    verdict: nvr.maxRecordingResolutionMp >= req.maxCameraMegapixels ? 'pass' : 'fail',
    required: `${req.maxCameraMegapixels} MP (highest camera in the project)`,
    offered: `up to ${nvr.maxRecordingResolutionMp} MP`,
    margin: signed(nvr.maxRecordingResolutionMp - req.maxCameraMegapixels, 'MP'),
  });

  const raidSupported = req.raidLevel === 'none' || nvr.raidLevels.includes(req.raidLevel);
  const spareSupported = !req.hotSpare || nvr.hotSpare;
  checks.push({
    id: 'raid',
    label: 'RAID',
    verdict: raidSupported && spareSupported ? 'pass' : 'fail',
    required: `${RAID_LABELS[req.raidLevel]}${req.hotSpare ? ' + hot spare' : ''}`,
    offered: nvr.raidLevels.length ? `RAID ${nvr.raidLevels.join('/')}${nvr.hotSpare ? ', hot spare' : ''}` : 'No RAID',
    margin: raidSupported && spareSupported ? 'supported' : 'not supported',
  });

  const drivePlan: DrivePlan =
    raidSupported && spareSupported
      ? planDrives({
          requiredUsableTb: req.storage.requiredUsableTb,
          level: req.raidLevel,
          hotSpare: req.hotSpare,
          bays: nvr.sataBays,
          maxPerBayTb: nvr.maxHddCapacityTb,
          drives,
        })
      : { ok: false, reason: `${RAID_LABELS[req.raidLevel]} is not supported by this recorder.`, maxUsableTb: 0, excludedDrives: [] };
  checks.push({
    id: 'storage',
    label: 'Storage (bays × capacity)',
    verdict: drivePlan.ok ? 'pass' : 'fail',
    required: `${req.storage.requiredUsableTb.toFixed(2)} TB usable`,
    offered: drivePlan.ok
      ? `${drivePlan.config.totalDrives} × ${drivePlan.config.drive.capacityTb} TB = ${drivePlan.config.usableTb} TB usable (${nvr.sataBays} bays, ≤ ${nvr.maxHddCapacityTb} TB each)`
      : `max ${drivePlan.maxUsableTb.toFixed(1)} TB usable (${nvr.sataBays} bays, ≤ ${nvr.maxHddCapacityTb} TB each)`,
    margin: drivePlan.ok
      ? `${signed(drivePlan.config.usableTb - req.storage.requiredUsableTb, 'TB', 2)}, ${nvr.sataBays - drivePlan.config.totalDrives} bay(s) free`
      : signed(drivePlan.maxUsableTb - req.storage.requiredUsableTb, 'TB', 2),
  });

  if (req.poeMode === 'built-in') {
    const ports = req.builtInPoeLoads.length;
    checks.push({
      id: 'poe-ports',
      label: 'Built-in PoE ports',
      verdict: nvr.poePorts >= ports ? 'pass' : 'fail',
      required: `${ports} PoE camera(s) on the recorder`,
      offered: `${nvr.poePorts} ports`,
      margin: signed(nvr.poePorts - ports, 'ports'),
    });
    const load = poeLoadWatts(req.builtInPoeLoads);
    const withHeadroom = load * (1 + req.poeHeadroomPercent / 100);
    const budget = nvr.poeBudgetWatts ?? 0;
    checks.push({
      id: 'poe-budget',
      label: 'PoE budget',
      verdict: budget >= withHeadroom && nvr.poePorts > 0 ? 'pass' : 'fail',
      required: `${withHeadroom.toFixed(1)} W (${load.toFixed(1)} W draw + ${req.poeHeadroomPercent}%)`,
      offered: nvr.poeBudgetWatts === null ? 'no PoE' : `${budget} W`,
      margin: signed(budget - withHeadroom, 'W', 1),
    });
    const maxCam = req.builtInPoeLoads.reduce((m, l) => Math.max(m, POE_RANK[l.standard]), 0);
    const maxPort = nvr.poeStandards.reduce((m, s) => Math.max(m, POE_RANK[s]), 0);
    const neededStd = (Object.keys(POE_RANK) as PoeStandard[]).find((k) => POE_RANK[k] === maxCam) ?? 'none';
    checks.push({
      id: 'poe-standard',
      label: 'PoE standard per port',
      verdict: maxPort >= maxCam ? 'pass' : 'fail',
      required: maxCam === 0 ? 'none' : poeStandard(neededStd).label,
      offered: nvr.poeStandards.length ? nvr.poeStandards.join(', ') : 'no PoE',
      margin: maxPort >= maxCam ? 'covers every camera' : 'a camera needs a higher PoE class than the ports give',
    });
  } else {
    checks.push({
      id: 'poe-ports',
      label: 'Built-in PoE',
      verdict: 'info',
      required: 'not used — cameras are powered by external PoE switches',
      offered: nvr.poePorts ? `${nvr.poePorts} ports (unused)` : 'none',
      margin: 'n/a',
    });
  }

  const missing = req.analytics.filter((a) => !nvr.analytics.includes(a));
  checks.push({
    id: 'analytics',
    label: 'Recorder analytics',
    verdict: missing.length === 0 ? 'pass' : 'fail',
    required: req.analytics.length ? req.analytics.map((a) => NVR_ANALYTIC_LABELS[a]).join(', ') : 'none',
    offered: nvr.analytics.length ? nvr.analytics.map((a) => NVR_ANALYTIC_LABELS[a]).join(', ') : 'none listed',
    margin: missing.length ? `missing ${missing.map((a) => NVR_ANALYTIC_LABELS[a]).join(', ')}` : 'all present',
  });

  // HDMI only: on most units VGA mirrors HDMI 1 rather than driving a separate
  // monitor (ASSUMPTIONS 10.2), so counting it would over-promise.
  checks.push({
    id: 'outputs',
    label: 'Monitor outputs',
    verdict: nvr.hdmiOutputs >= req.monitors ? 'pass' : 'fail',
    required: `${req.monitors} independent monitor(s)`,
    offered: `${nvr.hdmiOutputs} HDMI${nvr.vgaOutputs ? ` (+${nvr.vgaOutputs} VGA)` : ''}`,
    margin: signed(nvr.hdmiOutputs - req.monitors, 'outputs'),
  });

  const outRank = nvr.maxHdmiResolution ? OUTPUT_RANK[nvr.maxHdmiResolution] : 0;
  checks.push({
    id: 'output-resolution',
    label: 'Output resolution',
    verdict: req.monitors === 0 || outRank >= OUTPUT_RANK[req.outputResolution] ? 'pass' : 'fail',
    required: req.monitors === 0 ? 'no monitor' : req.outputResolution,
    offered: nvr.maxHdmiResolution ?? 'Not specified',
    margin: outRank >= OUTPUT_RANK[req.outputResolution] ? 'meets it' : 'too low',
  });

  checks.push({
    id: 'form-factor',
    label: 'Form factor',
    verdict: formFactorOk(nvr, req.formFactor) ? 'pass' : 'fail',
    required: req.formFactor === 'any' ? 'any' : req.formFactor === 'rack' ? '19-inch rackmount' : req.formFactor,
    offered: `${nvr.formFactor}${nvr.rackWidth19in ? ' (19-inch rack)' : ''}`,
    margin: formFactorOk(nvr, req.formFactor) ? 'matches' : 'does not match',
  });

  checks.push({
    id: 'redundancy',
    label: 'Redundant power supply',
    verdict: !req.redundantPsu || nvr.redundantPsu ? 'pass' : 'fail',
    required: req.redundantPsu ? 'required' : 'not required',
    offered: nvr.redundantPsu ? 'yes' : 'no',
    margin: !req.redundantPsu || nvr.redundantPsu ? 'ok' : 'missing',
  });

  const failed = checks.filter((c) => c.verdict === 'fail');
  return { nvr, checks, failed, drivePlan, score: scoreNvr(nvr, req, need, drivePlan) };
}

/** Score in 0..1 from the weights in `weights.ts`. Only meaningful for recorders that pass. */
function scoreNvr(nvr: Nvr, req: NvrRequirement, need: number, plan: DrivePlan): number {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  // 1 when the channel count matches the need exactly; falls as it is oversized.
  const fit = need > 0 ? clamp(need / nvr.channels) : 1;
  // Full marks at 30 % or more bandwidth headroom.
  const bw = req.incomingMbps > 0 ? clamp((nvr.incomingBandwidthMbps / req.incomingMbps - 1) / 0.3) : 1;
  const expansion = plan.ok ? clamp((nvr.sataBays - plan.config.totalDrives) / nvr.sataBays) : 0;
  const tier = TIER_RANK[nvr.priceTier];
  let budget: number;
  if (req.budgetTier === 'any') budget = [1, 0.7, 0.4][tier] ?? 0.4;
  else {
    const want = TIER_RANK[req.budgetTier];
    budget = tier === want ? 1 : tier < want ? 0.8 : 0.2;
  }
  return (
    NVR_WEIGHTS.channelFit * fit +
    NVR_WEIGHTS.bandwidthHeadroom * bw +
    NVR_WEIGHTS.storageExpansion * expansion +
    NVR_WEIGHTS.budget * budget
  );
}

function marginOf(e: NvrEvaluation, id: NvrCheckId): string | null {
  return e.checks.find((c) => c.id === id)?.margin ?? null;
}

function why(e: NvrEvaluation, req: NvrRequirement): string {
  const n = e.nvr;
  const parts = [
    `${n.channels} channels for ${req.cameraCount} camera(s)`,
    `${n.incomingBandwidthMbps} Mbps incoming against ${req.incomingMbps.toFixed(1)} Mbps needed`,
  ];
  if (e.drivePlan.ok) {
    const c = e.drivePlan.config;
    parts.push(`storage fits as ${c.totalDrives} × ${c.drive.capacityTb} TB (${c.usableTb} TB usable) with ${n.sataBays - c.totalDrives} bay(s) to spare`);
  }
  if (req.poeMode === 'built-in') parts.push(`powers the cameras from its own ${n.poePorts} PoE ports (${n.poeBudgetWatts ?? 0} W)`);
  return `${n.model}: ${parts.join('; ')}.`;
}

function weakPoint(e: NvrEvaluation, req: NvrRequirement): string {
  const n = e.nvr;
  const notes: string[] = [];
  const bwHeadroom = req.incomingMbps > 0 ? n.incomingBandwidthMbps / req.incomingMbps - 1 : 1;
  if (bwHeadroom < 0.2) notes.push(`only ${Math.round(bwHeadroom * 100)}% bandwidth headroom (${marginOf(e, 'bandwidth')})`);
  if (e.drivePlan.ok && e.drivePlan.config.totalDrives === n.sataBays) notes.push('every drive bay is used, so retention cannot grow without replacing drives');
  if (n.raidLevels.length === 0) notes.push('no RAID: a failed drive loses the recordings on it');
  if (req.poeMode === 'built-in') {
    const budget = e.checks.find((c) => c.id === 'poe-budget');
    if (budget) notes.push(`PoE budget margin ${budget.margin}`);
  }
  if (!n.rackWidth19in) notes.push('desktop chassis, not 19-inch rack width');
  if (n.channels - channelsNeeded(req.cameraCount, req.channelHeadroomPercent) === 0) notes.push('no channels spare beyond the headroom');
  return notes.length ? `${notes[0]!.charAt(0).toUpperCase()}${notes[0]!.slice(1)}${notes.length > 1 ? `; also ${notes.slice(1).join('; ')}` : ''}.` : 'No significant weak point against these requirements; check the datasheet notes.';
}

function storageAdvice(
  req: NvrRequirement,
  evaluations: readonly NvrEvaluation[],
  nvrs: readonly Nvr[],
  /** The recorder the advice is about (a chosen one); default: the largest in the catalogue. */
  focus?: NvrEvaluation,
): StorageAdvice {
  const largest = focus ?? evaluations.reduce<NvrEvaluation | null>((best, e) => {
    const cap = e.drivePlan.ok ? e.drivePlan.config.usableTb : e.drivePlan.maxUsableTb;
    const bestCap = best ? (best.drivePlan.ok ? best.drivePlan.config.usableTb : best.drivePlan.maxUsableTb) : -1;
    return cap > bestCap ? e : best;
  }, null);
  const maxTb = largest ? (largest.drivePlan.ok ? largest.drivePlan.config.usableTb : largest.drivePlan.maxUsableTb) : 0;
  const scale = req.storage.requiredUsableTb > 0 ? maxTb / req.storage.requiredUsableTb : 1;
  const storageFitters = evaluations.filter((e) => e.drivePlan.ok).map((e) => e.nvr.model);
  const suggestions: string[] = [];
  if (storageFitters.length) {
    suggestions.push(`A larger recorder: ${storageFitters.slice(0, 3).join(', ')} can hold this storage (check their other results).`);
  } else {
    suggestions.push(`A larger recorder: no recorder in the catalogue (${nvrs.length} models) holds ${req.storage.requiredUsableTb.toFixed(1)} TB at ${RAID_LABELS[req.raidLevel]}; split the cameras across two recorders.`);
  }
  if (scale > 0 && scale < 1) {
    suggestions.push(
      `Fewer retention days: the largest configuration of ${focus ? 'the chosen recorder' : 'any recorder'} (${largest?.nvr.model ?? 'n/a'}, ${maxTb.toFixed(1)} TB usable) holds about ${Math.floor(scale * 100)}% of the requirement — cut every location's retention to that share (e.g. 30 days → ${Math.floor(30 * scale)} days).`,
    );
  }
  suggestions.push('Lower bitrate: switch to H.265+, lower the frame rate, or record on motion only.');
  if (req.raidLevel !== 'none') suggestions.push(`Drop to a RAID level with less overhead than ${RAID_LABELS[req.raidLevel]}, or no RAID.`);
  return {
    message: `Storage does not fit: ${req.storage.requiredUsableTb.toFixed(2)} TB usable is needed.`,
    suggestions,
  };
}

const FIX_FOR: Readonly<Record<NvrCheckId, string>> = {
  channels: 'Split the cameras across two recorders, or lower the channel headroom.',
  bandwidth: 'Reduce incoming bandwidth (H.265+, lower frame rate) or split across two recorders.',
  resolution: 'Choose lower-resolution cameras, or accept recording below the cameras’ full resolution.',
  storage: 'See the storage advice: a larger recorder, fewer retention days or a lower bitrate.',
  raid: 'Turn RAID or the hot spare off, or accept a premium RAID recorder.',
  'poe-ports': 'Set PoE to "external switch" so the cameras are powered by a PoE switch.',
  'poe-budget': 'Set PoE to "external switch", or lower the PoE headroom.',
  'poe-standard': 'Power the high-draw cameras from an 802.3bt (Hi-PoE) switch port.',
  analytics: 'Untick recorder analytics the cameras already perform themselves.',
  outputs: 'Use fewer monitors, or a separate decoder for a video wall.',
  'output-resolution': 'Accept 1080p output, or choose a 4K/8K-output recorder.',
  'form-factor': 'Relax the form-factor preference.',
  redundancy: 'Drop the redundant-PSU requirement, or accept a premium recorder.',
};

export function recommendNvr(req: NvrRequirement, nvrs: readonly Nvr[], drives: readonly Hdd[]): NvrResult {
  const need = channelsNeeded(req.cameraCount, req.channelHeadroomPercent);
  const evaluations = nvrs.map((n) => evaluateNvr(n, req, drives));
  const passing = evaluations.filter((e) => e.failed.length === 0).sort((a, b) => b.score - a.score || a.nvr.channels - b.nvr.channels);
  const rejections = evaluations
    .filter((e) => e.failed.length > 0)
    .map((e) => ({ nvr: e.nvr, reasons: e.failed.map((c) => `${c.label}: needs ${c.required}, has ${c.offered}`) }));
  const notices: string[] = [];

  const storageFailsEverywhere = evaluations.every((e) => !e.drivePlan.ok);

  // --- an engineer-chosen recorder ------------------------------------------
  const pinned = req.pinnedNvrId ? evaluations.find((e) => e.nvr.id === req.pinnedNvrId) : undefined;
  if (req.pinnedNvrId && !pinned) {
    notices.push(`The chosen recorder "${req.pinnedNvrId}" is not in the catalogue any more; the engine picked one instead.`);
  }
  if (pinned) {
    const failedText = pinned.failed.map((c) => `${c.label} (needs ${c.required}, has ${c.offered})`).join('; ');
    const primary: NvrRecommendation = {
      evaluation: pinned,
      label: 'chosen by engineer',
      why: `Chosen by the engineer. ${why(pinned, req)}`,
      weakPoint: pinned.failed.length ? `FAILS: ${failedText}.` : weakPoint(pinned, req),
    };
    if (pinned.failed.length) notices.push(`The chosen recorder ${pinned.nvr.model} fails ${pinned.failed.length} check(s): ${failedText}.`);
    const alternatives = passing
      .filter((e) => e.nvr.id !== pinned.nvr.id)
      .slice(0, 3)
      .map<NvrRecommendation>((e, i) => ({
        evaluation: e,
        label: i === 0 ? 'primary recommendation' : 'closest alternative',
        why: why(e, req),
        weakPoint: weakPoint(e, req),
      }));
    return {
      channelsNeeded: need,
      primary,
      alternatives,
      rejections,
      nearMisses: [],
      suggestedFixes: pinned.failed.map((c) => FIX_FOR[c.id]),
      storageAdvice: pinned.drivePlan.ok ? null : storageAdvice(req, evaluations, nvrs, pinned),
      notices,
    };
  }

  const top = passing[0];

  if (!top) {
    const counts = new Map<NvrCheckId, number>();
    for (const e of evaluations) for (const c of e.failed) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    const binding = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const nearMisses = [...evaluations].sort((a, b) => a.failed.length - b.failed.length || b.score - a.score).slice(0, 3);
    const nearIds = new Set(nearMisses.flatMap((e) => e.failed.map((c) => c.id)));
    const fixes = [...new Set([...binding.filter((id) => nearIds.has(id)), ...binding])].slice(0, 4).map((id) => FIX_FOR[id]);
    return {
      channelsNeeded: need,
      primary: null,
      alternatives: [],
      rejections,
      nearMisses,
      suggestedFixes: fixes,
      storageAdvice: nearIds.has('storage') || storageFailsEverywhere ? storageAdvice(req, evaluations, nvrs) : null,
      notices,
    };
  }

  const primary: NvrRecommendation = { evaluation: top, label: 'primary recommendation', why: why(top, req), weakPoint: weakPoint(top, req) };
  const rest = passing.slice(1);
  const used = new Set<string>([top.nvr.id]);
  const alternatives: NvrRecommendation[] = [];
  const take = (label: NvrTradeOff, pick: NvrEvaluation | undefined) => {
    if (!pick || used.has(pick.nvr.id) || alternatives.length >= 3) return;
    used.add(pick.nvr.id);
    alternatives.push({ evaluation: pick, label, why: why(pick, req), weakPoint: weakPoint(pick, req) });
  };
  const cheaper = rest.filter((e) => TIER_RANK[e.nvr.priceTier] < TIER_RANK[top.nvr.priceTier]);
  take('budget option', cheaper[0]);
  const freeBays = (e: NvrEvaluation) => (e.drivePlan.ok ? e.nvr.sataBays - e.drivePlan.config.totalDrives : 0);
  take('more storage expansion', [...rest].filter((e) => freeBays(e) > freeBays(top)).sort((a, b) => freeBays(b) - freeBays(a))[0]);
  take('more channel headroom', [...rest].filter((e) => e.nvr.channels > top.nvr.channels).sort((a, b) => b.score - a.score)[0]);
  for (const e of rest) take('closest alternative', e);

  return { channelsNeeded: need, primary, alternatives, rejections, nearMisses: [], suggestedFixes: [], storageAdvice: null, notices };
}
