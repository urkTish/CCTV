/**
 * Admin → Camera finder: the client already has a recorder. Pick it, say what
 * the camera must do, and see the catalogue cameras that work with it — or,
 * when none does, the nearest ones and exactly what each misses.
 *
 * Stand-alone: nothing here touches the project.
 */

import { useMemo, useState } from 'react';

import { nvrs } from '../../data/products.ts';
import type { FormFactor } from '../../data/schema.ts';
import { findCamerasForNvr, type CameraMatch, type Placement } from '../../engine/cameraFinder.ts';
import { Card, CheckboxField, Notice, NumberField, SelectField } from '../primitives.tsx';

const MEGAPIXEL_OPTIONS = [0, 2, 4, 5, 6, 8, 12, 16] as const;
const LENS_OPTIONS = [0, 2.8, 4, 6, 8, 12] as const;

const FORM_FACTORS: readonly { value: FormFactor | 'any'; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'bullet', label: 'Bullet' },
  { value: 'mini-bullet', label: 'Mini bullet' },
  { value: 'dome', label: 'Dome' },
  { value: 'turret', label: 'Turret' },
  { value: 'ptz', label: 'PTZ' },
  { value: 'panoramic', label: 'Panoramic' },
];

const PLACEMENTS: readonly { value: Placement; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
];

const TIER_LABEL = { economy: 'Economy', standard: 'Standard', premium: 'Premium' } as const;

function CameraRow({ match, showMisses }: { match: CameraMatch; showMisses: boolean }) {
  const cam = match.camera;
  return (
    <li className="grid gap-1 border-b border-[var(--color-border)] py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-[var(--color-ink)]">{cam.model}</span>
        <a href={cam.datasheetUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-accent)] underline">
          Datasheet
        </a>
      </div>
      <p className="text-sm text-[var(--color-ink-2)]">
        {match.megapixels} MP · {match.lens.label} · {cam.formFactor} · {cam.indoorOutdoor === 'indoor-outdoor' ? 'indoor and outdoor' : cam.indoorOutdoor}
        {cam.ipRating ? ` · ${cam.ipRating}` : ''} · {TIER_LABEL[cam.priceTier]} tier (editorial)
      </p>
      {showMisses && match.failed.length > 0 && (
        <ul className="text-sm text-[var(--color-ink-2)]">
          {match.failed.map((f) => (
            <li key={f.id}>
              <span className="font-medium">Misses {f.label.toLowerCase()}:</span> {f.detail}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function CameraFinderSection() {
  const [nvrId, setNvrId] = useState<string>(nvrs[0]?.id ?? '');
  const [minMp, setMinMp] = useState<number>(0);
  const [lensMm, setLensMm] = useState<number>(0);
  const [formFactor, setFormFactor] = useState<FormFactor | 'any'>('any');
  const [placement, setPlacement] = useState<Placement>('any');
  const [quantity, setQuantity] = useState<number>(1);
  const [poeFromNvr, setPoeFromNvr] = useState(false);

  const qtyError = Number.isInteger(quantity) && quantity >= 1 ? null : 'Enter a whole number of at least 1.';
  const result = useMemo(
    () =>
      qtyError
        ? null
        : findCamerasForNvr({
            nvrId,
            minMegapixels: minMp > 0 ? minMp : null,
            focalLengthMm: lensMm > 0 ? lensMm : null,
            formFactor,
            placement,
            quantity,
            poeFromNvr,
          }),
    [nvrId, minMp, lensMm, formFactor, placement, quantity, poeFromNvr, qtyError],
  );

  return (
    <div className="grid items-start gap-4 @5xl/section:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <Card title="Recorder and requirements">
        <div className="grid gap-3">
          <SelectField
            label="Recorder (NVR)"
            helper="The recorder the client already has."
            value={nvrId}
            options={nvrs.map((n) => ({ value: n.id, label: `${n.model} (${n.channels} ch, up to ${n.maxRecordingResolutionMp} MP)` }))}
            onChange={setNvrId}
          />
          <SelectField
            label="Minimum resolution"
            helper="The camera must be at least this many megapixels."
            value={minMp}
            options={MEGAPIXEL_OPTIONS.map((v) => ({ value: v, label: v === 0 ? 'Any' : `${v} MP` }))}
            onChange={setMinMp}
          />
          <SelectField
            label="Lens"
            helper="A fixed lens must match; a varifocal must cover it."
            value={lensMm}
            options={LENS_OPTIONS.map((v) => ({ value: v, label: v === 0 ? 'Any' : `${v} mm` }))}
            onChange={setLensMm}
          />
          <SelectField label="Form factor" helper="Shape of the camera body." value={formFactor} options={FORM_FACTORS} onChange={setFormFactor} />
          <SelectField label="Indoor / outdoor" helper="Where the camera will be mounted." value={placement} options={PLACEMENTS} onChange={setPlacement} />
          <NumberField
            label="How many cameras"
            helper="Checked against the recorder's channels and bandwidth."
            value={quantity}
            min={1}
            step={1}
            onChange={setQuantity}
            error={qtyError}
          />
          <CheckboxField
            label="Power them from the recorder's PoE ports"
            helper="Also checks PoE ports, class and budget."
            checked={poeFromNvr}
            onChange={setPoeFromNvr}
          />
        </div>
      </Card>

      <div className="grid min-w-0 gap-4">
        {result?.notices.map((n) => (
          <Notice key={n} kind="warning" role="status">
            {n}
          </Notice>
        ))}
        {result && result.matches.length > 0 && (
          <Card title={`${result.matches.length} compatible camera${result.matches.length === 1 ? '' : 's'}`} subtitle={`Best fit first, for ${result.nvr.model}.`}>
            <ul>
              {result.matches.map((m) => (
                <CameraRow key={m.camera.id} match={m} showMisses={false} />
              ))}
            </ul>
          </Card>
        )}
        {result && result.matches.length === 0 && (
          <Card title="No camera meets every requirement" subtitle="The closest cameras that still work with this recorder, and what each misses.">
            {result.nearMisses.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-2)]">No camera in the catalogue works with this recorder for the quantity asked.</p>
            ) : (
              <ul>
                {result.nearMisses.map((m) => (
                  <CameraRow key={m.camera.id} match={m} showMisses />
                ))}
              </ul>
            )}
          </Card>
        )}
        <p className="text-xs text-[var(--color-ink-3)]">
          Bandwidth uses Hikvision&rsquo;s published H.265 peak bitrate at 25 fps, moderate motion. Specifications come from the datasheets linked
          on each camera.
        </p>
      </div>
    </div>
  );
}
