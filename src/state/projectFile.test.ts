import { describe, it, expect } from 'vitest';
import {
  parseProjectFile,
  serializeProjectFile,
  projectFileName,
  PROJECT_FILE_FORMAT,
  MAX_PROJECT_FILE_CHARS,
} from './projectFile.ts';
import { defaultLocation, defaultProject, type Project } from './projectTypes.ts';
import type { SitePlan } from '../domain/sitePlan.ts';

// 1×1 transparent PNG — a real, decodable image, small enough to read.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function projectWithMap(): Project {
  const p = defaultProject();
  const plan: SitePlan = {
    image: { dataUri: PNG_1PX, widthPx: 1, heightPx: 1, fileName: 'ground-floor.png' },
    calibration: { a: { x: 0, y: 0 }, b: { x: 300, y: 400 }, metres: 25 },
    devices: [
      { kind: 'nvr', id: 'nvr-1', label: 'Comms room', x: 10, y: 20 },
      { kind: 'switch', id: 'sw-1', label: 'IDF east', x: 200, y: 20, runMetresOverride: null },
      { kind: 'camera', id: 'cam-1', locationId: 'loc-1', index: 1, x: 250, y: 300, rotationDeg: 135, connectTo: 'sw-1', runMetresOverride: null },
    ],
    routes: [{ id: 'r-1', fromId: 'cam-1', toId: 'sw-1', waypoints: [{ x: 250, y: 20 }] }],
  };
  return {
    ...p,
    name: 'Warehouse / Phase 2',
    locations: [defaultLocation('loc-1', 'Gate'), defaultLocation('loc-2', 'Dock')],
    settings: { ...p.settings, storage: { ...p.settings.storage, raidLevel: '5', hotSpare: true } },
    sitePlan: plan,
  };
}

function reparse(o: unknown) {
  return parseProjectFile(JSON.stringify(o));
}

describe('project file save/open (K3)', () => {
  it('round-trips a project with an embedded plan image exactly', () => {
    const p = projectWithMap();
    const text = serializeProjectFile(p, 'imperial');
    const result = parseProjectFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.opened.units).toBe('imperial');
    expect(result.opened.project).toEqual(p);
    expect(result.notices).toEqual([]);
    // Saving the opened project gives the same bytes: nothing is lost or added.
    expect(serializeProjectFile(result.opened.project, 'imperial')).toBe(text);
  });

  it('opens a file without a site plan as an empty plan', () => {
    const p = defaultProject();
    const doc = JSON.parse(serializeProjectFile(p, 'metric')) as Record<string, unknown>;
    delete doc.sitePlan;
    const result = reparse(doc);
    expect(result.ok && result.opened.project.sitePlan.devices.length).toBe(0);
  });

  it('rejects junk, a foreign JSON file and a newer version with a reason', () => {
    const empty = parseProjectFile('');
    expect(!empty.ok && empty.reason).toMatch(/empty/);
    const truncated = parseProjectFile(serializeProjectFile(defaultProject(), 'metric').slice(0, 50));
    expect(!truncated.ok && truncated.reason).toMatch(/not valid JSON/);
    const foreign = reparse({ hello: 'world' });
    expect(!foreign.ok && foreign.reason).toMatch(/not a ContracTech CCTV project file/);
    const future = reparse({ format: PROJECT_FILE_FORMAT, v: 2 });
    expect(!future.ok && future.reason).toMatch(/version 2/);
  });

  it('rejects a corrupt image data URI, naming the field', () => {
    const doc = JSON.parse(serializeProjectFile(projectWithMap(), 'metric')) as {
      sitePlan: { image: { dataUri: string } };
    };
    doc.sitePlan.image.dataUri = 'data:text/html;base64,PHNjcmlwdD4=';
    const result = reparse(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/sitePlan\.image\.dataUri/);
    expect(result.reason).toMatch(/base64 PNG or JPEG/);
  });

  it('rejects a route to a missing device and a camera on a missing location', () => {
    const doc = JSON.parse(serializeProjectFile(projectWithMap(), 'metric')) as {
      sitePlan: { routes: { toId: string }[]; devices: { kind: string; locationId?: string }[] };
    };
    doc.sitePlan.routes[0]!.toId = 'ghost';
    const badRoute = reparse(doc);
    expect(!badRoute.ok && badRoute.reason).toMatch(/Route refers to a device that does not exist/);

    const doc2 = JSON.parse(serializeProjectFile(projectWithMap(), 'metric')) as typeof doc;
    doc2.sitePlan.devices[2]!.locationId = 'loc-99';
    const badCam = reparse(doc2);
    expect(!badCam.ok && badCam.reason).toMatch(/sitePlan\.devices\.2\.locationId.*loc-99/);
  });

  it('rejects an unknown field, so a typo cannot be silently ignored', () => {
    const doc = { ...(JSON.parse(serializeProjectFile(defaultProject(), 'metric')) as object), extra: 1 };
    const result = reparse(doc);
    expect(!result.ok && result.reason).toMatch(/Unrecognized key/);
  });

  it('refuses an oversized file before parsing it', () => {
    const result = parseProjectFile(' '.repeat(MAX_PROJECT_FILE_CHARS + 1));
    expect(!result.ok && result.reason).toMatch(/limit is 32 MB/);
  });

  it('repairs a dangling active location with a notice', () => {
    const doc = { ...(JSON.parse(serializeProjectFile(defaultProject(), 'metric')) as object), activeLocationId: 'gone' };
    const result = reparse(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.opened.project.activeLocationId).toBe('loc-1');
    expect(result.notices[0]).toMatch(/first location/);
  });

  it('derives a safe file name', () => {
    expect(projectFileName(projectWithMap())).toBe('Warehouse-Phase-2.json');
    expect(projectFileName({ ...defaultProject(), name: '///' })).toBe('cctv-project.json');
  });
});
