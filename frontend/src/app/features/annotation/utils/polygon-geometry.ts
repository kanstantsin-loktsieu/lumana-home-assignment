import { MIN_POLYGON_VERTICES } from '../constants/annotation.constants';
import { Box, Point, Size } from '../models/geometry';

// polygons are stored in normalized image coordinates (0..1 on both axes) so they survive resizes.
const POINT_EPSILON = 1e-6;
const COLLINEAR_EPSILON = 1e-12;
// a normalized area below this is degenerate (all points on a line), so it has no usable centroid.
const DEGENERATE_AREA_EPSILON = 1e-9;
const CENTROID_AREA_DIVISOR = 6;

export const toPixels = (points: readonly Point[], canvasSize: Size): Point[] =>
  points.map((point) => ({ x: point.x * canvasSize.width, y: point.y * canvasSize.height }));

// shoelace formula
const signedArea = (points: readonly Point[]): number => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
};

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

export const boundingBox = (points: readonly Point[]): Box => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });
  return { minX, minY, maxX, maxY };
};

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
  // a shape wider than the image cannot fit; centre it instead.
  return lowestShift > highestShift
    ? (lowestShift + highestShift) / 2
    : Math.min(highestShift, Math.max(lowestShift, delta));
};

export const clampTranslation = (
  points: readonly Point[],
  dx: number,
  dy: number,
): [number, number] => {
  const box = boundingBox(points);
  return [clampDelta(dx, box.minX, box.maxX), clampDelta(dy, box.minY, box.maxY)];
};

export const fitInside = (points: readonly Point[]): Point[] =>
  translate(points, ...clampTranslation(points, 0, 0));

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

// cross product (b - a) × (c - a): > 0, < 0 or ~0 (collinear).
const orientation = (a: Point, b: Point, c: Point): number => {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(value) < COLLINEAR_EPSILON ? 0 : value;
};

const onSegment = (a: Point, b: Point, point: Point): boolean =>
  point.x <= Math.max(a.x, b.x) + POINT_EPSILON &&
  point.x >= Math.min(a.x, b.x) - POINT_EPSILON &&
  point.y <= Math.max(a.y, b.y) + POINT_EPSILON &&
  point.y >= Math.min(a.y, b.y) - POINT_EPSILON;

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

// two edges meeting at `vertex` fold back onto each other (a zero-width spike)
const foldsBack = (from: Point, vertex: Point, to: Point): boolean =>
  orientation(from, vertex, to) === 0 &&
  (from.x - vertex.x) * (to.x - vertex.x) + (from.y - vertex.y) * (to.y - vertex.y) > 0;

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

const hasConsecutiveDuplicates = (points: readonly Point[], epsilon = POINT_EPSILON): boolean =>
  points.some((point, i) => {
    const next = points[(i + 1) % points.length];
    return (
      points.length > 1 &&
      Math.abs(point.x - next.x) < epsilon &&
      Math.abs(point.y - next.y) < epsilon
    );
  });

export const normalizeWinding = (points: readonly Point[]): Point[] =>
  signedArea(points) > 0 ? [...points].reverse() : [...points];

export const canAppendVertex = (draftVertices: readonly Point[], candidate: Point): boolean => {
  const count = draftVertices.length;
  if (count === 0) {
    return true;
  }
  const last = draftVertices[count - 1];
  if (count >= 2 && foldsBack(draftVertices[count - 2], last, candidate)) {
    return false;
  }
  for (let k = 0; k < count - 2; k++) {
    if (segmentsIntersect(last, candidate, draftVertices[k], draftVertices[k + 1])) {
      return false;
    }
  }
  return true;
};

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
  // skip the two edges adjacent to the closing edge: edge 0 (at `first`) and edge n-2 (at `last`).
  for (let k = 1; k < count - 2; k++) {
    if (segmentsIntersect(last, first, draftVertices[k], draftVertices[k + 1])) {
      return false;
    }
  }
  return true;
};

const MIN_POLYGON_AREA_PX = 16;

export const isValidPolygon = (points: readonly Point[], canvasSize: Size): boolean =>
  points.length >= MIN_POLYGON_VERTICES &&
  !hasConsecutiveDuplicates(points) &&
  isSimplePolygon(points) &&
  Math.abs(signedArea(toPixels(points, canvasSize))) >= MIN_POLYGON_AREA_PX;
