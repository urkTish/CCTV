/**
 * Colours and stroke weights for drawing the site layout: theme colours for the
 * Site map editor (light / dark, and the light palette over an uploaded image),
 * fixed colours for the printed report. Used by `LayoutShapesSvg.tsx`.
 */

import type { AreaFill, LineStyle } from '../domain/layoutShapes.ts';

export interface PlanPalette {
  readonly ink: string;
  /** The paper the plan is drawn on: label halos and the cut a door makes in a wall. */
  readonly background: string;
  readonly fills: Readonly<Record<Exclude<AreaFill, 'none'>, string>>;
  readonly hatch: string;
  /** Below 1 over an uploaded image, so the plan shows through a fill. */
  readonly fillOpacity: number;
  /** Paint the gap a door or window makes in its wall (not over an image, where it would hide the plan). */
  readonly cutOpenings: boolean;
}

export const THEME_PALETTE: PlanPalette = {
  ink: 'var(--color-ink)',
  background: 'var(--color-surface)',
  fills: {
    room: 'var(--color-plan-room)',
    building: 'var(--color-plan-building)',
    'car-park': 'var(--color-plan-car-park)',
    grass: 'var(--color-plan-grass)',
    paving: 'var(--color-plan-paving)',
  },
  hatch: 'var(--color-plan-hatch)',
  fillOpacity: 1,
  cutOpenings: true,
};

export const PRINT_PALETTE: PlanPalette = {
  ink: '#10151c',
  background: '#ffffff',
  fills: { room: '#f7f8fa', building: '#e3e7ec', 'car-park': '#eef0f3', grass: '#e3efe3', paving: '#efebe3' },
  hatch: '#8a96a5',
  fillOpacity: 1,
  cutOpenings: true,
};

/** Stroke of each line style, scaled to the plan's marker unit (1% of its larger side). */
export function lineStroke(style: LineStyle, unit: number): { width: number; dash?: string } {
  switch (style) {
    case 'wall':
      return { width: unit * 0.6 };
    case 'partition':
      return { width: unit * 0.22 };
    case 'fence':
      return { width: unit * 0.18 };
    case 'boundary':
      return { width: unit * 0.25, dash: `${unit * 1.2} ${unit * 0.6}` };
  }
}
