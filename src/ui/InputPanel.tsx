/**
 * One location's inputs, in the engineer's order:
 *   geometry -> purpose -> environment -> client requirements.
 *
 * The essentials (name, camera count) sit above four tabs, one per input group.
 * Inside each tab the inputs an engineer touches on every job come first; the
 * rarely changed ones (nearest distance, target height, overlap, special
 * conditions, motion, compression, frame rate) sit under an "Advanced"
 * disclosure that says how many differ from their defaults.
 *
 * Everything is a controlled input over the `Location` object. There is no submit
 * button: the results recompute from the same state on every keystroke.
 *
 * Lengths are held in metres in state and converted at the edge, so switching
 * units never changes the scenario — only how it reads.
 */

import { useState, type ReactNode } from 'react';

import { PURPOSES } from '../domain/dori.ts';
import { lengthToMetres, lengthFromMetres, lengthUnitLabel, round } from '../domain/units.ts';
import { capabilityLabel } from '../engine/recommend.ts';
import type { Capability } from '../data/schema.ts';
import { countChanged, inputTabOfField, type InputTab } from '../state/locationFields.ts';
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_GEOMETRY,
  DEFAULT_REQUIREMENTS,
  type Location,
  type UnitSystemState,
} from '../state/projectTypes.ts';
import { AssumedFlag } from './AssumedFlag.tsx';
import {
  Advanced,
  Fieldset,
  NumberField,
  SelectField,
  CheckboxField,
  TextField,
  EstimateBadge,
  Tabs,
  TabPanel,
} from './primitives.tsx';

/** Analytics an engineer realistically ticks in front of a client. */
const SELECTABLE_CAPABILITIES: readonly Capability[] = [
  'acusense',
  'line-crossing',
  'intrusion-detection',
  'region-entrance-exit',
  'face-capture',
  'anpr',
  'strobe-light',
  'audible-warning',
  'two-way-audio',
  'alarm-io',
  'microsd',
  'motorised-zoom',
];

export function InputPanel({
  location,
  units,
  onChange,
  assumed,
  onConfirm,
}: {
  location: Location;
  units: UnitSystemState;
  onChange: (next: Location) => void;
  /** Field key → reason, for values assumed from a client intake and not yet confirmed. */
  assumed?: ReadonlyMap<string, string>;
  onConfirm?: (keys: readonly string[]) => void;
}) {
  const [tab, setTab] = useState<InputTab>('geometry');
  const u = lengthUnitLabel(units);
  const g = location.geometry;
  const env = location.environment;
  const req = location.requirements;

  const setGeometry = (patch: Partial<Location['geometry']>) =>
    onChange({ ...location, geometry: { ...g, ...patch } });
  const setEnvironment = (patch: Partial<Location['environment']>) =>
    onChange({ ...location, environment: { ...env, ...patch } });
  const setRequirements = (patch: Partial<Location['requirements']>) =>
    onChange({ ...location, requirements: { ...req, ...patch } });

  /** Show a metre value in the user's units; store what they type back in metres. */
  const shown = (metres: number) => round(lengthFromMetres(metres, units), 2);
  const stored = (typed: number) => lengthToMetres(typed, units);

  const positiveError = (v: number, what: string) =>
    !Number.isFinite(v) || v <= 0 ? `${what} must be a positive number.` : null;

  /** The intake marker for one field, if that field is still assumed. */
  const flag = (key: string, fieldLabel: string): ReactNode => {
    const reason = assumed?.get(key);
    if (reason === undefined || !onConfirm) return undefined;
    return <AssumedFlag reason={reason} fieldLabel={fieldLabel} onConfirm={() => onConfirm([key])} />;
  };

  const purpose = PURPOSES.find((p) => p.id === location.purpose);

  // --- per-tab counts: input errors and values still to confirm ---------------
  const errors: Record<InputTab, number> = {
    geometry: [
      g.mountHeightMetres,
      g.targetDistanceMetres,
      g.widthSource === 'width' ? g.sceneWidthMetres : g.roomLengthMetres,
      g.widthSource === 'room' ? g.roomWidthMetres : 1,
    ].filter((v) => !Number.isFinite(v) || v <= 0).length,
    purpose: 0,
    environment: 0,
    requirements: [req.retentionDays].filter((v) => !Number.isFinite(v) || v < 1).length,
  };
  const toConfirm: Record<InputTab, number> = { geometry: 0, purpose: 0, environment: 0, requirements: 0 };
  for (const key of assumed?.keys() ?? []) {
    const t = inputTabOfField(key);
    if (t) toConfirm[t] += 1;
  }
  const badge = (t: InputTab) =>
    errors[t] > 0 ? (
      <span className="rounded-full bg-[var(--color-fail-soft)] px-1.5 text-2xs font-semibold text-[var(--color-fail)]">
        {errors[t]} error{errors[t] === 1 ? '' : 's'}
      </span>
    ) : toConfirm[t] > 0 ? (
      <span className="rounded-full bg-[var(--color-estimate-soft)] px-1.5 text-2xs font-semibold text-[var(--color-estimate)]">
        {toConfirm[t]} to confirm
      </span>
    ) : undefined;

  const advancedGeometry = countChanged(g, DEFAULT_GEOMETRY, [
    'nearestDistanceMetres',
    'targetHeightMetres',
    ...(g.widthSource === 'room' ? (['overlapAllowance'] as const) : []),
  ]);
  const advancedEnvironment = countChanged(env, DEFAULT_ENVIRONMENT, ['specialConditions']);
  const advancedRequirements = countChanged(req, DEFAULT_REQUIREMENTS, ['motionLevel', 'codec', 'fps']);

  const anyAssumed = (keys: readonly string[]) => keys.some((k) => assumed?.has(k) ?? false);

  const idBase = `inputs-${location.id}`;

  return (
    <div className="@container grid min-w-0 gap-4">
      {/* --- essentials, always visible --------------------------------------- */}
      <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_10rem]">
        <TextField
          label="Name"
          helper="What you would call this position on a drawing — main gate, lobby, warehouse aisle."
          value={location.name}
          onChange={(name) => onChange({ ...location, name })}
          flag={flag('name', 'Name')}
        />
        <NumberField
          label="Cameras of this type at this location"
          unit="count"
          helper="Multiplies the totals for bandwidth, storage and PoE."
          value={req.cameraCount}
          min={1}
          step={1}
          onChange={(v) =>
            setRequirements({ cameraCount: Number.isFinite(v) && v >= 1 ? Math.round(v) : 1 })
          }
          error={
            !Number.isFinite(req.cameraCount) || req.cameraCount < 1
              ? 'At least one camera.'
              : null
          }
          flag={flag('requirements.cameraCount', 'Cameras of this type at this location')}
        />
      </div>

      <div className="min-w-0">
        <Tabs
          label={`Inputs for ${location.name}`}
          idBase={idBase}
          active={tab}
          onChange={setTab}
          wrap
          tabs={[
            { id: 'geometry', label: 'Geometry', badge: badge('geometry') },
            { id: 'purpose', label: 'Purpose', badge: badge('purpose') },
            { id: 'environment', label: 'Environment', badge: badge('environment') },
            { id: 'requirements', label: 'Client requirements', badge: badge('requirements') },
          ]}
        />

        <TabPanel idBase={idBase} id={tab} className="pt-4">
          {tab === 'geometry' && (
            <>
              <p className="mb-3 text-sm text-[var(--color-ink-3)]">Measure it on site; do not estimate from a drawing.</p>
              <Fieldset legend="Where the camera sits">
                <NumberField
                  label="Mounting height"
                  unit={u}
                  helper="From the floor to the lens, not to the bracket."
                  value={shown(g.mountHeightMetres)}
                  min={0.1}
                  onChange={(v) => setGeometry({ mountHeightMetres: stored(v) })}
                  error={positiveError(g.mountHeightMetres, 'Mounting height')}
                  flag={flag('geometry.mountHeightMetres', 'Mounting height')}
                />
                <NumberField
                  label="Distance to the furthest point of interest"
                  unit={u}
                  helper="Measure along the ground from directly below the lens to the furthest point you need to see clearly."
                  value={shown(g.targetDistanceMetres)}
                  min={0.1}
                  onChange={(v) => setGeometry({ targetDistanceMetres: stored(v) })}
                  error={positiveError(g.targetDistanceMetres, 'Distance')}
                  flag={flag('geometry.targetDistanceMetres', 'Distance to the furthest point of interest')}
                />
              </Fieldset>

              <Fieldset legend="How much you need to see">
                <SelectField
                  label="Specify the coverage as"
                  helper="Either the width you need at the target distance, or the room dimensions — the other is derived."
                  value={g.widthSource}
                  options={[
                    { value: 'width' as const, label: 'A scene width at the target distance' },
                    { value: 'room' as const, label: 'Room or area dimensions' },
                  ]}
                  onChange={(widthSource) => setGeometry({ widthSource })}
                  flag={flag('geometry.widthSource', 'Specify the coverage as')}
                />
                {g.widthSource === 'width' ? (
                  <NumberField
                    label="Required scene width at that distance"
                    unit={u}
                    helper="How wide the picture must be where the target is — a gate opening, a doorway, the width of an aisle."
                    value={shown(g.sceneWidthMetres)}
                    min={0.1}
                    onChange={(v) => setGeometry({ sceneWidthMetres: stored(v) })}
                    error={positiveError(g.sceneWidthMetres, 'Scene width')}
                    flag={flag('geometry.sceneWidthMetres', 'Required scene width')}
                  />
                ) : (
                  <>
                    <NumberField
                      label="Room length (the axis the camera looks down)"
                      unit={u}
                      helper="The long axis. This becomes the distance the camera has to hold its pixel density over."
                      value={shown(g.roomLengthMetres)}
                      min={0.1}
                      onChange={(v) => setGeometry({ roomLengthMetres: stored(v) })}
                      error={positiveError(g.roomLengthMetres, 'Room length')}
                    />
                    <NumberField
                      label="Room width"
                      unit={u}
                      helper="The short axis. This becomes the scene width the lens has to fit in."
                      value={shown(g.roomWidthMetres)}
                      min={0.1}
                      onChange={(v) => setGeometry({ roomWidthMetres: stored(v) })}
                      error={positiveError(g.roomWidthMetres, 'Room width')}
                    />
                  </>
                )}
              </Fieldset>

              <Advanced changed={advancedGeometry} defaultOpen={anyAssumed(['geometry.nearestDistanceMetres', 'geometry.targetHeightMetres'])}>
                <NumberField
                  label="Distance to the nearest point of interest (optional)"
                  unit={u}
                  helper="Only used to warn about IR washing out close subjects. Leave at 0 if it does not apply."
                  value={g.nearestDistanceMetres === null ? 0 : shown(g.nearestDistanceMetres)}
                  min={0}
                  onChange={(v) =>
                    setGeometry({ nearestDistanceMetres: !Number.isFinite(v) || v <= 0 ? null : stored(v) })
                  }
                  flag={flag('geometry.nearestDistanceMetres', 'Distance to the nearest point of interest')}
                />
                <NumberField
                  label="Height of what you are looking at"
                  unit={u}
                  helper="Face height for people (about 1.6 m), plate height for vehicles (about 0.5 m). Sets the tilt angle."
                  value={shown(g.targetHeightMetres)}
                  min={0}
                  onChange={(v) => setGeometry({ targetHeightMetres: Number.isFinite(v) ? stored(v) : 0 })}
                  flag={flag('geometry.targetHeightMetres', 'Height of what you are looking at')}
                />
                {g.widthSource === 'room' && (
                  <NumberField
                    label="Overlap allowance between cameras"
                    unit="fraction"
                    helper="How much of each camera's footprint is given up to the next one so there is no seam. 0.15 is a common default."
                    value={g.overlapAllowance}
                    min={0}
                    max={0.9}
                    step={0.05}
                    onChange={(v) => setGeometry({ overlapAllowance: Number.isFinite(v) ? v : 0 })}
                  />
                )}
              </Advanced>
            </>
          )}

          {tab === 'purpose' && (
            <>
              <SelectField
                label="What must be possible at that distance"
                helper="The single most important input: it sets the pixel density everything else is measured against. From the DORI levels in IEC 62676-4, plus the two special cases that carry their own requirement."
                value={location.purpose}
                options={PURPOSES.map((p) => ({ value: p.id, label: p.label }))}
                onChange={(p) => onChange({ ...location, purpose: p })}
                flag={flag('purpose', 'What must be possible at that distance')}
              />
              {purpose && (
                <div className="mt-3 rounded-control bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-ink-2)]">
                  <p>{purpose.helper}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--color-ink)]">
                      {purpose.requiredPxPerMetre.toFixed(0)} px/m
                    </span>
                    {purpose.pxPerFace !== null && (
                      <span className="text-[var(--color-ink-3)]">({purpose.pxPerFace} px across a face)</span>
                    )}
                    {purpose.isEstimate && <EstimateBadge title={purpose.sourceNote} />}
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--color-ink-3)]">{purpose.sourceNote}</p>
                </div>
              )}
            </>
          )}

          {tab === 'environment' && (
            <>
              <p className="mb-3 text-sm text-[var(--color-ink-3)]">Drives form factor, ingress rating and the lighting technology.</p>
              <Fieldset legend="Where it goes">
                <SelectField
                  label="Site"
                  helper="Outdoor requires at least IPx6; semi-covered at least IPx4."
                  value={env.site}
                  options={[
                    { value: 'indoor' as const, label: 'Indoor' },
                    { value: 'semi-covered' as const, label: 'Semi-covered (canopy, soffit, car park deck)' },
                    { value: 'outdoor' as const, label: 'Outdoor, fully exposed' },
                  ]}
                  onChange={(site) => setEnvironment({ site })}
                  flag={flag('environment.site', 'Site')}
                />
                <SelectField
                  label="Mounting surface"
                  helper="Recorded for the bracket and for the install method. It does not filter models on its own."
                  value={env.mountSurface}
                  options={[
                    { value: 'wall' as const, label: 'Wall' },
                    { value: 'ceiling' as const, label: 'Ceiling' },
                    { value: 'pendant' as const, label: 'Pendant' },
                    { value: 'pole' as const, label: 'Pole' },
                    { value: 'corner' as const, label: 'Corner' },
                    { value: 'recessed' as const, label: 'Recessed / in-ceiling' },
                  ]}
                  onChange={(mountSurface) => setEnvironment({ mountSurface })}
                  flag={flag('environment.mountSurface', 'Mounting surface')}
                />
                <CheckboxField
                  label="Within reach, vandalism a real risk"
                  helper="Requires IK10. Rules out most bullet bodies, which publish no IK rating."
                  checked={env.vandalExposure}
                  onChange={(vandalExposure) => setEnvironment({ vandalExposure })}
                  flag={flag('environment.vandalExposure', 'Vandalism risk')}
                />
              </Fieldset>

              <Fieldset legend="Light">
                <SelectField
                  label="Ambient light"
                  helper="Zero lux means no usable light at all, so the camera's own illuminator has to do everything."
                  value={env.ambientLight}
                  options={[
                    { value: 'well-lit-24-7' as const, label: 'Well lit 24/7' },
                    { value: 'low-light' as const, label: 'Low light at night' },
                    { value: 'zero-lux' as const, label: 'Zero lux — no ambient light at night' },
                  ]}
                  onChange={(ambientLight) => setEnvironment({ ambientLight })}
                  flag={flag('environment.ambientLight', 'Ambient light')}
                />
                <CheckboxField
                  label="Client wants colour at night"
                  helper="Rules out IR-only models. Needs ColorVu or Smart Hybrid Light, which cost more and are visible."
                  checked={env.colourAtNight}
                  onChange={(colourAtNight) => setEnvironment({ colourAtNight })}
                  flag={flag('environment.colourAtNight', 'Colour at night')}
                />
                <CheckboxField
                  label="Strong backlight or glare"
                  helper="Doorways, windows, loading bays. Requires at least 120 dB true WDR — digital WDR will not do."
                  checked={env.strongBacklight}
                  onChange={(strongBacklight) => setEnvironment({ strongBacklight })}
                  flag={flag('environment.strongBacklight', 'Strong backlight')}
                />
              </Fieldset>

              <Advanced changed={advancedEnvironment} label="Special conditions" defaultOpen={anyAssumed(['environment.specialConditions'])}>
                <p className="text-xs text-[var(--color-ink-3)]">Each one tightens the ingress requirement.</p>
                {(
                  [
                    ['dust', 'Dusty (needs IP6x)'],
                    ['washdown', 'Washdown or hosing (needs IP6x)'],
                    ['corrosive-marine', 'Corrosive or marine (look for NEMA 4X in the notes)'],
                    ['extreme-cold', 'Extreme cold (check the operating temperature on the card)'],
                  ] as const
                ).map(([value, label]) => (
                  <CheckboxField
                    key={value}
                    label={label}
                    helper=""
                    checked={env.specialConditions.includes(value)}
                    onChange={(on) =>
                      setEnvironment({
                        specialConditions: on
                          ? [...env.specialConditions, value]
                          : env.specialConditions.filter((c) => c !== value),
                      })
                    }
                  />
                ))}
                {flag('environment.specialConditions', 'Special conditions')}
              </Advanced>
            </>
          )}

          {tab === 'requirements' && (
            <>
              <Fieldset legend="Commercial and optical preferences">
                <SelectField
                  label="Budget tier"
                  helper="Indicative bands assigned from series positioning, not from a price list."
                  value={req.budgetTier}
                  options={[
                    { value: 'any' as const, label: 'No constraint' },
                    { value: 'economy' as const, label: 'Economy' },
                    { value: 'standard' as const, label: 'Standard' },
                    { value: 'premium' as const, label: 'Premium' },
                  ]}
                  onChange={(budgetTier) => setRequirements({ budgetTier })}
                  flag={flag('requirements.budgetTier', 'Budget tier')}
                />
                <NumberField
                  label="Retention target"
                  unit="days"
                  helper="How far back the client needs to be able to go."
                  value={req.retentionDays}
                  min={1}
                  step={1}
                  onChange={(v) =>
                    setRequirements({ retentionDays: Number.isFinite(v) && v >= 1 ? Math.round(v) : 1 })
                  }
                  error={
                    !Number.isFinite(req.retentionDays) || req.retentionDays < 1
                      ? 'At least one day.'
                      : null
                  }
                  flag={flag('requirements.retentionDays', 'Retention target')}
                />
                <SelectField
                  label="Lens"
                  helper="Fixed is cheaper and simpler; varifocal lets you dial the view in on site."
                  value={req.lensPreference}
                  options={[
                    { value: 'any' as const, label: 'Either' },
                    { value: 'fixed' as const, label: 'Fixed only' },
                    { value: 'varifocal' as const, label: 'Varifocal or motorised only' },
                  ]}
                  onChange={(lensPreference) => setRequirements({ lensPreference })}
                  flag={flag('requirements.lensPreference', 'Lens')}
                />
                <CheckboxField
                  label="PTZ acceptable"
                  helper="A PTZ only earns its place where someone is watching. It cannot record everywhere at once."
                  checked={req.ptzAcceptable}
                  onChange={(ptzAcceptable) => setRequirements({ ptzAcceptable })}
                  flag={flag('requirements.ptzAcceptable', 'PTZ acceptable')}
                />
              </Fieldset>

              <Fieldset legend="Audio and analytics">
                <CheckboxField
                  label="Audio needed"
                  helper="Requires a built-in microphone. Check local law before recording audio."
                  checked={req.audioRequired}
                  onChange={(audioRequired) => setRequirements({ audioRequired })}
                  flag={flag('requirements.audioRequired', 'Audio needed')}
                />
                <CheckboxField
                  label="Two-way audio needed"
                  helper="For talking to someone at the camera. Needs a built-in speaker as well as a microphone."
                  checked={req.twoWayAudioRequired}
                  onChange={(twoWayAudioRequired) => setRequirements({ twoWayAudioRequired })}
                  flag={flag('requirements.twoWayAudioRequired', 'Two-way audio needed')}
                />
                <div>
                  <p className="mb-1 text-sm font-medium text-[var(--color-ink)]">Must-have features</p>
                  <p className="mb-2 text-xs text-[var(--color-ink-3)]">
                    Each one you tick is a hard filter. Anything without it is excluded and listed as rejected.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SELECTABLE_CAPABILITIES.map((c) => (
                      <label key={c} className="flex items-start gap-2 text-sm text-[var(--color-ink-2)]">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                          checked={req.requiredCapabilities.includes(c)}
                          onChange={(e) =>
                            setRequirements({
                              requiredCapabilities: e.currentTarget.checked
                                ? [...req.requiredCapabilities, c]
                                : req.requiredCapabilities.filter((x) => x !== c),
                            })
                          }
                        />
                        {capabilityLabel(c)}
                      </label>
                    ))}
                  </div>
                  {flag('requirements.requiredCapabilities', 'Must-have features')}
                </div>
              </Fieldset>

              <Advanced changed={advancedRequirements} label="Advanced: recording stream" defaultOpen={anyAssumed(['requirements.motionLevel', 'requirements.codec', 'requirements.fps'])}>
                <SelectField
                  label="Expected motion level"
                  helper="Hikvision's own guidance adds 20–30% to the published bitrate for a complex scene."
                  value={req.motionLevel}
                  options={[
                    { value: 'low' as const, label: 'Low — a quiet room or a closed yard' },
                    { value: 'moderate' as const, label: 'Moderate (interpolated figure)' },
                    { value: 'high' as const, label: 'High — a street, a busy gate, moving foliage' },
                  ]}
                  onChange={(motionLevel) => setRequirements({ motionLevel })}
                  flag={flag('requirements.motionLevel', 'Expected motion level')}
                />
                <SelectField
                  label="Compression"
                  helper="H.265+ roughly halves the storage of H.265 on a static scene. Check the recorder supports it."
                  value={req.codec}
                  options={[
                    { value: 'h265plus' as const, label: 'H.265+' },
                    { value: 'h265' as const, label: 'H.265' },
                    { value: 'h264plus' as const, label: 'H.264+' },
                    { value: 'h264' as const, label: 'H.264' },
                  ]}
                  onChange={(codec) => setRequirements({ codec })}
                  flag={flag('requirements.codec', 'Compression')}
                />
                <SelectField
                  label="Frame rate"
                  helper="Only the rates Hikvision publishes a bitrate column for are offered — nothing is interpolated."
                  value={req.fps}
                  options={[
                    { value: 30 as const, label: '30 fps' },
                    { value: 25 as const, label: '25 fps' },
                    { value: 20 as const, label: '20 fps' },
                    { value: 15 as const, label: '15 fps' },
                    { value: 12.5 as const, label: '12.5 fps' },
                    { value: 10 as const, label: '10 fps' },
                  ]}
                  onChange={(fps) => setRequirements({ fps })}
                  flag={flag('requirements.fps', 'Frame rate')}
                />
              </Advanced>
            </>
          )}
        </TabPanel>
      </div>
    </div>
  );
}
