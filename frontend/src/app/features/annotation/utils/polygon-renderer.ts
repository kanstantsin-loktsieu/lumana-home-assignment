import {
  ROTATE_HANDLE_RADIUS_PX,
  SELECTION_BOX_PADDING_PX,
} from '../constants/annotation.constants';
import { PixelPolygon, Scene } from '../models/editor';
import { Point } from '../models/geometry';
import { boundingBox } from './polygon-geometry';

const COLORS = {
  fill: 'rgba(66, 165, 245, 0.28)',
  stroke: '#42a5f5',
  halo: 'rgba(0, 0, 0, 0.45)',
  selected: '#ffb300',
  selectedFill: 'rgba(255, 179, 0, 0.22)',
  danger: '#e53935',
  dangerFill: 'rgba(229, 57, 53, 0.32)',
  vertexFill: '#ffffff',
  vertexStroke: 'rgba(0, 0, 0, 0.7)',
  handleGlyph: '#5d4300',
} as const;

const VERTEX_RADIUS = 4;
// how much larger than a vertex dot the ring around the first vertex is, once the outline can close.
const CLOSE_RING_EXTRA_RADIUS = 4;
const HANDLE_GLYPH_INSET = 4;

const LINE_WIDTHS = {
  outline: 2,
  haloExtra: 2,
  vertex: 1.5,
  selectionBox: 1,
  handleStem: 1.5,
  handleRing: 2,
  handleGlyph: 1.5,
  closingEdge: 1,
  closeRing: 2,
} as const;

const DASH_PATTERNS = {
  selectionBox: [4, 4],
  closingEdge: [5, 5],
} as const;

const ARROW_HEAD = {
  forward: 2.5,
  back: 1.5,
  halfWidth: 2.5,
} as const;

const tracePath = (ctx: CanvasRenderingContext2D, points: readonly Point[], close: boolean) => {
  ctx.beginPath();
  points.forEach((point, i) =>
    i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y),
  );
  if (close) {
    ctx.closePath();
  }
};

const strokeWithHalo = (
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number = LINE_WIDTHS.outline,
) => {
  ctx.lineWidth = width + LINE_WIDTHS.haloExtra;
  ctx.strokeStyle = COLORS.halo;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
};

const drawVertices = (
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  radius = VERTEX_RADIUS,
) => {
  ctx.lineWidth = LINE_WIDTHS.vertex;
  ctx.fillStyle = COLORS.vertexFill;
  ctx.strokeStyle = COLORS.vertexStroke;
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
};

const drawPolygon = (
  ctx: CanvasRenderingContext2D,
  polygon: PixelPolygon,
  fill: string,
  stroke: string,
) => {
  tracePath(ctx, polygon.points, true);
  ctx.fillStyle = fill;
  ctx.fill();
  strokeWithHalo(ctx, stroke);
  drawVertices(ctx, polygon.points);
};

const drawSelection = (ctx: CanvasRenderingContext2D, scene: Scene, polygon: PixelPolygon) => {
  const box = boundingBox(polygon.points);
  ctx.save();
  ctx.setLineDash(DASH_PATTERNS.selectionBox);
  ctx.lineWidth = LINE_WIDTHS.selectionBox;
  ctx.strokeStyle = COLORS.selected;
  ctx.strokeRect(
    box.minX - SELECTION_BOX_PADDING_PX,
    box.minY - SELECTION_BOX_PADDING_PX,
    box.maxX - box.minX + SELECTION_BOX_PADDING_PX * 2,
    box.maxY - box.minY + SELECTION_BOX_PADDING_PX * 2,
  );
  ctx.restore();

  if (!scene.rotateHandle) {
    return;
  }
  const { shapeAnchor, knobCenter } = scene.rotateHandle;
  ctx.beginPath();
  ctx.moveTo(shapeAnchor.x, shapeAnchor.y);
  ctx.lineTo(knobCenter.x, knobCenter.y);
  strokeWithHalo(ctx, COLORS.selected, LINE_WIDTHS.handleStem);

  ctx.beginPath();
  ctx.arc(knobCenter.x, knobCenter.y, ROTATE_HANDLE_RADIUS_PX, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.vertexFill;
  ctx.fill();
  ctx.lineWidth = LINE_WIDTHS.handleRing;
  ctx.strokeStyle = COLORS.selected;
  ctx.stroke();

  const glyphRadius = ROTATE_HANDLE_RADIUS_PX - HANDLE_GLYPH_INSET;
  const gapAngle = Math.PI / 2;
  const arcStart = -Math.PI / 2 + gapAngle / 2;
  const arcEnd = (Math.PI * 3) / 2 - gapAngle / 2;
  ctx.beginPath();
  ctx.arc(knobCenter.x, knobCenter.y, glyphRadius, arcStart, arcEnd);
  ctx.lineWidth = LINE_WIDTHS.handleGlyph;
  ctx.strokeStyle = COLORS.handleGlyph;
  ctx.stroke();
  const tip = {
    x: knobCenter.x + glyphRadius * Math.cos(arcEnd),
    y: knobCenter.y + glyphRadius * Math.sin(arcEnd),
  };
  const along = { x: -Math.sin(arcEnd), y: Math.cos(arcEnd) };
  const across = { x: Math.cos(arcEnd), y: Math.sin(arcEnd) };
  ctx.beginPath();
  ctx.moveTo(tip.x + along.x * ARROW_HEAD.forward, tip.y + along.y * ARROW_HEAD.forward);
  ctx.lineTo(
    tip.x - along.x * ARROW_HEAD.back + across.x * ARROW_HEAD.halfWidth,
    tip.y - along.y * ARROW_HEAD.back + across.y * ARROW_HEAD.halfWidth,
  );
  ctx.lineTo(
    tip.x - along.x * ARROW_HEAD.back - across.x * ARROW_HEAD.halfWidth,
    tip.y - along.y * ARROW_HEAD.back - across.y * ARROW_HEAD.halfWidth,
  );
  ctx.closePath();
  ctx.fillStyle = COLORS.handleGlyph;
  ctx.fill();
};

const drawDraft = (ctx: CanvasRenderingContext2D, scene: Scene) => {
  const { draftVertices, cursorPx, cursorOnFirstVertex, pendingSegmentCrossesOutline } = scene;
  if (draftVertices.length === 0) {
    return;
  }
  const first = draftVertices[0];
  const last = draftVertices[draftVertices.length - 1];

  if (draftVertices.length > 1) {
    tracePath(ctx, draftVertices, false);
    strokeWithHalo(ctx, COLORS.stroke);
  }

  if (cursorPx) {
    const target = cursorOnFirstVertex ? first : cursorPx;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(target.x, target.y);
    strokeWithHalo(ctx, pendingSegmentCrossesOutline ? COLORS.danger : COLORS.stroke);

    if (!cursorOnFirstVertex && draftVertices.length >= 2) {
      ctx.save();
      ctx.setLineDash(DASH_PATTERNS.closingEdge);
      ctx.beginPath();
      ctx.moveTo(cursorPx.x, cursorPx.y);
      ctx.lineTo(first.x, first.y);
      ctx.lineWidth = LINE_WIDTHS.closingEdge;
      ctx.strokeStyle = COLORS.stroke;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawVertices(ctx, draftVertices);
  if (cursorOnFirstVertex) {
    ctx.beginPath();
    ctx.arc(first.x, first.y, VERTEX_RADIUS + CLOSE_RING_EXTRA_RADIUS, 0, Math.PI * 2);
    ctx.lineWidth = LINE_WIDTHS.closeRing;
    ctx.strokeStyle = pendingSegmentCrossesOutline ? COLORS.danger : COLORS.selected;
    ctx.stroke();
  }
};

export const renderScene = (ctx: CanvasRenderingContext2D, scene: Scene): void => {
  ctx.clearRect(0, 0, scene.canvasSize.width, scene.canvasSize.height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  let selected: PixelPolygon | null = null;
  for (const polygon of scene.polygons) {
    if (polygon.id === scene.deleteHoverId) {
      drawPolygon(ctx, polygon, COLORS.dangerFill, COLORS.danger);
    } else if (polygon.id === scene.selectedId) {
      selected = polygon;
      drawPolygon(ctx, polygon, COLORS.selectedFill, COLORS.selected);
    } else {
      drawPolygon(ctx, polygon, COLORS.fill, COLORS.stroke);
    }
  }
  if (selected) {
    drawSelection(ctx, scene, selected);
  }
  drawDraft(ctx, scene);
};
