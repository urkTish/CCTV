// @vitest-environment jsdom
/**
 * Site layout drawing, driven through the real App: "draw a new layout" from
 * the place's size (automatic canvas, grid, margins and scale, the place drawn
 * for the engineer), adding margin later, every drawing tool with the pointer,
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

/** Fill in "Draw a new layout" with the place's size (and name) and draw it. */
function drawPlace(width: string, depth: string, name?: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Draw a new layout' }));
  fireEvent.change(screen.getByLabelText('Place width (m)'), { target: { value: width } });
  fireEvent.change(screen.getByLabelText('Place depth (m)'), { target: { value: depth } });
  if (name !== undefined) fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Draw layout' }));
}

/** Render, open the Site map, and draw a place of `width × depth` m; the SVG reports a box the size of its viewBox. */
function startPlace(width: string, depth: string, name?: string) {
  const r = render(<App />);
  goTo('Site map');
  drawPlace(width, depth, name);
  const svg = mapSvg(r.container);
  mockBox(svg);
  return { ...r, svg };
}

/**
 * A blank 40 × 25 m drawn layout (800 × 500 px at 20 px/m, grid 1 m) with the
 * rectangle tool: a 20 × 5 m place gets 10 m of margin each side; the place
 * and its label drawn for us are deleted from the shape list, so the drawing
 * tests start from an empty canvas.
 */
function startLayout() {
  const r = startPlace('20', '5');
  for (const name of [/^Delete Label “Building”/, /^Delete Building 20\.0 × 5\.0 m/]) {
    fireEvent.click(within(shapeList()!).getByRole('button', { name }));
  }
  expect(shapeList()).toBeNull();
  tool('Rectangle');
  return r;
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

describe('draw a new layout (from the place size)', () => {
  it('asks only for the place, shows the canvas it will get, and draws the place centred with its name', () => {
    render(<App />);
    goTo('Site map');
    fireEvent.click(screen.getByRole('button', { name: 'Draw a new layout' }));
    // No canvas size and no grid field: only the place and its name.
    expect(screen.queryByLabelText(/Canvas width|Site width|Grid square/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Place width (m)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Place depth (m)'), { target: { value: '6' } });
    expect(screen.getByTestId('auto-canvas-preview').textContent).toBe('Canvas 20 × 16 m · grid 1 m · at least 5 m around the place');
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Workshop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draw layout' }));

    const svg = mapSvg(document.body);
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 320');
    expect(screen.getByTestId('plan-scale').textContent).toBe('1 px = 0.05 m · 100 px = 5 m');
    expect(screen.getByTestId('layout-grid')).toBeTruthy();
    expect(screen.getByTestId('canvas-readout').textContent).toBe('Canvas 20 × 16 m · grid 1 m');
    expect(screen.getByRole('button', { name: 'Layout size: 20 × 16 m' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/^Workshop 10 × 6 m drawn in the middle of the canvas\. Canvas 20 × 16 m · grid 1 m, at least 5 m of margin/);

    // The place: a closed building rectangle centred on the canvas, and its name; selected, ready to edit.
    const list = shapeList()!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText(/^Building 10\.0 × 6\.0 m/)).toBeTruthy();
    expect(within(list).getByText('Label “Workshop”')).toBeTruthy();
    expect(within(svg as unknown as HTMLElement).getByText('Workshop')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Selected shape' })).toBeTruthy();
    expect((screen.getAllByLabelText('x of area-1 (px)')[0] as HTMLInputElement).value).toBe('200');
    expect((screen.getAllByLabelText('y of area-1 (px)')[0] as HTMLInputElement).value).toBe('160');
    expect(screen.getByTestId('shape-measure').textContent).toMatch(/Perimeter: 32 m · Area: 60 m²/);
    expect(within(screen.getByRole('group', { name: 'Map tool' })).getByRole('button', { name: 'Select / move' }).getAttribute('aria-pressed')).toBe('true');

    // One undo step takes it all away; redo brings it all back.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(shapeList()).toBeNull();
    expect(screen.getByRole('button', { name: 'Draw a new layout' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(within(shapeList()!).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('canvas-readout').textContent).toBe('Canvas 20 × 16 m · grid 1 m');
  });

  it('names the place "Building" by default and picks the grid by size: 3 × 3 m and 120 × 80 m', () => {
    render(<App />);
    goTo('Site map');
    fireEvent.click(screen.getByRole('button', { name: 'Draw a new layout' }));
    fireEvent.change(screen.getByLabelText('Place width (m)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Place depth (m)'), { target: { value: '3' } });
    expect(screen.getByTestId('auto-canvas-preview').textContent).toBe('Canvas 13 × 13 m · grid 0.5 m · at least 5 m around the place');
    fireEvent.change(screen.getByLabelText('Place width (m)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Place depth (m)'), { target: { value: '80' } });
    expect(screen.getByTestId('auto-canvas-preview').textContent).toBe('Canvas 240 × 200 m · grid 5 m · at least 60 m around the place');
    fireEvent.click(screen.getByRole('button', { name: 'Draw layout' }));
    expect(mapSvg(document.body).getAttribute('viewBox')).toBe('0 0 4800 4000');
    expect(screen.getByTestId('canvas-readout').textContent).toBe('Canvas 240 × 200 m · grid 5 m');
    expect(within(shapeList()!).getByText('Label “Building”')).toBeTruthy();
    expect(within(shapeList()!).getByText(/^Building 120\.0 × 80\.0 m/)).toBeTruthy();
  });

  it('refuses a place outside the limits with a message', () => {
    render(<App />);
    goTo('Site map');
    fireEvent.click(screen.getByRole('button', { name: 'Draw a new layout' }));
    fireEvent.change(screen.getByLabelText('Place width (m)'), { target: { value: '0.5' } });
    expect(screen.getByTestId('auto-canvas-preview').textContent).toMatch(/place width must be between 1 and 500 m/);
    fireEvent.click(screen.getByRole('button', { name: 'Draw layout' }));
    expect(screen.getByRole('alert').textContent).toMatch(/place width must be between 1 and 500 m/);
    expect(shapeList()).toBeNull();
  });

  it('adds margin later on one side without moving anything relative to anything else', () => {
    startPlace('10', '6');
    fireEvent.click(screen.getByRole('button', { name: 'Add NVR / rack' })); // at the centre (200, 160)
    fireEvent.click(screen.getByRole('button', { name: 'Place Main gate' }));
    fireEvent.change(screen.getByLabelText('x of Main gate (px)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('y of Main gate (px)'), { target: { value: '160' } });
    fireEvent.blur(screen.getByLabelText('x of Main gate (px)'));
    fireEvent.blur(screen.getByLabelText('y of Main gate (px)'));
    // 200 px = 10 m straight × 1.3 routing factor = 13 m on the generated scale.
    const runOf = () => within(within(screen.getByRole('table', { name: /Placed devices/ })).getByRole('rowheader', { name: /^Main gate/ }).closest('tr')!);
    expect(runOf().getByText('13 m')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Layout size: 20 × 16 m' }));
    expect(screen.getByTestId('canvas-panel-readout').textContent).toBe('Canvas 20 × 16 m · grid 1 m');
    fireEvent.change(screen.getByLabelText('Add (m)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('On'), { target: { value: 'left' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add margin' }));
    expect(mapSvg(document.body).getAttribute('viewBox')).toBe('0 0 500 320');
    expect(screen.getByTestId('canvas-readout').textContent).toBe('Canvas 25 × 16 m · grid 1 m');
    expect(screen.getByRole('status').textContent).toMatch(/Added 5 m on the left/);
    // Everything moved 5 m (100 px) right together; the run is unchanged.
    expect((screen.getAllByLabelText('x of area-1 (px)')[0] as HTMLInputElement).value).toBe('300');
    expect((screen.getByLabelText('x of Main gate (px)') as HTMLInputElement).value).toBe('100');
    expect(runOf().getByText('13 m')).toBeTruthy();
    // One undo step.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('canvas-readout').textContent).toBe('Canvas 20 × 16 m · grid 1 m');
  });

  it('offers to extend the canvas when a shape reaches past its edge', () => {
    startPlace('10', '6');
    fireEvent.click(screen.getByRole('button', { name: 'Add line / wall' }));
    const pts = within(shapeList()!).getByLabelText('Points of line-1');
    fireEvent.change(pts, { target: { value: '-40,10 470,10' } });
    fireEvent.blur(pts);
    fireEvent.click(screen.getByRole('button', { name: 'Extend canvas to fit' }));
    // left 2 m → 3 m, right 3.5 m → 5 m (whole squares plus one).
    expect(screen.getByTestId('canvas-readout').textContent).toBe('Canvas 28 × 16 m · grid 1 m');
    expect(screen.queryByRole('button', { name: 'Extend canvas to fit' })).toBeNull();
    expect((within(shapeList()!).getByLabelText('Points of line-1') as HTMLTextAreaElement).value).toBe('20,10 530,10');
  });

  it('sets an exact canvas size and grid under Advanced', () => {
    startPlace('10', '6');
    fireEvent.click(screen.getByRole('button', { name: 'Layout size: 20 × 16 m' }));
    fireEvent.change(screen.getByLabelText('Canvas width (m)'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Grid square (m)'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply size' }));
    expect(screen.getByTestId('canvas-readout').textContent).toBe('Canvas 30 × 16 m · grid 0.5 m');
    expect((screen.getAllByLabelText('x of area-1 (px)')[0] as HTMLInputElement).value).toBe('200');
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
    // Opens unchanged: same canvas, grid and shapes; no generated outline is added.
    expect(screen.getByTestId('canvas-readout').textContent).toBe('Canvas 30 × 20 m · grid 1 m');
    expect(within(shapeList()!).getAllByRole('listitem')).toHaveLength(1);
    expect(mapSvg(document.body).getAttribute('viewBox')).toBe('0 0 600 400');
  });
});
