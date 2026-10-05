/**
 * Optional OpenStreetMap reference view for the site map (M5). Off by default:
 * this tool is meant to run offline, and turning the map on sends the viewed
 * area to OpenStreetMap's tile servers.
 *
 * It is a reference view, not a second plan: the engineer looks up the site and
 * can measure a known dimension on it (two clicks, great-circle metres) and use
 * that as the calibration length of the uploaded plan. Nothing from the map is
 * stored in the project (ASSUMPTIONS 11.6).
 *
 * Leaflet is loaded only when the map is turned on, by a dynamic `import()` of
 * `osmLeaflet.ts`. Tile-policy compliance: `domain/osmMap.ts`.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';

import {
  measuredMetres,
  OSM_COPYRIGHT_URL,
  OSM_DEFAULT_VIEW,
  OSM_FIX_THE_MAP_URL,
  osmNotice,
  type LatLng,
  type OsmLoadState,
  type OsmView,
} from '../domain/osmMap.ts';
import { lengthFromMetres, lengthUnitLabel, round } from '../domain/units.ts';
import type { UnitSystemState } from '../state/projectTypes.ts';
import type { OsmMapHandle } from './osmLeaflet.ts';
import { Button, CheckboxField } from './primitives.tsx';

export function OsmReferenceMap({
  units,
  onUseAsCalibrationLength,
}: {
  units: UnitSystemState;
  /** Called with the measured length, metres. */
  onUseAsCalibrationLength: (metres: number) => void;
}) {
  const [on, setOn] = useState(false);
  /** Last view, so turning the map off and on again returns to the same place. */
  const lastView = useRef<OsmView>(OSM_DEFAULT_VIEW);
  return (
    <div className="mt-4 rounded-control border border-[var(--color-border)] p-3">
      <CheckboxField
        label="Show OpenStreetMap (online)"
        helper="Off by default. A reference map from OpenStreetMap to look up the site and measure a known dimension for the calibration. Needs internet, and sends the area you view to OpenStreetMap's tile servers. Nothing from the map is saved in the project."
        checked={on}
        onChange={setOn}
      />
      {on && <OsmMapView units={units} lastView={lastView} onUseAsCalibrationLength={onUseAsCalibrationLength} />}
    </div>
  );
}

function OsmMapView({
  units,
  lastView,
  onUseAsCalibrationLength,
}: {
  units: UnitSystemState;
  lastView: RefObject<OsmView>;
  onUseAsCalibrationLength: (metres: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<OsmMapHandle | null>(null);
  const [load, setLoad] = useState<OsmLoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tileErrors, setTileErrors] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [points, setPoints] = useState<readonly LatLng[]>([]);

  // Lazy-load Leaflet and mount the map; tear it down when the map is turned off.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    import('./osmLeaflet.ts')
      .then((m) => {
        if (cancelled) return;
        handleRef.current = m.mountOsmMap(el, {
          view: lastView.current,
          onTileError: () => setTileErrors((n) => n + 1),
          onMeasure: (p) => setPoints(p),
          onViewChange: (v) => {
            lastView.current = v;
          },
        });
        setLoad('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : null);
        setLoad('failed');
      });
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [lastView]);

  // Follow the connection: say when it drops, and re-request the visible tiles when it is back.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setTileErrors(0);
      handleRef.current?.redraw();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const notice = osmNotice({ online, protocol: window.location.protocol, load, loadError, tileErrors });
  const metres = measuredMetres(points);
  const u = lengthUnitLabel(units);

  return (
    <>
      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className="mt-3 rounded-control border-l-4 px-3 py-2 text-sm"
          style={{
            borderColor: notice.kind === 'error' ? 'var(--color-fail)' : 'var(--color-accent)',
            background: notice.kind === 'error' ? 'var(--color-fail-soft)' : 'var(--color-accent-soft)',
            color: notice.kind === 'error' ? 'var(--color-fail)' : 'var(--color-ink)',
          }}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-[var(--color-ink)]">Measured:</span>
        <span data-testid="osm-measured" className="font-mono text-[var(--color-ink-2)]">
          {metres === null
            ? points.length === 1
              ? 'click the second point'
              : 'click two points on the map'
            : `${round(lengthFromMetres(metres, units), 1)} ${u}`}
        </span>
        {metres !== null && (
          <>
            <Button variant="primary" onClick={() => onUseAsCalibrationLength(metres)}>
              Use as calibration length
            </Button>
            <Button variant="ghost" onClick={() => handleRef.current?.clearMeasure()}>
              Clear measurement
            </Button>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        Map features are typically accurate to a few metres: measure a long dimension (a building side, a fence line).
      </p>

      {/* isolation keeps Leaflet's z-indexed panes inside this box, under the attribution. */}
      <div className="relative mt-2 overflow-hidden rounded-control border border-[var(--color-border)]" style={{ isolation: 'isolate' }}>
        <div ref={containerRef} className="osm-map h-72 w-full sm:h-96" role="region" aria-label="OpenStreetMap reference map" />
        <p
          data-testid="osm-attribution"
          className="absolute right-0 bottom-0 z-[1000] m-0 px-1.5 py-0.5 text-[11px] leading-snug"
          style={{ background: 'rgba(255, 255, 255, 0.85)', color: '#333' }}
        >
          ©{' '}
          <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener" style={{ color: '#0078a8' }}>
            OpenStreetMap
          </a>{' '}
          contributors ·{' '}
          <a href={OSM_FIX_THE_MAP_URL} target="_blank" rel="noopener" style={{ color: '#0078a8' }}>
            Report a map issue
          </a>
        </p>
      </div>
    </>
  );
}
