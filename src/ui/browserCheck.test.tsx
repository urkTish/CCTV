// @vitest-environment jsdom
/**
 * Regressions found by the real-browser check (Chromium, 2026-10-05).
 *
 * 1. Number fields whose owner refuses a non-number snapped back to the stored
 *    value as soon as they were emptied, so clearing "305" and typing "3" produced
 *    "3053", and "-" could not be typed. `NumberInput` keeps the typed text while
 *    the field has focus.
 * 2. In the dark theme the site-map markers used the near-white dark-theme ink
 *    over the (white) plan image, so drawn routes and the NVR marker vanished. The
 *    SVG takes the `plan-on-image` class, which keeps the light palette (index.css).
 *
 * The other fixes from that check are layout-only (page overflow on a phone, the
 * OSM scale bar under the attribution) and cannot be measured in jsdom.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

import App from '../App.tsx';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

function input(label: string | RegExp): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('number fields keep what is being typed', () => {
  it('a design setting can be emptied and retyped; the stored value returns on blur', () => {
    render(<App />);
    const box = input(/^Cable box length/);
    expect(box.value).toBe('305');

    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: '' } });
    expect(box.value).toBe(''); // was snapped back to "305"
    fireEvent.change(box, { target: { value: '500' } });
    expect(box.value).toBe('500');

    // Out of range: shown as typed while editing, the clamped value after blur.
    const growth = input(/^Growth headroom/);
    fireEvent.focus(growth);
    fireEvent.change(growth, { target: { value: '900' } });
    expect(growth.value).toBe('900');
    fireEvent.blur(growth);
    expect(Number(growth.value)).toBeLessThan(900);

    // An emptied field that is left reverts to the stored value.
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.blur(box);
    expect(box.value).toBe('500');
  });

  it('the camera count can be emptied and retyped', () => {
    render(<App />);
    const count = input(/^Cameras of this type at this location/);
    fireEvent.focus(count);
    fireEvent.change(count, { target: { value: '' } });
    expect(count.value).toBe('');
    fireEvent.change(count, { target: { value: '3' } });
    fireEvent.blur(count);
    expect(count.value).toBe('3');
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('×3');
  });

  it('the site-map device table keeps an emptied coordinate and takes the retyped one', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Place Main gate' }));
    const table = screen.getByRole('table', { name: /Placed devices/ });
    const x = within(table).getByLabelText('x of Main gate (px)') as HTMLInputElement;
    const before = x.value;

    fireEvent.focus(x);
    fireEvent.change(x, { target: { value: '' } });
    expect(x.value).toBe(''); // was snapped back to the old x
    fireEvent.change(x, { target: { value: '120' } });
    fireEvent.blur(x);
    expect(x.value).toBe('120');
    expect(before).not.toBe('120');
    expect(screen.getByRole('button', { name: /^Main gate \(camera\) at 120,/ })).toBeTruthy();

    // A typed run keeps its decimals while typing.
    const run = within(table).getByLabelText('Typed run length for Main gate') as HTMLInputElement;
    fireEvent.focus(run);
    fireEvent.change(run, { target: { value: '12.05' } });
    expect(run.value).toBe('12.05');
  });
});

function pngFile(w: number, h: number): File {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return new File([b], 'plan.png', { type: 'image/png' });
}

describe('site-map markers over a plan image', () => {
  it('keep the light palette only when a plan image is shown', async () => {
    render(<App />);
    const svg = () => screen.getByRole('group', { name: /^Site plan/ });
    expect(svg().getAttribute('class')).toBeNull();
    fireEvent.change(screen.getByLabelText('Plan image (PNG or JPG)'), { target: { files: [pngFile(1200, 800)] } });
    await screen.findByText(/Loaded plan\.png/);
    expect(svg().getAttribute('class')).toBe('plan-on-image');
  });
});
