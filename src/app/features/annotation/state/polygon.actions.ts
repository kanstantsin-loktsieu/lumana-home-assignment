import { createActionGroup, props } from '@ngrx/store';
import { Point } from '../models/geometry';
import { Polygon } from '../models/polygon';

export const PolygonActions = createActionGroup({
  source: 'Polygon Editor',
  events: {
    'Polygon Added': props<{ polygon: Polygon }>(),
    /** Dispatched once per move/rotate gesture, on pointer up. */
    'Polygon Changed': props<{ id: string; points: readonly Point[] }>(),
    'Polygon Removed': props<{ id: string }>(),
    'Image Polygons Cleared': props<{ imageId: string }>(),
  },
});
