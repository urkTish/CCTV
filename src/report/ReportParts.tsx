/**
 * Report building blocks: a QR code, and the site map drawn for paper.
 *
 * The map is readable in greyscale: cameras are numbered circles, the recorder
 * a square marked R, switches diamonds marked S; drawn cable routes are solid
 * and estimated ones dashed; fields of view are outlined with a dashed edge as
 * well as tinted. A legend lists every number. A drawn layout (rooms, walls,
 * fences, doors, labels) is drawn under the devices in print colours.
 */

import type { LayoutShape } from '../domain/layoutShapes.ts';
import type { SiteMapView } from '../engine/siteMapView.ts';
import { LayoutShapesSvg } from '../ui/LayoutShapesSvg.tsx';
import { PRINT_PALETTE } from '../ui/planPalette.ts';
import { encodeQr, qrPath } from './qr.ts';

export function QrSvg({ text, label }: { text: string; label: string }) {
  const q = encodeQr(text, 'M');
  const n = q.size + 8;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={qrPath(q, 4)} fill="#000" />
    </svg>
  );
}

export function ReportMap({
  view,
  image,
  layoutShapes = [],
  metresPerPx = 0.05,
}: {
  view: SiteMapView;
  image: string | null;
  layoutShapes?: readonly LayoutShape[];
  metresPerPx?: number;
}) {
  const { widthPx: w, heightPx: h } = view;
  const u = Math.max(w, h) / 100;
  const cameras = view.devices.filter((d) => d.device.kind === 'camera');
  const numberOf = new Map(cameras.map((d, i) => [d.device.id, i + 1]));
  return (
    <figure className="report-map" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Site plan with ${cameras.length} cameras and ${view.devices.length - cameras.length} other devices`}>
        {image ? (
          <image href={image} x={0} y={0} width={w} height={h} />
        ) : (
          <rect x={0} y={0} width={w} height={h} fill={layoutShapes.length ? '#ffffff' : '#f1f3f7'} />
        )}
        <LayoutShapesSvg
          shapes={layoutShapes}
          palette={image ? { ...PRINT_PALETTE, fillOpacity: 0.45, cutOpenings: false } : PRINT_PALETTE}
          unit={u}
          metresPerPx={metresPerPx}
          idBase="report-layout"
        />
        {cameras.map((d) =>
          d.cone.length > 2 ? (
            <polygon
              key={`c-${d.device.id}`}
              points={d.cone.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="#536ffc"
              fillOpacity={0.16}
              stroke="#1f2a6b"
              strokeWidth={u * 0.18}
              strokeDasharray={`${u * 0.8} ${u * 0.5}`}
            />
          ) : null,
        )}
        {view.lines.map((l) => (
          <polyline
            key={l.id}
            points={l.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            // Dark blue, so a drawn route never reads as a drawn wall (black).
            stroke={l.kind === 'drawn' ? '#2b3fa8' : '#5b6878'}
            strokeWidth={u * 0.3}
            strokeDasharray={l.kind === 'estimated' ? `${u} ${u * 0.7}` : undefined}
          />
        ))}
        {view.devices.map((d) => {
          const { x, y } = d.device;
          if (d.device.kind === 'camera') {
            return (
              <g key={d.device.id}>
                <circle cx={x} cy={y} r={u * 1.4} fill="#fff" stroke="#10151c" strokeWidth={u * 0.3} />
                <text x={x} y={y + u * 0.55} textAnchor="middle" fontSize={u * 1.5} fontWeight={700} fill="#10151c">
                  {numberOf.get(d.device.id)}
                </text>
              </g>
            );
          }
          const nvr = d.device.kind === 'nvr';
          return (
            <g key={d.device.id}>
              {nvr ? (
                <rect x={x - u * 1.4} y={y - u * 1.4} width={u * 2.8} height={u * 2.8} fill="#10151c" />
              ) : (
                <polygon points={`${x},${y - u * 1.7} ${x + u * 1.7},${y} ${x},${y + u * 1.7} ${x - u * 1.7},${y}`} fill="#3a4654" />
              )}
              <text x={x} y={y + u * 0.55} textAnchor="middle" fontSize={u * 1.4} fontWeight={700} fill="#fff">
                {nvr ? 'R' : 'S'}
              </text>
              <text x={x + u * 2.2} y={y + u * 0.5} fontSize={u * 1.4} fill="#10151c" stroke="#fff" strokeWidth={u * 0.3} paintOrder="stroke">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        <ul className="report-legend" style={{ listStyle: 'none', padding: 0 }}>
          <li>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" fill="#fff" stroke="#10151c" strokeWidth="1.5" />
            </svg>
            Camera (numbered below), with its field of view
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect x="1.5" y="1.5" width="11" height="11" fill="#10151c" />
            </svg>
            R — recorder (NVR) / rack
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <polygon points="7,0.5 13.5,7 7,13.5 0.5,7" fill="#3a4654" />
            </svg>
            S — network switch
          </li>
          <li>
            <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
              <path d="M1 2h20" stroke="#2b3fa8" strokeWidth="2" />
              <path d="M1 6h20" stroke="#5b6878" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Cable route: drawn (solid) / estimated (dashed)
          </li>
          {layoutShapes.length > 0 && (
            <li>
              <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
                <path d="M1 12h20" stroke="#10151c" strokeWidth="3" />
                <path d="M4 12V3M4 3a9 9 0 0 1 9 9" fill="none" stroke="#10151c" strokeWidth="1" />
              </svg>
              Site layout as drawn by the engineer: walls, fences, doors and gates (not to construction accuracy)
            </li>
          )}
          {cameras.map((d) => (
            <li key={d.device.id}>
              <strong>{numberOf.get(d.device.id)}</strong> {d.label}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
