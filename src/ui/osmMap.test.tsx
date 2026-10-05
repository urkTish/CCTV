// @vitest-environment jsdom
/**
 * OpenStreetMap reference view (M5), driven through the real App. jsdom cannot
 * render a Leaflet map, so the lazily imported Leaflet module is mocked: these
 * tests check what the engineer sees around it — off by default, the lazy load,
 * the attribution, the offline / failure messages, and the measured length
 * feeding the calibration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

import App from '../App.tsx';
import { OSM_COPYRIGHT_URL, OSM_OFFLINE_MESSAGE } from '../domain/osmMap.ts';
import type { OsmMapHandle, OsmMapOptions } from './osmLeaflet.ts';

const leaflet = vi.hoisted(() => {
  const handle = { destroy: vi.fn(), clearMeasure: vi.fn(), redraw: vi.fn() };
  return {
    handle,
    mountOsmMap: vi.fn<(el: HTMLElement, o: OsmMapOptions) => OsmMapHandle>(() => handle),
  };
});
vi.mock('./osmLeaflet.ts', () => ({ mountOsmMap: leaflet.mountOsmMap }));

const toggle = () => screen.getByRole('checkbox', { name: 'Show OpenStreetMap (online)' }) as HTMLInputElement;

/** Turn the map on and wait for the (mocked) lazy module to mount it. */
async function turnOn(): Promise<OsmMapOptions> {
  fireEvent.click(toggle());
  await waitFor(() => expect(leaflet.mountOsmMap).toHaveBeenCalledTimes(1));
  return leaflet.mountOsmMap.mock.calls[0]![1];
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  leaflet.mountOsmMap.mockClear();
  leaflet.handle.destroy.mockClear();
  leaflet.handle.redraw.mockClear();
  setOnline(true);
});
afterEach(cleanup);

describe('OpenStreetMap mode (M5)', () => {
  it('is off by default: no map, no Leaflet loaded', async () => {
    render(<App />);
    expect(toggle().checked).toBe(false);
    expect(screen.queryByRole('region', { name: 'OpenStreetMap reference map' })).toBeNull();
    expect(screen.queryByTestId('osm-attribution')).toBeNull();
    // Give any stray import a chance to resolve before asserting it never happened.
    await act(async () => {});
    expect(leaflet.mountOsmMap).not.toHaveBeenCalled();
  });

  it('lazy-loads Leaflet when turned on, with attribution on the map, and removes it when turned off', async () => {
    render(<App />);
    const opts = await turnOn();
    const region = screen.getByRole('region', { name: 'OpenStreetMap reference map' });
    expect(leaflet.mountOsmMap.mock.calls[0]![0]).toBe(region);
    expect(opts.view).toEqual({ lat: 20, lng: 0, zoom: 2 });

    const attribution = screen.getByTestId('osm-attribution');
    expect(attribution.textContent).toMatch(/^© OpenStreetMap contributors/);
    const link = screen.getByRole('link', { name: 'OpenStreetMap' });
    expect(link.getAttribute('href')).toBe(OSM_COPYRIGHT_URL);
    expect(attribution.contains(link)).toBe(true);
    expect(screen.getByRole('link', { name: 'Report a map issue' }).getAttribute('href')).toBe('https://www.openstreetmap.org/fixthemap');
    expect(screen.queryByText('Loading the map…')).toBeNull();

    fireEvent.click(toggle());
    expect(leaflet.handle.destroy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('osm-attribution')).toBeNull();
  });

  it('comes back to the last view when turned off and on again', async () => {
    render(<App />);
    const opts = await turnOn();
    opts.onViewChange({ lat: 51.5, lng: -0.12, zoom: 17 });
    fireEvent.click(toggle());
    leaflet.mountOsmMap.mockClear();
    const again = await turnOn();
    expect(again.view).toEqual({ lat: 51.5, lng: -0.12, zoom: 17 });
  });

  it('says so when the browser is offline, and re-requests the tiles when it is back', async () => {
    setOnline(false);
    render(<App />);
    await turnOn();
    expect(screen.getByRole('alert').textContent).toBe(OSM_OFFLINE_MESSAGE);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(OSM_OFFLINE_MESSAGE)).toBeNull();
    expect(leaflet.handle.redraw).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert').textContent).toBe(OSM_OFFLINE_MESSAGE);
  });

  it('reports tiles that fail to load', async () => {
    render(<App />);
    const opts = await turnOn();
    act(() => {
      opts.onTileError();
      opts.onTileError();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/^2 map tiles failed to load/);
  });

  it('reports a map that could not be loaded, and the plan editor carries on', async () => {
    leaflet.mountOsmMap.mockImplementationOnce(() => {
      throw new Error('Map container is already initialized.');
    });
    render(<App />);
    fireEvent.click(toggle());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The map could not be loaded: Map container is already initialized. The plan-image mode is unaffected.',
    );
    expect(screen.getByRole('button', { name: 'Calibrate scale' })).toBeTruthy();
  });

  it('feeds a length measured on the map into the plan calibration', async () => {
    render(<App />);
    const opts = await turnOn();
    expect(screen.getByTestId('osm-measured').textContent).toBe('click two points on the map');
    act(() => opts.onMeasure([{ lat: 0, lng: 0 }]));
    expect(screen.getByTestId('osm-measured').textContent).toBe('click the second point');
    // 0.0003° of latitude = 33.36 m.
    act(() => opts.onMeasure([{ lat: 0, lng: 0 }, { lat: 0.0003, lng: 0 }]));
    expect(screen.getByTestId('osm-measured').textContent).toBe('33.4 m');

    fireEvent.click(screen.getByRole('button', { name: 'Use as calibration length' }));
    expect((screen.getByLabelText('Real length (m)') as HTMLInputElement).value).toBe('33.3585');
    expect(screen.getByText(/Real length set to 33\.4 m from the OpenStreetMap measurement/)).toBeTruthy();

    // The plan calibration still works as before with that length.
    fireEvent.change(screen.getByLabelText('Point A x (px)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Point A y (px)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Point B x (px)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Point B y (px)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply calibration' }));
    expect(screen.getByTestId('plan-scale').textContent).toBe('1 px = 0.334 m · 100 px = 33.4 m');
  });
});
