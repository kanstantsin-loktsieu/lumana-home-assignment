import { EntityState } from '@ngrx/entity';
import { Point } from './geometry';

export interface Polygon {
  readonly id: string;
  /** The `nasa_id` of the annotated image. */
  readonly imageId: string;
  /**
   * Vertices in normalized image coordinates (0..1 on both axes), so the shape keeps its position
   * and proportions when the image is resized. The array defines exactly one polygon:
   *
   * - an **ordered vertex ring**: edges run `p[i] → p[i+1]` plus an implicit closing edge
   *   `p[n-1] → p[0]`; the first point is not repeated at the end;
   * - at least 3 points, and no two consecutive points (including `p[n-1]`, `p[0]`) coincide
   *   within `POINT_EPSILON`;
   * - **simple**: no two non-adjacent edges intersect (no crossing, touching or collinear overlap),
   *   so fill and hit-testing agree;
   * - **canonical winding**: counter-clockwise on screen (`signedArea < 0` with y pointing down).
   *
   * The editor enforces this on creation. Move and rotate are rigid motions and preserve it.
   * Rotation is applied to the points directly; no angle is stored.
   */
  readonly points: readonly Point[];
  readonly createdAt: number;
}

export type PolygonsState = EntityState<Polygon>;
