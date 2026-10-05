/**
 * The only module that touches Leaflet. `OsmReferenceMap` loads it with a dynamic
 * `import()` when the engineer turns the online map on, so Leaflet and its CSS
 * live in their own chunk and the main bundle (and offline use) never pays for it.
 *
 * Tile-policy compliance is documented in `domain/osmMap.ts`. In short: the
 * standard HTTPS tile URL, maxZoom 19, only the tiles in view (no prefetch, no
 * bulk or offline download), the browser's own cache, User-Agent and Referer —
 * no option here overrides any of them (`crossOrigin` and `referrerPolicy` stay at
 * Leaflet's defaults, which set neither attribute). Attribution is drawn by
 * `OsmReferenceMap` over the map's bottom-right corner, so Leaflet's own
 * attribution control is switched off rather than shown twice.
 */

import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { BRAND_BLUE } from '../brand.ts';
import { addMeasurePoint, OSM_MAX_ZOOM, OSM_TILE_URL, type LatLng, type OsmView } from '../domain/osmMap.ts';

export interface OsmMapHandle {
  /** Remove the map and every listener. */
  destroy(): void;
  clearMeasure(): void;
  /** Re-request the tiles in view (after the connection comes back). */
  redraw(): void;
}

export interface OsmMapOptions {
  readonly view: OsmView;
  readonly onTileError: () => void;
  readonly onMeasure: (points: readonly LatLng[]) => void;
  readonly onViewChange: (view: OsmView) => void;
}

export function mountOsmMap(el: HTMLElement, o: OsmMapOptions): OsmMapHandle {
  const map = L.map(el, {
    center: [o.view.lat, o.view.lng],
    zoom: o.view.zoom,
    maxZoom: OSM_MAX_ZOOM,
    attributionControl: false,
  });
  const tiles = L.tileLayer(OSM_TILE_URL, { maxZoom: OSM_MAX_ZOOM }).addTo(map);
  tiles.on('tileerror', () => o.onTileError());
  L.control.scale().addTo(map);

  const measure = L.layerGroup().addTo(map);
  let points: LatLng[] = [];
  const draw = () => {
    measure.clearLayers();
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], { radius: 5, color: BRAND_BLUE, weight: 2, fillOpacity: 0.9 }).addTo(measure);
    }
    if (points.length === 2) {
      L.polyline(points.map((p) => [p.lat, p.lng] as [number, number]), { color: BRAND_BLUE, weight: 3 }).addTo(measure);
    }
    o.onMeasure(points);
  };
  map.on('click', (e: L.LeafletMouseEvent) => {
    points = addMeasurePoint(points, { lat: e.latlng.lat, lng: e.latlng.lng });
    draw();
  });
  map.on('moveend', () => {
    const c = map.getCenter();
    o.onViewChange({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
  });

  return {
    destroy: () => {
      map.remove();
    },
    clearMeasure: () => {
      points = [];
      draw();
    },
    redraw: () => {
      tiles.redraw();
    },
  };
}
