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
import { EMPTY_LAYOUT, type SiteLayout } from '../domain/layoutShapes.ts';
import { hasSiteMap } from './autosave.ts';

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

  it('drops a placed camera numbered beyond its location\'s count, with a notice', () => {
    const doc = JSON.parse(serializeProjectFile(projectWithMap(), 'metric')) as {
      sitePlan: { devices: { kind: string; index?: number }[] };
    };
    doc.sitePlan.devices[2]!.index = 7; // loc-1 has 1 camera
    const result = reparse(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.opened.project.sitePlan.devices.map((d) => d.id)).toEqual(['nvr-1', 'sw-1']);
    expect(result.opened.project.sitePlan.routes).toEqual([]);
    expect(result.notices[0]).toMatch(/1 placed camera/);
  });

  it('derives a safe file name', () => {
    expect(projectFileName(projectWithMap())).toBe('Warehouse-Phase-2.json');
    expect(projectFileName({ ...defaultProject(), name: '///' })).toBe('cctv-project.json');
  });
});

describe('project file: drawn site layout (schema extension)', () => {
  const layout: SiteLayout = {
    canvas: { widthMetres: 40, heightMetres: 25 },
    gridMetres: 0.5,
    shapes: [
      { kind: 'rect', id: 'area-1', cx: 200, cy: 150, width: 300, height: 200, rotationDeg: 0, stroke: 'wall', fill: 'building' },
      { kind: 'polyline', id: 'line-1', points: [{ x: 50, y: 50 }, { x: 350, y: 50 }], closed: false, stroke: 'partition', fill: 'none' },
      { kind: 'curve', id: 'curve-1', points: [{ x: 0, y: 400 }, { x: 300, y: 450 }, { x: 790, y: 400 }], closed: false, stroke: 'fence', fill: 'none' },
      { kind: 'opening', id: 'opening-1', variant: 'door', cx: 200, cy: 250, widthMetres: 0.9, rotationDeg: 0, flip: true },
      { kind: 'text', id: 'label-1', x: 200, y: 150, text: 'Warehouse', sizePx: 24, rotationDeg: 0 },
    ],
  };

  function drawnProject(): Project {
    const p = defaultProject();
    return {
      ...p,
      sitePlan: {
        image: null,
        calibration: { a: { x: 0, y: 0 }, b: { x: 800, y: 0 }, metres: 40 },
        devices: [{ kind: 'nvr', id: 'nvr-1', label: 'Rack', x: 100, y: 100 }],
        routes: [],
        layout,
      },
    };
  }

  it('round-trips a drawn layout exactly, and re-saves byte-identically', () => {
    const p = drawnProject();
    const text = serializeProjectFile(p, 'metric');
    const result = parseProjectFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.opened.project).toEqual(p);
    expect(serializeProjectFile(result.opened.project, 'metric')).toBe(text);
  });

  it('opens an old file (no layout key) with no layout, and saves it without one', () => {
    const old = serializeProjectFile(projectWithMap(), 'metric');
    expect(old).not.toMatch(/"layout"/);
    const result = parseProjectFile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('layout' in result.opened.project.sitePlan).toBe(false);
    expect(serializeProjectFile(result.opened.project, 'metric')).toBe(old);
  });

  it('leaves an empty layout out of the file, so it still opens in an older copy of the app', () => {
    const p = projectWithMap();
    const withEmpty = { ...p, sitePlan: { ...p.sitePlan, layout: EMPTY_LAYOUT } };
    expect(serializeProjectFile(withEmpty, 'metric')).toBe(serializeProjectFile(p, 'metric'));
  });

  it('rejects a corrupt shape, naming the field', () => {
    const doc = JSON.parse(serializeProjectFile(drawnProject(), 'metric')) as {
      sitePlan: { layout: { shapes: Record<string, unknown>[] } };
    };
    doc.sitePlan.layout.shapes[3]!.widthMetres = -2;
    const result = reparse(doc);
    expect(!result.ok && result.reason).toMatch(/sitePlan\.layout\.shapes\.3\.widthMetres/);
  });

  it('offers a drawn layout without devices for autosave restore', () => {
    const p = drawnProject();
    expect(hasSiteMap({ ...p, sitePlan: { ...p.sitePlan, devices: [] } })).toBe(true);
    expect(hasSiteMap(defaultProject())).toBe(false);
  });
});
