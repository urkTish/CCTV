// @vitest-environment jsdom
/**
 * Site layout drawing, driven through the real App: the blank "draw a new
 * layout" canvas and its automatic scale, every drawing tool with the pointer,
 * undo / redo, keyboard editing of shapes, the shape list (the no-pointer
 * alternative), cable maths on a drawn layout, the report map, and a project
 * file with drawings opening again.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

import App from '../App.tsx';
import { serializeProjectFile } from '../state/projectFile.ts';
import { defaultProject } from '../state/projectTypes.ts';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

function goTo(section: string) {
  const nav = screen.getByRole('navigation', { name: 'Project sections' });
  fireEvent.click(within(nav).getByRole('button', { name: new RegExp(`^${section.replace(/[()&]/g, '\\$&')}`) }));
}

function mapSvg(container: HTMLElement): SVGSVGElement {
  return container.querySelector('svg[aria-label^="Site plan"]') as SVGSVGElement;
}

/** jsdom has no layout: make the SVG report a box the size of its viewBox, so client px = plan px. */
function mockBox(svg: SVGSVGElement) {
  const [, , w, h] = (svg.getAttribute('viewBox') ?? '0 0 1000 700').split(' ').map(Number);
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: w!, height: h!, right: w!, bottom: h!, toJSON: () => ({}) });
}

/** Render, open the Site map, and start a 40 × 25 m drawn layout (800 × 500 px at 20 px/m). */
function startLayout() {
  const r = render(<App />);
  goTo('Site map');
  fireEvent.click(screen.getByRole('button', { name: 'Draw a new layout' }));
  fireEvent.change(screen.getByLabelText('Site width (m)'), { target: { value: '40' } });
  fireEvent.change(screen.getByLabelText('Site height (m)'), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start drawing' }));
  const svg = mapSvg(r.container);
  mockBox(svg);
  return { ...r, svg };
}

function tool(name: string) {
  fireEvent.click(within(screen.getByRole('group', { name: 'Drawing tool' })).getByRole('button', { name }));
}

function shapeList() {
  return screen.queryByRole('list', { name: 'Drawn shapes' });
}

const down = (el: Element, x: number, y: number, extra: object = {}) => fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, ...extra });
const move = (el: Element, x: number, y: number, extra: object = {}) => fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1, ...extra });
const up = (el: Element) => fireEvent.pointerUp(el, { pointerId: 1 });

describe('draw a new layout (blank canvas)', () => {
  it('sets the scale from the site size, shows the grid and opens the rectangle tool', () => {
    const { svg } = startLayout();
    expect(svg.getAttribute('viewBox')).toBe('0 0 800 500');
    expect(screen.getByTestId('plan-scale').textContent).toBe('1 px = 0.05 m · 100 px = 5 m');
    expect(screen.getByTestId('layout-grid')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Drawing tool' })).getByRole('button', { name: 'Rectangle' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toMatch(/Drawn layout 40 × 25 m, grid 1 m/);
    expect(screen.getByRole('button', { name: 'Layout size: 40 × 25 m' })).toBeTruthy();
  });

  it('refuses a size outside the limits with a message', () => {
    render(<App />);
    goTo('Site map');
    fireEvent.click(screen.getByRole('button', { name: 'Draw a new layout' }));
    fireEvent.change(screen.getByLabelText('Site width (m)'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start drawing' }));
    expect(screen.getByRole('alert').textContent).toMatch(/between 2 and 1000 m/);
  });

  it('measures cable runs on the drawn layout like on a calibrated plan', () => {
    startLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Add NVR / rack' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place Main gate' }));
    fireEvent.change(screen.getByLabelText('x of Main gate (px)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('y of Main gate (px)'), { target: { value: '250' } });
    // NVR at the centre (400, 250): 400 px = 20 m straight × 1.3 routing factor = 26 m.
    const table = screen.getByRole('table', { name: /Placed devices/ });
    const row = within(table).getByRole('rowheader', { name: /^Main gate/ }).closest('tr')!;
    expect(within(row).getByText('26 m')).toBeTruthy();
    expect(within(row).getByText('estimated route')).toBeTruthy();
  });
});

describe('drawing tools with the pointer', () => {
  it('draws a room by dragging, a square with Shift, and selects it', () => {
    const { svg } = startLayout();
    down(svg, 100, 100);
    move(svg, 220, 183); // snaps to the 1 m (20 px) grid → 120 × 80 px = 6 × 4 m
    expect(screen.getByTestId('draw-draft').textContent).toBe('6 m × 4 m');
    up(svg);
    expect(within(shapeList()!).getByText(/Room 6\.0 × 4\.0 m/)).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Selected shape' })).toBeTruthy();
    expect(screen.getByTestId('shape-measure').textContent).toMatch(/Perimeter: 20 m · Area: 24 m²/);

    down(svg, 400, 100);
    move(svg, 500, 140, { shiftKey: true });
    up(svg);
    expect(within(shapeList()!).getByText(/Room 5\.0 × 5\.0 m/)).toBeTruthy();
  });

  it('draws a wall from clicks, constrained by Shift, and finishes it', () => {
    const { svg } = startLayout();
    tool('Line / wall');
    down(svg, 100, 100);
    up(svg);
    down(svg, 300, 108, { shiftKey: true }); // kept horizontal
    up(svg);
    fireEvent.click(screen.getByRole('button', { name: /Finish line \(2 points\)/ }));
    expect(within(shapeList()!).getByText(/Wall 10\.0 m/)).toBeTruthy();
  });

  it('draws a curved fence and closes a curve by clicking the first point', () => {
    const { svg } = startLayout();
    tool('Curve');
    for (const [x, y] of [
      [100, 400],
      [300, 440],
      [500, 400],
    ] as const) {
      down(svg, x, y);
      up(svg);
    }
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(within(shapeList()!).getByText(/^Curved fence/)).toBeTruthy();
    const path = svg.querySelector('[data-shape-id="curve-1"] path')!;
    expect(path.getAttribute('d')).toMatch(/^M100,400 C/);

    for (const [x, y] of [
      [600, 100],
      [700, 100],
      [700, 200],
      [600, 100],
    ] as const) {
      down(svg, x, y);
      up(svg);
    }
    expect(within(shapeList()!).getByText(/^Curved fence outline/)).toBeTruthy();
    expect(svg.querySelector('[data-shape-id="curve-2"] path')!.getAttribute('d')).toMatch(/ Z$/);
  });

  it('places a door by dragging along a wall and a gate by a click', () => {
    const { svg } = startLayout();
    tool('Door / window / gate');
    down(svg, 100, 100);
    move(svg, 100, 118);
    up(svg);
    // 18 px snapped to 20 px = 1 m, turned to run down the wall.
    expect(within(shapeList()!).getByText('Door 1.00 m')).toBeTruthy();
    expect((screen.getByLabelText('Rotation of opening-1 (degrees)') as HTMLInputElement).value).toBe('90');
    fireEvent.click(screen.getByRole('button', { name: 'Flip the swing of opening-1' }));
    expect(screen.getByRole('button', { name: 'Flip the swing of opening-1' }).textContent).toMatch(/down \/ right/);

    fireEvent.change(screen.getByLabelText('Opening'), { target: { value: 'gate' } });
    down(svg, 400, 480);
    up(svg);
    expect(within(shapeList()!).getByText('Gate 4.00 m')).toBeTruthy();
  });

  it('places a label, and asks for the text first', () => {
    const { svg } = startLayout();
    tool('Label');
    down(svg, 200, 200);
    up(svg);
    expect(screen.getByRole('alert').textContent).toMatch(/Type the label text/);
    fireEvent.change(screen.getByLabelText('Label text'), { target: { value: 'Reception' } });
    down(svg, 200, 200);
    up(svg);
    expect(within(svg as unknown as HTMLElement).getByText('Reception')).toBeTruthy();
    expect(within(shapeList()!).getByText('Label “Reception”')).toBeTruthy();
  });

  it('moves and resizes a selected shape with the pointer, then undoes and redoes it', () => {
    const { svg } = startLayout();
    down(svg, 100, 100);
    move(svg, 200, 200);
    up(svg);
    tool('Rectangle'); // still active; switch to select via the device toolbar
    fireEvent.click(within(screen.getByRole('group', { name: 'Map tool' })).getByRole('button', { name: 'Select / move' }));
    const g = svg.querySelector('[data-shape-id="area-1"]')!;
    down(g, 150, 150);
    move(svg, 190, 170);
    up(svg);
    expect((screen.getByLabelText('x of area-1 (px)') as HTMLInputElement).value).toBe('190');
    expect((screen.getByLabelText('y of area-1 (px)') as HTMLInputElement).value).toBe('170');

    // Corner 3 (bottom-right) dragged out: opposite corner stays at (140, 120).
    const corner = within(screen.getByTestId('shape-handles')).getByLabelText('Resize corner 3');
    down(corner, 240, 220);
    move(svg, 300, 260);
    up(svg);
    expect((screen.getByLabelText('Width of area-1 (m)') as HTMLInputElement).value).toBe('8');
    expect((screen.getByLabelText('Height of area-1 (m)') as HTMLInputElement).value).toBe('7');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect((screen.getByLabelText('Width of area-1 (m)') as HTMLInputElement).value).toBe('5');
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect((screen.getByLabelText('x of area-1 (px)') as HTMLInputElement).value).toBe('150');
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect((screen.getByLabelText('x of area-1 (px)') as HTMLInputElement).value).toBe('190');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect((screen.getByLabelText('Width of area-1 (m)') as HTMLInputElement).value).toBe('8');
  });

  it('lock drawing lets the pointer through to place devices over a room', () => {
    const { svg } = startLayout();
    down(svg, 100, 100);
    move(svg, 500, 400);
    up(svg);
    fireEvent.click(screen.getByLabelText('Lock drawing'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Map tool' })).getByRole('button', { name: 'Select / move' }));
    const g = svg.querySelector('[data-shape-id="area-1"]')!;
    expect(g.getAttribute('pointer-events')).toBe('none');
    // No child may re-enable the pointer (an explicit pointer-events on a child overrides the group's).
    expect([...g.querySelectorAll('[pointer-events]')].map((el) => el.getAttribute('pointer-events')).filter((v) => v !== 'none')).toEqual([]);
    expect(screen.queryByTestId('shape-handles')).toBeNull();
  });
});

describe('shapes from the keyboard', () => {
  it('nudges a focused shape by one grid square, rotates with ] and deletes with Delete', () => {
    const { svg } = startLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Add room / rectangle' }));
    const g = within(svg as unknown as HTMLElement).getByRole('button', { name: /^Room 6\.0 × 4\.0 m \(area-1\)/ });
    fireEvent.keyDown(g, { key: 'ArrowRight' });
    expect((screen.getAllByLabelText('x of area-1 (px)')[0] as HTMLInputElement).value).toBe('420');
    fireEvent.keyDown(g, { key: ']' });
    expect((screen.getAllByLabelText('Rotation of area-1 (degrees)')[0] as HTMLInputElement).value).toBe('15');
    fireEvent.keyDown(g, { key: 'Delete' });
    expect(shapeList()).toBeNull();
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(within(shapeList()!).getByText(/Room 6\.0 × 4\.0 m/)).toBeTruthy();
  });
});

describe('drawn layout list (no pointer)', () => {
  it('adds every kind of shape and edits size, points, text and style', () => {
    startLayout();
    for (const label of ['room / rectangle', 'line / wall', 'curve', 'door', 'double door', 'window', 'gate', 'label']) {
      fireEvent.click(screen.getByRole('button', { name: `Add ${label}` }));
    }
    const list = shapeList()!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);

    // The last added (the label) is open for editing.
    const text = within(list).getByLabelText('Text of label-1');
    fireEvent.change(text, { target: { value: 'Car park' } });
    expect(within(list).getByText('Label “Car park”')).toBeTruthy();

    fireEvent.click(within(list).getByRole('button', { name: /^Edit Room 6\.0 × 4\.0 m/ }));
    fireEvent.change(within(list).getByLabelText('Width of area-1 (m)'), { target: { value: '12.5' } });
    fireEvent.change(within(list).getByLabelText('Fill of area-1'), { target: { value: 'car-park' } });
    expect(within(list).getByText(/Car park 12\.5 × 4\.0 m/)).toBeTruthy();

    fireEvent.click(within(list).getByRole('button', { name: /^Edit Wall 6\.0 m/ }));
    const pts = within(list).getByLabelText('Points of line-1');
    fireEvent.change(pts, { target: { value: '0,0 nonsense' } });
    fireEvent.blur(pts);
    expect(within(list).getByRole('alert').textContent).toMatch(/"nonsense" is not a point/);
    fireEvent.change(pts, { target: { value: '0,0 200,0 200,100' } });
    fireEvent.blur(pts);
    expect(within(list).getByText(/Wall 15\.0 m/)).toBeTruthy();
    fireEvent.change(within(list).getByLabelText('Line style of line-1'), { target: { value: 'fence' } });
    expect(within(list).getByText(/Fence 15\.0 m/)).toBeTruthy();

    fireEvent.click(within(list).getByRole('button', { name: /^Delete Fence 15\.0 m/ }));
    expect(within(shapeList()!).getAllByRole('listitem')).toHaveLength(7);
  });

  it('works over an uncalibrated plan too, in pixels', () => {
    render(<App />);
    goTo('Site map');
    fireEvent.click(screen.getByRole('button', { name: 'Add room / rectangle' }));
    expect(within(shapeList()!).getByText(/Room 120 × 80 px/)).toBeTruthy();
    expect(screen.getAllByText(/set the scale to see metres/).length).toBeGreaterThan(0);
  });
});

describe('drawn layout in the report and the project file', () => {
  it('draws the layout on the report map', () => {
    startLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Add room / rectangle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    fireEvent.change(screen.getByLabelText('Text of label-1'), { target: { value: 'Warehouse' } });
    goTo('Report');
    const report = screen.getByRole('article', { name: 'Client report' });
    const map = within(report).getByRole('img', { name: /^Site plan with/ });
    expect(within(map).getByText('Warehouse')).toBeTruthy();
    expect(map.getAttribute('viewBox')).toBe('0 0 800 500');
  });

  it('opens a project file with a drawn layout', async () => {
    render(<App />);
    const p = defaultProject();
    const saved = serializeProjectFile(
      {
        ...p,
        sitePlan: {
          ...p.sitePlan,
          calibration: { a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, metres: 30 },
          layout: {
            canvas: { widthMetres: 30, heightMetres: 20 },
            gridMetres: 1,
            shapes: [{ kind: 'text', id: 'label-1', x: 100, y: 100, text: 'Gatehouse', sizePx: 12, rotationDeg: 0 }],
          },
        },
      },
      'metric',
    );
    fireEvent.change(screen.getByLabelText('Open project'), { target: { files: [new File([saved], 'drawn.json')] } });
    expect(await screen.findByText('Opened drawn.json.')).toBeTruthy();
    goTo('Site map');
    expect(within(shapeList()!).getByText('Label “Gatehouse”')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Layout size: 30 × 20 m' })).toBeTruthy();
  });
});
