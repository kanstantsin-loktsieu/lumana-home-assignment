import { Point, Size } from './geometry';

export type EditorMode = 'draw' | 'select' | 'delete';

export interface NewPolygon {
  readonly id: string;
  readonly points: readonly Point[];
  readonly createdAt: number;
}

export interface PolygonChange {
  readonly id: string;
  readonly points: readonly Point[];
}

export interface DragState {
  readonly kind: 'move' | 'rotate';
  readonly polygonId: string;
  readonly pointerId: number;
  readonly startNormalized: Point;
  readonly originalPoints: readonly Point[];
  previewPoints: readonly Point[];
  lastPointerPx: Point;
}

export interface PixelPolygon {
  readonly id: string;
  readonly points: readonly Point[];
}

// all coordinates are CSS pixels
export interface Scene {
  readonly canvasSize: Size;
  readonly polygons: readonly PixelPolygon[];
  readonly selectedId: string | null;
  readonly deleteHoverId: string | null;
  readonly draftVertices: readonly Point[];
  readonly cursorPx: Point | null;
  readonly cursorOnFirstVertex: boolean;
  readonly pendingSegmentCrossesOutline: boolean;
  readonly rotateHandle: RotateHandle | null;
}

export interface RotateHandle {
  readonly shapeAnchor: Point;
  readonly knobCenter: Point;
}
