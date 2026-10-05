/**
 * OpenStreetMap reference view (M5): the tile-usage-policy constants and the pure
 * logic behind the optional online map. No Leaflet in here — Leaflet is only
 * loaded, lazily, by `ui/osmLeaflet.ts` when the engineer turns the map on.
 *
 * Policy: OSMF Tile Usage Policy, https://operations.osmfoundation.org/policies/tiles/
 * Checked 2026-10-05. The live page was blocked by the build environment's network
 * proxy, so it was read from the page's published source instead: repository
 * github.com/openstreetmap/owg-website, file `policies/tiles.md` (permalink
 * /policies/tiles/), last changed 2026-08-11 (commit c496c36). What it requires and
 * how this tool meets it:
 *
 * - §1 "Use exactly: https://tile.openstreetmap.org/{z}/{x}/{y}.png" (HTTPS, no
 *   subdomains) → `OSM_TILE_URL`.
 * - §2 "Show OpenStreetMap licence attribution clearly on the map (typically
 *   bottom-right)… © OpenStreetMap contributors" linking to the copyright page, and
 *   "Do not hide attribution beneath UI, behind toggles, or off-screen" → drawn over
 *   the map's bottom-right corner whenever the map is shown (`OsmReferenceMap`).
 * - §3.1 a valid User-Agent and, from web pages, a valid Referer; "Do not set a
 *   restrictive Referrer-Policy" → tiles are plain `<img>` requests made by the
 *   browser with its own User-Agent and default referrer policy; nothing overrides
 *   either. (A page opened from `file:` sends no Referer: `osmNotice` warns.)
 * - §3.2 honour HTTP caching headers; never send no-cache headers → the browser's
 *   normal HTTP cache only; no cache of our own and no request headers set.
 * - §4 no bulk downloading, no prefetch, "Offline use is not permitted" → Leaflet
 *   requests only the tiles in the current viewport; there is no download, seed or
 *   save-area feature, and nothing from the map is stored in the project.
 * - Recommended: a "Report a map issue" link to /fixthemap → `OSM_FIX_THE_MAP_URL`.
 *   Also recommended, not done: a switchable tile URL — it is one constant here.
 */

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
/** Highest zoom the standard tile layer serves. */
export const OSM_MAX_ZOOM = 19;
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
export const OSM_FIX_THE_MAP_URL = 'https://www.openstreetmap.org/fixthemap';
export const OSM_POLICY_URL = 'https://operations.osmfoundation.org/policies/tiles/';
export const OSM_POLICY_CHECKED_ON = '2026-10-05';

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** Where the map looks: centre and zoom. Kept only in memory, never saved. */
export interface OsmView extends LatLng {
  readonly zoom: number;
}

/** First view: the whole world, so no place is assumed. */
export const OSM_DEFAULT_VIEW: OsmView = { lat: 20, lng: 0, zoom: 2 };

/** Mean Earth radius Leaflet uses (`L.CRS.Earth.R`), so both give the same distances. */
export const EARTH_RADIUS_M = 6_371_000;

/**
 * Great-circle (haversine) distance between two points, metres. On a sphere, so it
 * is within about 0.5% of the ellipsoidal distance — far inside the accuracy of
 * the map features a calibration length would be measured on.
 */
export function greatCircleMetres(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Measuring on the map: two clicks make a line; a third click starts a new one. */
export function addMeasurePoint(points: readonly LatLng[], p: LatLng): LatLng[] {
  return points.length >= 2 ? [p] : [...points, p];
}

/** The measured length, metres, once two points are set. */
export function measuredMetres(points: readonly LatLng[]): number | null {
  const [a, b] = points;
  return a && b ? greatCircleMetres(a, b) : null;
}

export type OsmLoadState = 'loading' | 'ready' | 'failed';

export interface OsmStatus {
  readonly online: boolean;
  /** `window.location.protocol`, e.g. `https:` or `file:`. */
  readonly protocol: string;
  readonly load: OsmLoadState;
  readonly loadError: string | null;
  /** Tiles that failed since the map was shown (or since the connection came back). */
  readonly tileErrors: number;
}

export interface OsmNotice {
  readonly kind: 'error' | 'info';
  readonly text: string;
}

export const OSM_OFFLINE_MESSAGE =
  'You are offline. OpenStreetMap tiles need an internet connection; the plan-image mode keeps working offline.';

/** The one message to show above the map, most serious first; null when all is well. */
export function osmNotice(s: OsmStatus): OsmNotice | null {
  if (!s.online) return { kind: 'error', text: OSM_OFFLINE_MESSAGE };
  if (s.load === 'failed') {
    return {
      kind: 'error',
      text: `The map could not be loaded${s.loadError ? `: ${s.loadError.replace(/\.+$/, '')}` : ''}. The plan-image mode is unaffected.`,
    };
  }
  if (s.tileErrors > 0) {
    return {
      kind: 'error',
      text: `${s.tileErrors} map tile${s.tileErrors === 1 ? '' : 's'} failed to load — the connection may be down, or the OpenStreetMap tile server refused the request. The plan-image mode is unaffected.`,
    };
  }
  if (s.protocol === 'file:') {
    return {
      kind: 'error',
      text: 'This page was opened from a file, so the browser sends no Referer header and the OpenStreetMap tile server may refuse the tiles (its usage policy requires one). Serve the app (npm run preview, or any web server) to use the map.',
    };
  }
  if (s.load === 'loading') return { kind: 'info', text: 'Loading the map…' };
  return null;
}
