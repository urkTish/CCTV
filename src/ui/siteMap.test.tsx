// @vitest-environment jsdom
/**
 * Site map editor and project persistence (M1–M4, M6), driven through the real
 * App without a pointer: the keyboard/list alternative must be able to do
 * everything the map does.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

import App from '../App.tsx';
import { PDF_UNSUPPORTED_MESSAGE } from '../domain/planImage.ts';
import { serializeProjectFile } from '../state/projectFile.ts';
import { defaultLocation, defaultProject } from '../state/projectTypes.ts';
import { URL_EXCLUDES_MAP_NOTICE } from './ProjectFileBar.tsx';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

function pngFile(w: number, h: number, name = 'plan.png'): File {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return new File([b], name, { type: 'image/png' });
}

/** The Main gate row of the site map's device table (other tables list the camera too). */
function deviceRow(label: string): HTMLElement {
  const table = screen.getByRole('table', { name: /Placed devices/ });
  return within(table).getByRole('rowheader', { name: new RegExp(`^${label}`) }).closest('tr')!;
}

function calibrateViaForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Calibrate scale' }));
  // 300-400-500 px line declared as 25 m → 0.05 m/px.
  fireEvent.change(screen.getByLabelText('Point A x (px)'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Point A y (px)'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Point B x (px)'), { target: { value: '300' } });
  fireEvent.change(screen.getByLabelText('Point B y (px)'), { target: { value: '400' } });
  fireEvent.change(screen.getByLabelText('Real length (m)'), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply calibration' }));
}

describe('site map: upload (M1)', () => {
  it('refuses a PDF with the stated reason', async () => {
    render(<App />);
    const input = screen.getByLabelText('Plan image (PNG or JPG)');
    fireEvent.change(input, { target: { files: [new File(['%PDF-1.7'], 'plan.pdf', { type: 'application/pdf' })] } });
    expect((await screen.findByRole('alert')).textContent).toBe(PDF_UNSUPPORTED_MESSAGE);
  });

  it('loads a PNG, reads its size from the file and asks for calibration', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Plan image (PNG or JPG)'), { target: { files: [pngFile(1200, 800)] } });
    expect(await screen.findByText(/Loaded plan\.png \(1200 × 800 px\)\. Now calibrate the scale\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove image' })).toBeTruthy();
    expect(screen.getByLabelText('Point A x (px)')).toBeTruthy();
  });
});

describe('site map: calibration (M2)', () => {
  it('sets the scale from the list alternative and shows it', () => {
    render(<App />);
    expect(screen.getByTestId('plan-scale').textContent).toMatch(/not calibrated/);
    calibrateViaForm();
    expect(screen.getByTestId('plan-scale').textContent).toBe('1 px = 0.05 m · 100 px = 5 m');
    expect(screen.getByRole('button', { name: 'Recalibrate' })).toBeTruthy();
  });

  it('refuses a zero-length line with a message instead of crashing', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Calibrate scale' }));
    for (const l of ['Point A x (px)', 'Point A y (px)', 'Point B x (px)', 'Point B y (px)']) {
      fireEvent.change(screen.getByLabelText(l), { target: { value: '5' } });
    }
    fireEvent.change(screen.getByLabelText('Real length (m)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply calibration' }));
    expect(screen.getByRole('alert').textContent).toMatch(/zero length/);
  });
});

describe('site map: devices, cones and routes (M3–M4)', () => {
  it('places devices from the keyboard and draws the FOV cone and the estimated route', () => {
    const { container } = render(<App />);
    calibrateViaForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add NVR / rack' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place Main gate' }));

    const svg = container.querySelector('svg[aria-label^="Site plan"]')!;
    // NVR and camera both at the centre: move the camera from the table.
    fireEvent.change(screen.getByLabelText('x of Main gate (px)'), { target: { value: '100' } });
    expect(within(svg as HTMLElement).getByRole('button', { name: /Main gate \(camera\) at 100, 350 px/ })).toBeTruthy();

    // The cone comes from the phase-1 recommendation: a polygon with the apex at the camera.
    const cone = svg.querySelector('polygon');
    expect(cone?.getAttribute('points')?.startsWith('100,350 ')).toBe(true);
    expect(screen.getByText(/horizontal FOV .* out to the 10 m target distance/)).toBeTruthy();

    // No route drawn → dashed straight line, labelled, and the run is flagged.
    expect(within(svg as HTMLElement).getByText('estimated route')).toBeTruthy();
    const row = deviceRow('Main gate');
    expect(within(row).getByText('estimated route')).toBeTruthy();
    // 400 px × 0.05 m/px × 1.3 routing factor = 26 m.
    expect(within(row).getByText('26 m')).toBeTruthy();
    expect(within(row).getByText('Unverified')).toBeTruthy();
  });

  it('edits rotation and a typed run length without a pointer', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Add NVR / rack' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place Main gate' }));
    const facing = screen.getByLabelText(/Facing of Main gate/) as HTMLInputElement;
    fireEvent.change(facing, { target: { value: '-90' } });
    // The typed text stays while editing (NumberInput); the normalised angle shows on blur.
    fireEvent.blur(facing);
    expect(facing.value).toBe('270');

    fireEvent.change(screen.getByLabelText('Typed run length for Main gate'), { target: { value: '55' } });
    const row = deviceRow('Main gate');
    expect(within(row).getByText('55 m')).toBeTruthy();
    expect(within(row).getByText('typed in')).toBeTruthy();
    expect(within(row).queryByText('Unverified')).toBeNull();
  });

  it('moves a focused device with the arrow keys', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Add switch' }));
    const sw = within(container.querySelector('svg[aria-label^="Site plan"]') as HTMLElement).getByRole('button', { name: /Switch 1/ });
    fireEvent.keyDown(sw, { key: 'ArrowRight' });
    // Blank canvas 1000 × 700: one step is 1% of the long side = 10 px.
    expect((screen.getByLabelText('x of Switch 1 (px)') as HTMLInputElement).value).toBe('510');
  });

  it('cables a camera to a switch and removes the switch again', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Add NVR / rack' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add switch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place Main gate' }));
    const select = screen.getByLabelText('Cable Main gate to') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'sw-1' } });
    expect((screen.getByLabelText('Cable Main gate to') as HTMLSelectElement).value).toBe('sw-1');
    const swRow = screen.getByLabelText('Name of Switch 1').closest('tr')!;
    fireEvent.click(within(swRow).getByRole('button', { name: 'Remove' }));
    expect((screen.getByLabelText('Cable Main gate to') as HTMLSelectElement).value).toBe('');
  });

  it('drops a placed camera when its location’s count goes down', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Cameras of this type at this location/, { selector: 'input' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place Main gate #2' }));
    expect(screen.getByLabelText('x of Main gate #2 (px)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Cameras of this type at this location/, { selector: 'input' }), { target: { value: '1' } });
    expect(screen.queryByLabelText('x of Main gate #2 (px)')).toBeNull();
  });
});

describe('project persistence (M6)', () => {
  it('says the link excludes the map, and that autosave is unavailable without IndexedDB', () => {
    render(<App />);
    expect(screen.getByText(URL_EXCLUDES_MAP_NOTICE)).toBeTruthy();
    // jsdom has no IndexedDB: the app must carry on and say so.
    expect(screen.getByText(/Autosave is not available in this browser/)).toBeTruthy();
  });

  it('opens a saved project file, map included', async () => {
    render(<App />);
    const p = defaultProject();
    const saved = serializeProjectFile(
      {
        ...p,
        locations: [defaultLocation('loc-1', 'Dock'), defaultLocation('loc-2', 'Yard')],
        sitePlan: { ...p.sitePlan, devices: [{ kind: 'nvr', id: 'nvr-1', label: 'Comms room', x: 5, y: 5 }] },
      },
      'metric',
    );
    fireEvent.change(screen.getByLabelText('Open project'), { target: { files: [new File([saved], 'site.json')] } });
    expect(await screen.findByText('Opened site.json.')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((t) => t.textContent?.replace(/×\d+$/, ''))).toEqual(['Dock', 'Yard']);
    expect((screen.getByLabelText('Name of Comms room') as HTMLInputElement).value).toBe('Comms room');
  });

  it('refuses a corrupt project file with the reason, keeping the current project', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Open project'), { target: { files: [new File(['{"format":"nope"}'], 'bad.json')] } });
    expect((await screen.findByText(/bad\.json was not opened/)).textContent).toMatch(/not a ContracTech CCTV project file/);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
});
