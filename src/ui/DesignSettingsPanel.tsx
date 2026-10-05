/**
 * Project-wide design inputs (brief items 1–5), one panel per Admin section:
 * recording and storage with the recorder, PoE switching, and cabling. Every
 * field has a default; the ones that are engineering allowances rather than
 * sourced figures carry an Unverified badge with the reason
 * (`ESTIMATED_DEFAULTS`). The choices an engineer makes on every job come first;
 * margins and allowances sit under an Advanced disclosure that counts how many
 * differ from their defaults. Camera power (PoE mode) and the recorder form
 * factor are the client's options and stay primary.
 *
 * Values are clamped to the same ranges the URL/file schemas accept, so an
 * out-of-range keystroke can never produce a link that will not reopen.
 */

import type { ReactNode } from 'react';


import { nvrs } from '../data/products.ts';
import type { NvrAnalytic, VideoOutputResolution } from '../data/productSchemas.ts';
import {
  DEFAULT_DESIGN_SETTINGS,
  ESTIMATED_DEFAULTS,
  NVR_ANALYTIC_LABELS,
  type DesignSettings,
  type NvrFormFactorPreference,
  type PoeMode,
  type SwitchManagementPreference,
  type UplinkPreference,
} from '../domain/designSettings.ts';
import { RAID_LABELS, RAID_LEVELS, type RaidLevel, type RecordingMode } from '../domain/storage.ts';
import { lengthFromMetres, lengthToMetres, lengthUnitLabel, round } from '../domain/units.ts';
import { countChanged } from '../state/locationFields.ts';
import type { UnitSystemState } from '../state/projectTypes.ts';
import { Advanced, Card, CheckboxField, EstimateBadge, NumberField, SelectField } from './primitives.tsx';

const ANALYTICS = Object.keys(NVR_ANALYTIC_LABELS) as NvrAnalytic[];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function Estimated({ reason, children }: { reason: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-end">
        <EstimateBadge title={reason} />
      </div>
      {children}
    </div>
  );
}

interface SettingsProps {
  settings: DesignSettings;
  units: UnitSystemState;
  onChange: (next: DesignSettings) => void;
}

/** Commit only finite numbers, clamped to the schema range. */
function numberSetter(min: number, max: number, set: (v: number) => void, integer = false) {
  return (v: number) => {
    if (!Number.isFinite(v)) return;
    const c = clamp(v, min, max);
    set(integer ? Math.round(c) : c);
  };
}

const FORM_FACTOR_OPTIONS: readonly { value: NvrFormFactorPreference; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'rack', label: '19-inch rackmount (any height)' },
  { value: '1U', label: '1U' },
  { value: '1.5U', label: '1.5U' },
  { value: '2U', label: '2U' },
];

const POE_MODE_OPTIONS: readonly { value: PoeMode; label: string }[] = [
  { value: 'auto', label: 'Auto (brief rule)' },
  { value: 'built-in', label: 'NVR built-in PoE ports' },
  { value: 'external', label: 'External PoE switch' },
];

/** Recording, storage and the recorder (Admin → Recording & storage). */
export function RecordingSettings({
  settings,
  onChange,
  inheritedAnalytics,
  clientChoice,
}: SettingsProps & {
  /** What the recorder would inherit from the cameras, shown when not overridden. */
  inheritedAnalytics: readonly NvrAnalytic[];
  /** The client's own answers from an intake, shown next to the two client options. */
  clientChoice?: { formFactor: string; poe: string } | null;
}) {
  const { storage, recorder } = settings;
  const setStorage = (p: Partial<DesignSettings['storage']>) => onChange({ ...settings, storage: { ...storage, ...p } });
  const setSchedule = (p: Partial<DesignSettings['storage']['schedule']>) => setStorage({ schedule: { ...storage.schedule, ...p } });
  const setRecorder = (p: Partial<DesignSettings['recorder']>) => onChange({ ...settings, recorder: { ...recorder, ...p } });
  const n = numberSetter;
  const analytics = recorder.analytics ?? inheritedAnalytics;
  const D = DEFAULT_DESIGN_SETTINGS;
  const advanced =
    countChanged(storage, D.storage, ['headroomPercent', 'formattingOverheadPercent']) +
    countChanged(recorder, D.recorder, ['channelHeadroomPercent', 'outputResolution', 'redundantPsu']) +
    (recorder.analytics === null ? 0 : 1);
  const clientNote = (text: string | undefined) =>
    text ? <p className="mt-1 text-xs font-medium text-[var(--color-accent)]">Client&rsquo;s answer in the intake: {text}</p> : undefined;

  return (
    <Card title="Recording settings" subtitle="Project-wide. Defaults give a result straight away; refine them here.">
      <div className="grid gap-3">
        <SelectField<RecordingMode>
          label="Recording mode"
          helper="Continuous records 24 h; motion-only records the share of the day with motion; scheduled records set hours."
          value={storage.schedule.mode}
          options={[
            { value: 'continuous', label: 'Continuous' },
            { value: 'motion-only', label: 'Motion only' },
            { value: 'scheduled', label: 'Scheduled hours per day' },
          ]}
          onChange={(mode) => setSchedule({ mode })}
        />
        {storage.schedule.mode === 'motion-only' && (
          <Estimated reason={ESTIMATED_DEFAULTS.motionDutyPercent}>
            <NumberField
              label="Share of the day with motion"
              unit="%"
              helper="Depends entirely on the site; measure it on an existing system if you can."
              value={storage.schedule.motionDutyPercent}
              min={1}
              max={100}
              step={5}
              onChange={n(0.1, 100, (motionDutyPercent) => setSchedule({ motionDutyPercent }))}
            />
          </Estimated>
        )}
        {storage.schedule.mode === 'scheduled' && (
          <NumberField
            label="Recording hours per day"
            unit="h"
            helper="Hours of recording in each 24 h."
            value={storage.schedule.scheduledHoursPerDay}
            min={1}
            max={24}
            step={1}
            onChange={n(0.1, 24, (scheduledHoursPerDay) => setSchedule({ scheduledHoursPerDay }))}
          />
        )}
        <SelectField<RaidLevel>
          label="RAID level"
          helper="Only some recorder series support RAID; the recorder check enforces it."
          value={storage.raidLevel}
          options={RAID_LEVELS.map((l) => ({ value: l, label: RAID_LABELS[l] }))}
          onChange={(raidLevel) => setStorage({ raidLevel, hotSpare: raidLevel === 'none' ? false : storage.hotSpare })}
        />
        {storage.raidLevel !== 'none' && (
          <CheckboxField
            label="Hot spare"
            helper="One extra drive that rebuilds the array automatically after a failure."
            checked={storage.hotSpare}
            onChange={(hotSpare) => setStorage({ hotSpare })}
          />
        )}
        <SelectField<PoeMode>
          label="Camera power"
          helper="Auto: built-in PoE when ≤ 16 channels and every camera is within 90 m of cable from the NVR, otherwise an external switch."
          value={recorder.poeMode}
          options={POE_MODE_OPTIONS}
          onChange={(poeMode) => setRecorder({ poeMode })}
          flag={clientNote(clientChoice?.poe)}
        />
        <SelectField<NvrFormFactorPreference>
          label="Form factor"
          helper="Desktop chassis, or 19-inch rackmount."
          value={recorder.formFactor}
          options={FORM_FACTOR_OPTIONS}
          onChange={(formFactor) => setRecorder({ formFactor })}
          flag={clientNote(clientChoice?.formFactor)}
        />
        <NumberField
          label="Monitors"
          helper="Independent HDMI outputs needed at the recorder."
          value={recorder.monitors}
          min={0}
          max={16}
          step={1}
          onChange={n(0, 16, (monitors) => setRecorder({ monitors }), true)}
        />
        <SelectField<string>
          label="Recorder model"
          helper="Let the engine choose, or pin a model: it is then checked and shown even if it fails a check."
          value={recorder.pinnedNvrId ?? ''}
          options={[{ value: '', label: 'Let the engine choose' }, ...nvrs.map((x) => ({ value: x.id, label: `${x.model} (${x.channels} ch)` }))]}
          onChange={(id) => setRecorder({ pinnedNvrId: id === '' ? null : id })}
        />
      </div>

      <Advanced changed={advanced}>
        <NumberField
          label="Growth headroom"
          unit="%"
          helper="Added on top of the recorded data."
          value={storage.headroomPercent}
          min={0}
          max={500}
          step={5}
          onChange={n(0, 500, (headroomPercent) => setStorage({ headroomPercent }))}
        />
        <Estimated reason={ESTIMATED_DEFAULTS.formattingOverheadPercent}>
          <NumberField
            label="Formatting overhead"
            unit="%"
            helper="Capacity lost between the sold size and what the recorder can write."
            value={storage.formattingOverheadPercent}
            min={0}
            max={49}
            step={0.5}
            onChange={n(0, 49, (formattingOverheadPercent) => setStorage({ formattingOverheadPercent }))}
          />
        </Estimated>
        <NumberField
          label="Channel headroom"
          unit="%"
          helper="Spare channels on top of today's cameras, rounded up."
          value={recorder.channelHeadroomPercent}
          min={0}
          max={500}
          step={5}
          onChange={n(0, 500, (channelHeadroomPercent) => setRecorder({ channelHeadroomPercent }))}
        />
        <SelectField<VideoOutputResolution>
          label="Monitor resolution"
          helper="Highest output resolution the monitors need."
          value={recorder.outputResolution}
          options={[
            { value: '1080p', label: '1080p' },
            { value: '4K', label: '4K' },
            { value: '8K', label: '8K' },
          ]}
          onChange={(outputResolution) => setRecorder({ outputResolution })}
        />
        <CheckboxField
          label="Redundant power supply"
          helper="Dual PSU — premium recorders only."
          checked={recorder.redundantPsu}
          onChange={(redundantPsu) => setRecorder({ redundantPsu })}
        />
        <CheckboxField
          label="Choose recorder analytics manually"
          helper={
            recorder.analytics === null
              ? `Inherited from the cameras' analytics: ${inheritedAnalytics.length ? inheritedAnalytics.map((a) => NVR_ANALYTIC_LABELS[a]).join(', ') : 'none'}.`
              : 'Untick to inherit them from the cameras again.'
          }
          checked={recorder.analytics !== null}
          onChange={(manual) => setRecorder({ analytics: manual ? [...inheritedAnalytics] : null })}
        />
        {recorder.analytics !== null &&
          ANALYTICS.map((a) => (
            <CheckboxField
              key={a}
              label={NVR_ANALYTIC_LABELS[a]}
              helper="Required at the recorder."
              checked={analytics.includes(a)}
              onChange={(on) => setRecorder({ analytics: on ? [...analytics, a].sort() : analytics.filter((x) => x !== a) })}
            />
          ))}
      </Advanced>
    </Card>
  );
}

/** PoE switching (Admin → Network). */
export function SwitchSettings({ settings, onChange }: SettingsProps) {
  const { switches } = settings;
  const setSwitches = (p: Partial<DesignSettings['switches']>) => onChange({ ...settings, switches: { ...switches, ...p } });
  const n = numberSetter;
  const advanced = countChanged(switches, DEFAULT_DESIGN_SETTINGS.switches, ['poeHeadroomPercent', 'sparePortsPercent']);
  return (
    <Card title="Switch settings" subtitle="Project-wide.">
      <div className="grid gap-3">
        <SelectField<SwitchManagementPreference>
          label="Management"
          helper="Auto: unmanaged for ≤ 8 cameras on the economy tier, managed otherwise."
          value={switches.management}
          options={[
            { value: 'auto', label: 'Auto (brief rule)' },
            { value: 'unmanaged', label: 'Unmanaged' },
            { value: 'managed', label: 'Managed' },
          ]}
          onChange={(management) => setSwitches({ management })}
        />
        <SelectField<UplinkPreference>
          label="Uplink"
          helper="Auto: SFP fibre where the uplink is over 90 m, otherwise either."
          value={switches.uplink}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'copper', label: 'Copper GbE' },
            { value: 'sfp', label: 'SFP fibre' },
          ]}
          onChange={(uplink) => setSwitches({ uplink })}
        />
      </div>
      <Advanced changed={advanced}>
        <NumberField
          label="PoE budget headroom"
          unit="%"
          helper="Added on top of the summed camera draw."
          value={switches.poeHeadroomPercent}
          min={0}
          max={500}
          step={5}
          onChange={n(0, 500, (poeHeadroomPercent) => setSwitches({ poeHeadroomPercent }))}
        />
        <NumberField
          label="Spare ports"
          unit="%"
          helper="Free PoE ports kept on every switch, rounded up."
          value={switches.sparePortsPercent}
          min={0}
          max={500}
          step={5}
          onChange={n(0, 500, (sparePortsPercent) => setSwitches({ sparePortsPercent }))}
        />
      </Advanced>
    </Card>
  );
}

/** CAT6 allowances (Admin → Cabling). All of them are rarely changed. */
export function CablingSettings({ settings, units, onChange }: SettingsProps) {
  const { cabling } = settings;
  const u = lengthUnitLabel(units);
  const shown = (m: number) => round(lengthFromMetres(m, units), 2);
  const setCabling = (p: Partial<DesignSettings['cabling']>) => onChange({ ...settings, cabling: { ...cabling, ...p } });
  const n = numberSetter;
  const len = (min: number, max: number, set: (m: number) => void) => (v: number) => {
    if (!Number.isFinite(v)) return;
    set(clamp(lengthToMetres(v, units), min, max));
  };
  const changed = countChanged(cabling, DEFAULT_DESIGN_SETTINGS.cabling, [
    'rackDropMetres',
    'serviceLoopMetres',
    'wastePercent',
    'boxMetres',
    'connectorsPerRun',
    'patchCordsPerRun',
    'routingFactor',
    'unplacedRunMetres',
  ]);
  return (
    <Card title="Cable allowances" subtitle="Slack, waste, drops and the routing factor. Project-wide.">
      <Advanced changed={changed} label="Allowances" defaultOpen={changed > 0}>
        <Estimated reason={ESTIMATED_DEFAULTS.rackDropMetres}>
          <NumberField label="Ceiling-to-rack drop" unit={u} helper="At the switch / NVR end of every run." value={shown(cabling.rackDropMetres)} min={0} onChange={len(0, 50, (rackDropMetres) => setCabling({ rackDropMetres }))} />
        </Estimated>
        <NumberField label="Service loop per run" unit={u} helper="Termination and service slack." value={shown(cabling.serviceLoopMetres)} min={0} onChange={len(0, 50, (serviceLoopMetres) => setCabling({ serviceLoopMetres }))} />
        <NumberField label="Waste allowance" unit="%" helper="Purchasing allowance on every run (not used for the 90 m check)." value={cabling.wastePercent} min={0} max={100} step={1} onChange={n(0, 100, (wastePercent) => setCabling({ wastePercent }))} />
        <NumberField label="Cable box length" unit="m" helper="305 m (1000 ft) is the standard pull box." value={cabling.boxMetres} min={1} step={1} onChange={n(1, 10_000, (boxMetres) => setCabling({ boxMetres }))} />
        <NumberField label="RJ45 connectors per run" helper="2 = one at each end." value={cabling.connectorsPerRun} min={0} max={10} step={1} onChange={n(0, 10, (connectorsPerRun) => setCabling({ connectorsPerRun }), true)} />
        <NumberField label="Patch cords per run" helper="At the switch / NVR end." value={cabling.patchCordsPerRun} min={0} max={10} step={1} onChange={n(0, 10, (patchCordsPerRun) => setCabling({ patchCordsPerRun }), true)} />
        <Estimated reason={ESTIMATED_DEFAULTS.routingFactor}>
          <NumberField label="Routing factor" helper="Straight line × this for a placed camera with no drawn route." value={cabling.routingFactor} min={1} max={5} step={0.05} onChange={n(1, 5, (routingFactor) => setCabling({ routingFactor }))} />
        </Estimated>
        <Estimated reason={ESTIMATED_DEFAULTS.unplacedRunMetres}>
          <NumberField label="Run for an unplaced camera" unit={u} helper="Placeholder horizontal run until the camera is on the site map." value={shown(cabling.unplacedRunMetres)} min={0.1} onChange={len(0.1, 1000, (unplacedRunMetres) => setCabling({ unplacedRunMetres }))} />
        </Estimated>
      </Advanced>
    </Card>
  );
}
