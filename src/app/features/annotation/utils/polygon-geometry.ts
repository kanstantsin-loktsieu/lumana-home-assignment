import { MIN_POLYGON_VERTICES } from '../constants/annotation.constants';
import { Box, Point, Size } from '../models/geometry';

/**
 * Pure 2-D geometry for the polygon editor. No Angular imports.
 *
 * Polygons are stored in normalized image coordinates (0..1 on both axes) so they survive resizes.
 * Anything angle-dependent (rotation, drag angles) must run in aspect-correct space, otherwise a
 * non-square image would shear the shape.
 */

/** Two normalized points closer than this count as the same point. */
const POINT_EPSILON = 1e-6;
const COLLINEAR_EPSILON = 1e-12;
/** A normalized area below this is degenerate (all points on a line), so it has no usable centroid. */
const DEGENERATE_AREA_EPSILON = 1e-9;
/** The centroid sums are divided by six times the signed area. */
const CENTROID_AREA_DIVISOR = 6;

export const toPixels = (points: readonly Point[], canvasSize: Size): Point[] =>
  points.map((point) => ({ x: point.x * canvasSize.width, y: point.y * canvasSize.height }));

/** Shoelace formula. With screen coordinates (y down) a positive value means clockwise on screen. */
const signedArea = (points: readonly Point[]): number => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
};

/** Area-weighted centroid; falls back to the vertex mean for degenerate shapes. Affine-equivariant. */
export const centroid = (points: readonly Point[]): Point => {
  const area = signedArea(points);
  if (Math.abs(area) < DEGENERATE_AREA_EPSILON) {
    const pointCount = points.length || 1;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / pointCount,
      y: points.reduce((sum, point) => sum + point.y, 0) / pointCount,
    };
  }
  let weightedX = 0;
  let weightedY = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    weightedX += (current.x + next.x) * cross;
    weightedY += (current.y + next.y) * cross;
  }
  return {
    x: weightedX / (CENTROID_AREA_DIVISOR * area),
    y: weightedY / (CENTROID_AREA_DIVISOR * area),
  };
};

export const boundingBox = (points: readonly Point[]): Box => ({
  minX: Math.min(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxX: Math.max(...points.map((point) => point.x)),
  maxY: Math.max(...points.map((point) => point.y)),
});

export const translate = (points: readonly Point[], dx: number, dy: number): Point[] =>
  points.map((point) => ({ x: point.x + dx, y: point.y + dy }));

const rotate = (points: readonly Point[], center: Point, radians: number): Point[] => {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
  });
};

/**
 * Rotates normalized points around their centroid without shearing: x is scaled by
 * `aspectRatio = width / height` into aspect-correct space, rotated, then scaled back.
 */
export const rotateNormalized = (
  points: readonly Point[],
  radians: number,
  aspectRatio: number,
): Point[] => {
  const scaled = points.map((point) => ({ x: point.x * aspectRatio, y: point.y }));
  const rotated = rotate(scaled, centroid(scaled), radians);
  return rotated.map((point) => ({ x: point.x / aspectRatio, y: point.y }));
};

const clampDelta = (delta: number, boxMin: number, boxMax: number): number => {
  const lowestShift = -boxMin;
  const highestShift = 1 - boxMax;
  // A shape wider than the image cannot fit; centre it instead.
  return lowestShift > highestShift
    ? (lowestShift + highestShift) / 2
    : Math.min(highestShift, Math.max(lowestShift, delta));
};

/** Limits a translation so the bounding box stays inside [0, 1]. Never deforms the shape. */
export const clampTranslation = (
  points: readonly Point[],
  dx: number,
  dy: number,
): [number, number] => {
  const box = boundingBox(points);
  return [clampDelta(dx, box.minX, box.maxX), clampDelta(dy, box.minY, box.maxY)];
};

/** Shifts a shape back inside the image where possible (e.g. after a rotation). */
export const fitInside = (points: readonly Point[]): Point[] =>
  translate(points, ...clampTranslation(points, 0, 0));

/** Even-odd ray casting. For simple polygons this matches the canvas's nonzero `fill()`. */
export const pointInPolygon = (point: Point, points: readonly Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
};

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Cross product of (b - a) × (c - a): > 0, < 0 or ~0 (collinear). */
const orientation = (a: Point, b: Point, c: Point): number => {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(value) < COLLINEAR_EPSILON ? 0 : value;
};

/** Whether `point`, known to be collinear with segment ab, lies within its bounding box. */
const onSegment = (a: Point, b: Point, point: Point): boolean =>
  point.x <= Math.max(a.x, b.x) + POINT_EPSILON &&
  point.x >= Math.min(a.x, b.x) - POINT_EPSILON &&
  point.y <= Math.max(a.y, b.y) + POINT_EPSILON &&
  point.y >= Math.min(a.y, b.y) - POINT_EPSILON;

/** True for a proper crossing, an endpoint touching the other segment, or a collinear overlap. */
const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (Math.sign(o1) * Math.sign(o2) < 0 && Math.sign(o3) * Math.sign(o4) < 0) {
    return true;
  }
  return (
    (o1 === 0 && onSegment(a, b, c)) ||
    (o2 === 0 && onSegment(a, b, d)) ||
    (o3 === 0 && onSegment(c, d, a)) ||
    (o4 === 0 && onSegment(c, d, b))
  );
};

/** Two edges meeting at `vertex` fold back onto each other (a zero-width spike). */
const foldsBack = (from: Point, vertex: Point, to: Point): boolean =>
  orientation(from, vertex, to) === 0 &&
  (from.x - vertex.x) * (to.x - vertex.x) + (from.y - vertex.y) * (to.y - vertex.y) > 0;

/**
 * The closed ring has no self-intersections: non-adjacent edges never meet, and adjacent edges
 * share only their common vertex. O(n²), fine for hand-drawn polygons.
 */
const isSimplePolygon = (points: readonly Point[]): boolean => {
  const count = points.length;
  if (count < MIN_POLYGON_VERTICES) {
    return false;
  }
  for (let i = 0; i < count; i++) {
    if (foldsBack(points[(i - 1 + count) % count], points[i], points[(i + 1) % count])) {
      return false;
    }
  }
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === count - 1);
      if (
        !adjacent &&
        segmentsIntersect(points[i], points[(i + 1) % count], points[j], points[(j + 1) % count])
      ) {
        return false;
      }
    }
  }
  return true;
};

/** Includes the closing pair `p[n-1]` / `p[0]`. */
const hasConsecutiveDuplicates = (points: readonly Point[], epsilon = POINT_EPSILON): boolean =>
  points.some((point, i) => {
    const next = points[(i + 1) % points.length];
    return (
      points.length > 1 &&
      Math.abs(point.x - next.x) < epsilon &&
      Math.abs(point.y - next.y) < epsilon
    );
  });

/** Canonical winding: counter-clockwise on screen, i.e. `signedArea < 0` with y pointing down. */
export const normalizeWinding = (points: readonly Point[]): Point[] =>
  signedArea(points) > 0 ? [...points].reverse() : [...points];

/** Whether the draft edge `last → candidate` keeps the outline free of self-intersections. */
export const canAppendVertex = (draftVertices: readonly Point[], candidate: Point): boolean => {
  const count = draftVertices.length;
  if (count === 0) {
    return true;
  }
  const last = draftVertices[count - 1];
  if (count >= 2 && foldsBack(draftVertices[count - 2], last, candidate)) {
    return false;
  }
  // Every draft edge except the one ending at `last` (which shares that vertex).
  for (let k = 0; k < count - 2; k++) {
    if (segmentsIntersect(last, candidate, draftVertices[k], draftVertices[k + 1])) {
      return false;
    }
  }
  return true;
};

/** Whether the closing edge `last → first` keeps the outline free of self-intersections. */
export const canClose = (draftVertices: readonly Point[]): boolean => {
  const count = draftVertices.length;
  if (count < MIN_POLYGON_VERTICES) {
    return false;
  }
  const first = draftVertices[0];
  const last = draftVertices[count - 1];
  if (
    foldsBack(draftVertices[count - 2], last, first) ||
    foldsBack(last, first, draftVertices[1])
  ) {
    return false;
  }
  // Skip the two edges adjacent to the closing edge: edge 0 (at `first`) and edge n-2 (at `last`).
  for (let k = 1; k < count - 2; k++) {
    if (segmentsIntersect(last, first, draftVertices[k], draftVertices[k + 1])) {
      return false;
    }
  }
  return true;
};

/** Smallest accepted polygon area, in CSS pixels². Rejects slivers and collinear shapes. */
const MIN_POLYGON_AREA_PX = 16;

/** The full polygon invariant except winding (see `Polygon.points`). */
export const isValidPolygon = (points: readonly Point[], canvasSize: Size): boolean =>
  points.length >= MIN_POLYGON_VERTICES &&
  !hasConsecutiveDuplicates(points) &&
  isSimplePolygon(points) &&
  Math.abs(signedArea(toPixels(points, canvasSize))) >= MIN_POLYGON_AREA_PX;
