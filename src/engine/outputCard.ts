/**
 * The 15-field output card.
 *
 * The field list and its ORDER are taken from the client's existing spec-sheet
 * format and must be reproduced exactly. `CARD_FIELD_ORDER` is the contract; the
 * tests assert against it so a well-meaning refactor cannot quietly reorder the
 * client's sheet.
 *
 * Where a field genuinely does not apply, the value is `NOT_SPECIFIED` — never a
 * blank cell and never a guess.
 *
 * Three of the fifteen are not datasheet facts and are marked `derived`:
 *   - Controller Type   (from the published client list, ONVIF profiles and PTZ)
 *   - Alert Type        (from the published alarm I/O, audio and strobe/siren)
 *   - Room Type         (a suggested application, inferred from form factor,
 *                        ingress rating, light range and analytics)
 * The UI shows the "derived" marker so nobody quotes them as manufacturer data.
 */

import type { Camera } from '../data/schema.ts';

export const NOT_SPECIFIED = 'Not specified';

export const CARD_FIELD_ORDER = [
  'Other Special Features of the Product',
  'Indoor Outdoor Usage',
  'Compatible Devices',
  'Controller Type',
  'Mount Type',
  'Color',
  'Form Factor',
  'Enclosure Material',
  'Shape',
  'Alert Type',
  'Room Type',
  'Light Source',
  'Effective Still Resolution',
  'Waterproof Rating',
  'Photo Sensor Resolution',
] as const;

export type CardFieldName = (typeof CARD_FIELD_ORDER)[number];

export interface CardField {
  readonly name: CardFieldName;
  readonly value: string;
  /** True when the value was inferred from other verified fields, not read off the datasheet. */
  readonly derived: boolean;
}

function joinOrNotSpecified(parts: readonly (string | null | undefined)[]): string {
  const clean = parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  return clean.length > 0 ? clean.join(', ') : NOT_SPECIFIED;
}

const FORM_FACTOR_LABELS: Readonly<Record<Camera['formFactor'], string>> = {
  bullet: 'Bullet',
  'mini-bullet': 'Mini bullet',
  dome: 'Dome',
  turret: 'Turret',
  ptz: 'PTZ',
  panoramic: 'Panoramic',
  fisheye: 'Fisheye',
  'multi-sensor': 'Multi-sensor',
};

const SHAPE_LABELS: Readonly<Record<Camera['shape'], string>> = {
  cylindrical: 'Cylindrical',
  hemispherical: 'Hemispherical',
  cube: 'Cube',
  box: 'Box',
  spherical: 'Spherical',
};

const MATERIAL_LABELS: Readonly<Record<NonNullable<Camera['enclosureMaterial']>, string>> = {
  'metal-aluminium-alloy': 'Metal (aluminium alloy)',
  polymer: 'Polymer',
  'metal-and-plastic': 'Metal and plastic',
  'stainless-steel': 'Stainless steel',
};

const INDOOR_OUTDOOR_LABELS: Readonly<Record<Camera['indoorOutdoor'], string>> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  'indoor-outdoor': 'Indoor-Outdoor',
};

/** Controller Type — derived from the published client software list and PTZ support. */
function controllerType(camera: Camera): string {
  const parts: string[] = [];
  if (camera.clients.some((c) => /hik-connect/i.test(c))) parts.push('Hik-Connect app');
  parts.push('Web browser');
  if (camera.clients.some((c) => /hikcentral|hik-central/i.test(c))) parts.push('HikCentral');
  if (camera.clients.some((c) => /ivms/i.test(c))) parts.push('iVMS-4200');
  if (camera.onvifProfiles.length > 0) parts.push('ONVIF-compatible NVR or VMS');
  if (camera.capabilities.includes('ptz-control')) parts.push('PTZ keyboard / joystick controller');
  return joinOrNotSpecified(parts);
}

/** Alert Type — derived from published alarm I/O, audio and deterrent hardware. */
function alertType(camera: Camera): string {
  const parts: string[] = [];
  if (camera.capabilities.includes('strobe-light')) parts.push('Visual (strobe light)');
  if (camera.capabilities.includes('audible-warning')) parts.push('Audible (siren / warning)');
  if (camera.capabilities.includes('two-way-audio')) parts.push('Two-way audio');
  if (camera.clients.some((c) => /hik-connect/i.test(c))) parts.push('App push notification');
  parts.push('Email');
  parts.push('Notify surveillance centre / FTP upload');
  if ((camera.alarmOutputs ?? 0) > 0) {
    parts.push(`Alarm output (${camera.alarmOutputs} relay)`);
  }
  return joinOrNotSpecified(parts);
}

/**
 * Room Type — a suggested application, not a manufacturer statement.
 *
 * Derived from verified attributes only: ingress rating and indoor/outdoor,
 * form factor, supplement-light reach and whether the model does ANPR.
 */
function roomType(camera: Camera): string {
  const suggestions: string[] = [];
  const reach = Math.max(camera.irRangeMetres ?? 0, camera.whiteLightRangeMetres ?? 0);

  if (camera.capabilities.includes('anpr')) {
    suggestions.push('vehicle gate / barrier', 'car park entry');
  }
  if (camera.formFactor === 'ptz') {
    suggestions.push('large yard', 'perimeter overwatch', 'car park');
  }
  if (camera.formFactor === 'panoramic') {
    suggestions.push('forecourt', 'retail floor', 'open-plan office');
  }

  if (camera.indoorOutdoor === 'indoor') {
    suggestions.push('lobby', 'corridor', 'office');
  } else {
    if (reach >= 60) suggestions.push('perimeter', 'yard', 'long driveway');
    else if (reach >= 40) suggestions.push('gate', 'car park', 'loading bay');
    else suggestions.push('entrance', 'courtyard');

    if (camera.formFactor === 'dome' || camera.formFactor === 'turret') {
      suggestions.push('lobby', 'corridor');
    }
    if (camera.formFactor === 'bullet' || camera.formFactor === 'mini-bullet') {
      suggestions.push('warehouse aisle');
    }
  }

  if (camera.ikRating === 'IK10') suggestions.push('publicly reachable positions');

  const unique = [...new Set(suggestions)];
  return unique.length > 0 ? unique.join(', ') : NOT_SPECIFIED;
}

/** Light Source — IR / white light / Smart Hybrid, with the published range. */
function lightSource(camera: Camera): string {
  switch (camera.supplementLight) {
    case 'none':
      return 'None — relies on ambient light';
    case 'ir':
      return camera.irRangeMetres === null
        ? 'IR LED, range not specified'
        : `IR LED, up to ${camera.irRangeMetres} m`;
    case 'white':
      return camera.whiteLightRangeMetres === null
        ? 'White light (ColorVu), range not specified'
        : `White light (ColorVu), up to ${camera.whiteLightRangeMetres} m`;
    case 'smart-hybrid': {
      const ir = camera.irRangeMetres === null ? null : `IR up to ${camera.irRangeMetres} m`;
      const white =
        camera.whiteLightRangeMetres === null ? null : `white light up to ${camera.whiteLightRangeMetres} m`;
      return `Smart Hybrid Light — ${joinOrNotSpecified([ir, white])}`;
    }
  }
}

function photoSensorResolution(camera: Camera): string {
  const mp = camera.sensorMegapixels === null ? null : `${camera.sensorMegapixels} MP`;
  return joinOrNotSpecified([mp, camera.sensorDescription]);
}

function waterproofRating(camera: Camera): string {
  return joinOrNotSpecified([camera.ipRating, camera.ikRating]);
}

function mountType(camera: Camera): string {
  const mounts = camera.mountTypes
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    .join(' / ');
  return camera.requiredBracket ? `${mounts}. ${camera.requiredBracket}` : mounts || NOT_SPECIFIED;
}

/** Build the card in the client's exact field order. */
export function buildOutputCard(camera: Camera): readonly CardField[] {
  const fields: Record<CardFieldName, { value: string; derived: boolean }> = {
    'Other Special Features of the Product': {
      value: joinOrNotSpecified(camera.headlineFeatures),
      derived: false,
    },
    'Indoor Outdoor Usage': {
      value: `${INDOOR_OUTDOOR_LABELS[camera.indoorOutdoor]}${
        camera.operatingTempMinC !== null && camera.operatingTempMaxC !== null
          ? ` (${camera.operatingTempMinC} °C to ${camera.operatingTempMaxC} °C${camera.ipRating ? `, ${camera.ipRating}` : ''})`
          : camera.ipRating
            ? ` (${camera.ipRating}; operating temperature not specified)`
            : ''
      }`,
      derived: false,
    },
    'Compatible Devices': {
      value: joinOrNotSpecified([
        camera.onvifProfiles.length > 0
          ? `ONVIF ${camera.onvifProfiles.join(', ')}`
          : 'ONVIF profiles not specified on the datasheet',
        ...camera.clients,
        'ISAPI / SDK',
      ]),
      derived: false,
    },
    'Controller Type': { value: controllerType(camera), derived: true },
    'Mount Type': { value: mountType(camera), derived: false },
    Color: { value: camera.colour ?? NOT_SPECIFIED, derived: false },
    'Form Factor': { value: FORM_FACTOR_LABELS[camera.formFactor], derived: false },
    'Enclosure Material': {
      value: camera.enclosureMaterial ? MATERIAL_LABELS[camera.enclosureMaterial] : NOT_SPECIFIED,
      derived: false,
    },
    Shape: { value: SHAPE_LABELS[camera.shape], derived: false },
    'Alert Type': { value: alertType(camera), derived: true },
    'Room Type': { value: roomType(camera), derived: true },
    'Light Source': { value: lightSource(camera), derived: false },
    'Effective Still Resolution': {
      value:
        camera.stillResolution ??
        `${NOT_SPECIFIED} (max video resolution ${camera.maxResolutionWidthPx} x ${camera.maxResolutionHeightPx})`,
      derived: false,
    },
    'Waterproof Rating': { value: waterproofRating(camera), derived: false },
    'Photo Sensor Resolution': { value: photoSensorResolution(camera), derived: false },
  };

  return CARD_FIELD_ORDER.map((name) => ({
    name,
    value: fields[name].value,
    derived: fields[name].derived,
  }));
}
