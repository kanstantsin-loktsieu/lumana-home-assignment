import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import {
  MIN_POLYGON_VERTICES,
  ROTATE_HANDLE_RADIUS_PX,
  SELECTION_BOX_PADDING_PX,
} from '../../../constants/annotation.constants';
import {
  DragState,
  EditorMode,
  NewPolygon,
  PixelPolygon,
  PolygonChange,
  RotateHandle,
  Scene,
} from '../../../models/editor';
import { Point, Size } from '../../../models/geometry';
import { Polygon } from '../../../models/polygon';
import {
  boundingBox,
  canAppendVertex,
  canClose,
  centroid,
  clampTranslation,
  distance,
  fitInside,
  isValidPolygon,
  normalizeWinding,
  pointInPolygon,
  rotateNormalized,
  toPixels,
  translate,
} from '../../../utils/polygon-geometry';
import { nextPolygonId } from '../../../utils/polygon-id';
import { renderScene } from '../../../utils/polygon-renderer';

const CLOSE_TOLERANCE_PX = 10;
const DUPLICATE_VERTEX_TOLERANCE_PX = 3;
// the rotate handle can be grabbed a little outside its drawn knob
const ROTATE_HANDLE_HIT_SLOP_PX = 3;
const ROTATE_HANDLE_HIT_PX = ROTATE_HANDLE_RADIUS_PX + ROTATE_HANDLE_HIT_SLOP_PX;
const ROTATE_HANDLE_DISTANCE_PX = 28;
const ROTATE_HANDLE_EDGE_GAP_PX = 2;
const MESSAGE_TIMEOUT_MS = 3500;
const FALLBACK_ASPECT_RATIO = 4 / 3;
const SPINNER_DIAMETER_PX = 40;
const PRIMARY_MOUSE_BUTTON = 0;

const MODE_HINTS: Record<EditorMode, string> = {
  draw: 'Click to add points. Click the first point, double-click or press Enter to finish.',
  select: 'Drag a shape to move it. Drag the round handle to rotate it.',
  delete: 'Click a shape to delete it.',
};

const MODE_KEYS: Record<string, EditorMode> = { d: 'draw', s: 'select', x: 'delete' };

@Component({
  selector: 'app-polygon-editor',
  imports: [
    MatButtonToggleGroup,
    MatButtonToggle,
    MatButton,
    MatIcon,
    MatProgressSpinner,
    MatTooltip,
  ],
  templateUrl: './polygon-editor.html',
  styleUrl: './polygon-editor.scss',
})
export class PolygonEditor {
  readonly imageUrl = input.required<string>();
  readonly fallbackUrl = input<string | null>(null);
  readonly imageWidth = input<number | null>(null);
  readonly imageHeight = input<number | null>(null);
  readonly imageAlt = input('');
  readonly polygons = input.required<readonly Polygon[]>();

  readonly polygonCreated = output<NewPolygon>();
  readonly polygonChanged = output<PolygonChange>();
  readonly polygonDeleted = output<string>();
  readonly cleared = output<void>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stageRef = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly stageWrapRef = viewChild.required<ElementRef<HTMLElement>>('stageWrap');

  protected readonly mode = signal<EditorMode>('draw');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly modeHint = computed(() => MODE_HINTS[this.mode()]);
  protected readonly spinnerDiameter = SPINNER_DIAMETER_PX;

  protected readonly currentSrc = linkedSignal(() => this.imageUrl());
  protected readonly imageLoaded = linkedSignal({
    source: this.currentSrc,
    computation: () => false,
  });
  protected readonly imageFailed = signal(false);
  protected readonly imageAspectRatio = linkedSignal(() => {
    const width = this.imageWidth();
    const height = this.imageHeight();
    return width && height ? width / height : FALLBACK_ASPECT_RATIO;
  });

  private readonly freeSpaceForImage = signal<Size>({ width: 0, height: 0 });
  protected readonly stageSize = computed<Size>(() => {
    const { width, height } = this.freeSpaceForImage();
    const aspectRatio = this.imageAspectRatio();
    const fitWidth = Math.floor(Math.min(width, height * aspectRatio));
    return { width: fitWidth, height: Math.floor(fitWidth / aspectRatio) };
  });

  private readonly selectedPolygon = computed(
    () => this.polygons().find((polygon) => polygon.id === this.selectedId()) ?? null,
  );

  private canvasSize: Size = { width: 0, height: 0 };
  private draftVertices: Point[] = [];
  private cursorPx: Point | null = null;
  private cursorOnFirstVertex = false;
  private pendingSegmentCrossesOutline = false;
  private deleteHoverId: string | null = null;
  private activeDrag: DragState | null = null;
  private animationFrameId: number | null = null;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.polygons();
      this.mode();
      this.selectedId();
      untracked(() => this.requestDraw());
    });

    // inject() only works in the injection context, not inside the afterNextRender callback.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      const stage = this.stageRef().nativeElement;
      const stageWrap = this.stageWrapRef().nativeElement;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const { target, contentRect } of entries) {
          const observedSize = { width: contentRect.width, height: contentRect.height };
          if (target === stageWrap) {
            this.freeSpaceForImage.set(observedSize);
          } else {
            this.canvasSize = observedSize;
            this.requestDraw();
          }
        }
      });
      resizeObserver.observe(stageWrap);
      resizeObserver.observe(stage);

      // a devicePixelRatio change (other monitor, zoom) does not always resize the stage, so watch
      // it directly to keep the backing store crisp. the query is re-armed for the new ratio.
      let resolutionQuery: MediaQueryList | null = null;
      const onResolutionChange = () => {
        watchResolution();
        this.requestDraw();
      };
      const watchResolution = () => {
        resolutionQuery?.removeEventListener('change', onResolutionChange);
        resolutionQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        resolutionQuery.addEventListener('change', onResolutionChange);
      };
      watchResolution();

      const listeners: [keyof HTMLElementEventMap, (event: never) => void][] = [
        ['pointerdown', (event: PointerEvent) => this.onPointerDown(event)],
        ['pointermove', (event: PointerEvent) => this.onPointerMove(event)],
        ['pointerup', (event: PointerEvent) => this.onPointerUp(event)],
        ['pointercancel', (event: PointerEvent) => this.onPointerCancel(event)],
        ['pointerleave', () => this.onPointerLeave()],
        ['click', (event: MouseEvent) => this.onClick(event)],
        ['keydown', (event: KeyboardEvent) => this.onKeyDown(event)],
      ];
      for (const [type, listener] of listeners) {
        canvas.addEventListener(type, listener as EventListener);
      }
      this.updateCursorStyle(null);

      destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        resolutionQuery?.removeEventListener('change', onResolutionChange);
        for (const [type, listener] of listeners) {
          canvas.removeEventListener(type, listener as EventListener);
        }
        if (this.animationFrameId !== null) {
          cancelAnimationFrame(this.animationFrameId);
        }
        if (this.messageTimer !== null) {
          clearTimeout(this.messageTimer);
        }
      });
    });
  }

  // returns false when there was nothing to cancel, so Esc falls through and closes the dialog.
  handleEscape(): boolean {
    if (this.activeDrag) {
      this.cancelDrag();
      return true;
    }
    if (this.draftVertices.length) {
      this.draftVertices = [];
      this.cursorOnFirstVertex = false;
      this.pendingSegmentCrossesOutline = false;
      this.announce('Drawing cancelled');
      this.requestDraw();
      return true;
    }
    if (this.selectedId()) {
      this.selectedId.set(null);
      return true;
    }
    return false;
  }

  protected setMode(mode: EditorMode): void {
    this.mode.set(mode);
    this.draftVertices = [];
    this.cursorOnFirstVertex = false;
    this.pendingSegmentCrossesOutline = false;
    this.deleteHoverId = null;
    this.cancelDrag();
    if (mode !== 'select') {
      this.selectedId.set(null);
    }
    this.updateCursorStyle(null);
    this.requestDraw();
  }

  protected clearAll(): void {
    this.selectedId.set(null);
    this.cleared.emit();
    this.announce('All shapes removed');
  }

  protected onImageLoad(image: HTMLImageElement): void {
    if (image.naturalWidth && image.naturalHeight) {
      this.imageAspectRatio.set(image.naturalWidth / image.naturalHeight);
    }
    this.imageLoaded.set(true);
  }

  protected onImageError(): void {
    const fallback = this.fallbackUrl();
    if (fallback && this.currentSrc() !== fallback) {
      this.currentSrc.set(fallback);
    } else {
      this.imageFailed.set(true);
    }
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== PRIMARY_MOUSE_BUTTON) {
      return;
    }
    const canvas = this.canvasRef().nativeElement;
    canvas.focus({ preventScroll: true });
    const point = this.toNormalizedPoint(event);
    const pointerPx = this.toPixel(point);

    if (this.mode() === 'delete') {
      const hit = this.hitTest(pointerPx);
      if (hit) {
        this.deleteHoverId = null;
        this.polygonDeleted.emit(hit.id);
        this.announce('Shape deleted');
      }
      return;
    }
    if (this.mode() !== 'select') {
      return;
    }

    const selected = this.selectedPolygon();
    const rotateHandle = selected ? this.rotateHandleFor(selected.points) : null;
    if (
      selected &&
      rotateHandle &&
      distance(pointerPx, rotateHandle.knobCenter) <= ROTATE_HANDLE_HIT_PX
    ) {
      this.startDrag('rotate', selected, event, point, pointerPx);
      return;
    }
    const hit = this.hitTest(pointerPx);
    const polygon = hit && this.polygons().find((polygon) => polygon.id === hit.id);
    if (polygon) {
      this.selectedId.set(polygon.id);
      this.startDrag('move', polygon, event, point, pointerPx);
    } else {
      this.selectedId.set(null);
    }
  }

  private onPointerMove(event: PointerEvent): void {
    const point = this.toNormalizedPoint(event);
    const pointerPx = this.toPixel(point);

    if (this.activeDrag && event.pointerId === this.activeDrag.pointerId) {
      this.updateDrag(point, pointerPx);
      this.requestDraw();
      return;
    }

    switch (this.mode()) {
      case 'draw': {
        this.cursorPx = pointerPx;
        this.cursorOnFirstVertex = this.isOnFirstVertex(pointerPx);
        this.pendingSegmentCrossesOutline = this.cursorOnFirstVertex
          ? !canClose(this.draftVertices)
          : !canAppendVertex(this.draftVertices, point);
        if (this.draftVertices.length) {
          this.requestDraw();
        }
        break;
      }
      case 'select': {
        const selected = this.selectedPolygon();
        const rotateHandle = selected ? this.rotateHandleFor(selected.points) : null;
        if (rotateHandle && distance(pointerPx, rotateHandle.knobCenter) <= ROTATE_HANDLE_HIT_PX) {
          this.updateCursorStyle('grab');
        } else {
          const hit = this.hitTest(pointerPx);
          this.updateCursorStyle(hit ? (hit.id === selected?.id ? 'move' : 'pointer') : null);
        }
        break;
      }
      case 'delete': {
        const hitId = this.hitTest(pointerPx)?.id ?? null;
        if (hitId !== this.deleteHoverId) {
          this.deleteHoverId = hitId;
          this.updateCursorStyle(hitId ? 'pointer' : null);
          this.requestDraw();
        }
        break;
      }
    }
  }

  private onPointerUp(event: PointerEvent): void {
    const drag = this.activeDrag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    this.releaseCapture(drag.pointerId);
    this.activeDrag = null;
    this.updateCursorStyle(drag.kind === 'rotate' ? 'grab' : 'move');
    const changed = drag.previewPoints.some(
      (point, i) => point.x !== drag.originalPoints[i].x || point.y !== drag.originalPoints[i].y,
    );
    if (changed) {
      // one store update per gesture.
      this.polygonChanged.emit({ id: drag.polygonId, points: drag.previewPoints });
      this.announce(drag.kind === 'rotate' ? 'Shape rotated' : 'Shape moved');
    }
    this.requestDraw();
  }

  private onPointerCancel(event: PointerEvent): void {
    if (this.activeDrag && event.pointerId === this.activeDrag.pointerId) {
      this.cancelDrag();
    }
  }

  private onPointerLeave(): void {
    if (this.activeDrag) {
      return;
    }
    this.cursorPx = null;
    this.cursorOnFirstVertex = false;
    this.pendingSegmentCrossesOutline = false;
    if (this.deleteHoverId) {
      this.deleteHoverId = null;
    }
    this.requestDraw();
  }

  private onClick(event: MouseEvent): void {
    if (this.mode() !== 'draw' || event.button !== PRIMARY_MOUSE_BUTTON) {
      return;
    }
    const point = this.toNormalizedPoint(event);
    const pointerPx = this.toPixel(point);

    if (event.detail >= 2) {
      this.tryFinish();
      return;
    }
    if (this.isOnFirstVertex(pointerPx)) {
      this.tryFinish();
      return;
    }
    const last = this.draftVertices.at(-1);
    if (last && distance(this.toPixel(last), pointerPx) < DUPLICATE_VERTEX_TOLERANCE_PX) {
      return;
    }
    if (!canAppendVertex(this.draftVertices, point)) {
      this.announce('That point would make the outline cross itself.');
      return;
    }
    this.draftVertices = [...this.draftVertices, point];
    this.cursorPx = pointerPx;
    this.pendingSegmentCrossesOutline = false;
    this.requestDraw();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'Enter' && this.mode() === 'draw') {
      event.preventDefault();
      this.tryFinish();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selected = this.selectedPolygon();
      if (selected) {
        event.preventDefault();
        this.selectedId.set(null);
        this.polygonDeleted.emit(selected.id);
        this.announce('Shape deleted');
      }
      return;
    }
    const mode = MODE_KEYS[event.key.toLowerCase()];
    if (mode) {
      event.preventDefault();
      this.setMode(mode);
    }
  }

  private tryFinish(): void {
    // e.g. the second click of a double-click on the first vertex, after the first click finished.
    if (this.draftVertices.length === 0) {
      return;
    }
    if (this.draftVertices.length < MIN_POLYGON_VERTICES) {
      this.announce(`A polygon needs at least ${MIN_POLYGON_VERTICES} points.`);
      return;
    }
    if (!canClose(this.draftVertices)) {
      this.announce('Closing here would make the outline cross itself.');
      return;
    }
    if (!isValidPolygon(this.draftVertices, this.canvasSize)) {
      this.announce('The shape is too small.');
      return;
    }
    this.polygonCreated.emit({
      id: nextPolygonId(),
      points: normalizeWinding(this.draftVertices),
      createdAt: Date.now(),
    });
    this.draftVertices = [];
    this.cursorOnFirstVertex = false;
    this.pendingSegmentCrossesOutline = false;
    this.announce('Shape added');
    this.requestDraw();
  }

  private startDrag(
    kind: DragState['kind'],
    polygon: Polygon,
    event: PointerEvent,
    startNormalized: Point,
    pointerPx: Point,
  ): void {
    this.canvasRef().nativeElement.setPointerCapture(event.pointerId);
    this.activeDrag = {
      kind,
      polygonId: polygon.id,
      pointerId: event.pointerId,
      startNormalized,
      originalPoints: polygon.points,
      previewPoints: polygon.points,
      lastPointerPx: pointerPx,
    };
    this.updateCursorStyle(kind === 'rotate' ? 'grabbing' : 'move');
    this.requestDraw();
  }

  private updateDrag(point: Point, pointerPx: Point): void {
    const drag = this.activeDrag;
    if (!drag) {
      return;
    }
    drag.lastPointerPx = pointerPx;
    if (drag.kind === 'move') {
      const [dx, dy] = clampTranslation(
        drag.originalPoints,
        point.x - drag.startNormalized.x,
        point.y - drag.startNormalized.y,
      );
      drag.previewPoints = translate(drag.originalPoints, dx, dy);
    } else {
      const center = centroid(toPixels(drag.originalPoints, this.canvasSize));
      const startPointerPx = this.toPixel(drag.startNormalized);
      const angle =
        Math.atan2(pointerPx.y - center.y, pointerPx.x - center.x) -
        Math.atan2(startPointerPx.y - center.y, startPointerPx.x - center.x);
      const canvasAspectRatio = this.canvasSize.width / this.canvasSize.height;
      const rotated = rotateNormalized(drag.originalPoints, angle, canvasAspectRatio);
      // only accept angles at which the shape still fits the image; otherwise keep the last one
      // that did, so stored points always stay within 0..1.
      const box = boundingBox(rotated);
      if (box.maxX - box.minX <= 1 && box.maxY - box.minY <= 1) {
        drag.previewPoints = fitInside(rotated);
      }
    }
  }

  private cancelDrag(): void {
    if (!this.activeDrag) {
      return;
    }
    this.releaseCapture(this.activeDrag.pointerId);
    this.activeDrag = null;
    this.requestDraw();
  }

  private releaseCapture(pointerId: number): void {
    const canvas = this.canvasRef().nativeElement;
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  }

  private toNormalizedPoint(event: MouseEvent): Point {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    return {
      x: rect.width ? (event.clientX - rect.left) / rect.width : 0,
      y: rect.height ? (event.clientY - rect.top) / rect.height : 0,
    };
  }

  private toPixel(point: Point): Point {
    return { x: point.x * this.canvasSize.width, y: point.y * this.canvasSize.height };
  }

  private isOnFirstVertex(pointerPx: Point): boolean {
    return (
      this.draftVertices.length >= MIN_POLYGON_VERTICES &&
      distance(this.toPixel(this.draftVertices[0]), pointerPx) <= CLOSE_TOLERANCE_PX
    );
  }

  // reverse z-order, so the topmost polygon under the pointer wins.
  private hitTest(pointerPx: Point): PixelPolygon | null {
    const shapes = this.pixelPolygons();
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (pointInPolygon(pointerPx, shapes[i].points)) {
        return shapes[i];
      }
    }
    return null;
  }

  // always inside the canvas so the handle stays visible and clickable: above the top-centre of
  // the bounding box, else below it, else inside the box near its top edge (for shapes that span
  // almost the full height).
  private rotateHandleFor(points: readonly Point[]): RotateHandle {
    const box = boundingBox(toPixels(points, this.canvasSize));
    const margin = ROTATE_HANDLE_RADIUS_PX + ROTATE_HANDLE_EDGE_GAP_PX;
    const clamp = (value: number, max: number) => Math.min(Math.max(value, margin), max - margin);
    const x = clamp((box.minX + box.maxX) / 2, this.canvasSize.width);
    if (box.minY - ROTATE_HANDLE_DISTANCE_PX >= margin) {
      return {
        shapeAnchor: { x, y: box.minY - SELECTION_BOX_PADDING_PX },
        knobCenter: { x, y: box.minY - ROTATE_HANDLE_DISTANCE_PX },
      };
    }
    if (box.maxY + ROTATE_HANDLE_DISTANCE_PX <= this.canvasSize.height - margin) {
      return {
        shapeAnchor: { x, y: box.maxY + SELECTION_BOX_PADDING_PX },
        knobCenter: { x, y: box.maxY + ROTATE_HANDLE_DISTANCE_PX },
      };
    }
    const y = clamp(box.minY + ROTATE_HANDLE_DISTANCE_PX, this.canvasSize.height);
    return { shapeAnchor: { x, y: box.minY }, knobCenter: { x, y } };
  }

  private pixelPolygons(): PixelPolygon[] {
    const drag = this.activeDrag;
    return this.polygons().map((polygon) => ({
      id: polygon.id,
      points: toPixels(
        drag?.polygonId === polygon.id ? drag.previewPoints : polygon.points,
        this.canvasSize,
      ),
    }));
  }

  private updateCursorStyle(cssCursor: string | null): void {
    const fallback = this.mode() === 'draw' ? 'crosshair' : 'default';
    this.canvasRef().nativeElement.style.cursor = cssCursor ?? fallback;
  }

  private announce(text: string): void {
    this.message.set(text);
    if (this.messageTimer !== null) {
      clearTimeout(this.messageTimer);
    }
    this.messageTimer = setTimeout(() => this.message.set(null), MESSAGE_TIMEOUT_MS);
  }

  private requestDraw(): void {
    if (this.animationFrameId !== null) {
      return;
    }
    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;
      this.draw();
    });
  }

  private draw(): void {
    const canvas = this.canvasRef().nativeElement;
    const { width, height } = this.canvasSize;
    if (!width || !height) {
      return;
    }
    // device-pixel-ratio aware backing store: crisp lines on HiDPI screens and when zoomed.
    const pixelRatio = window.devicePixelRatio || 1;
    const backingWidth = Math.round(width * pixelRatio);
    const backingHeight = Math.round(height * pixelRatio);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const drag = this.activeDrag;
    const selectedId = this.selectedId();
    const selected = this.selectedPolygon();
    let rotateHandle: Scene['rotateHandle'] = null;
    if (this.mode() === 'select' && selected) {
      if (drag?.kind === 'rotate') {
        const shapeAnchor = centroid(toPixels(drag.previewPoints, this.canvasSize));
        rotateHandle = { shapeAnchor, knobCenter: drag.lastPointerPx };
      } else {
        rotateHandle = this.rotateHandleFor(
          drag?.polygonId === selected.id ? drag.previewPoints : selected.points,
        );
      }
    }

    const scene: Scene = {
      canvasSize: this.canvasSize,
      polygons: this.pixelPolygons(),
      selectedId,
      deleteHoverId: this.mode() === 'delete' ? this.deleteHoverId : null,
      draftVertices: toPixels(this.draftVertices, this.canvasSize),
      cursorPx: this.mode() === 'draw' ? this.cursorPx : null,
      cursorOnFirstVertex: this.cursorOnFirstVertex,
      pendingSegmentCrossesOutline: this.pendingSegmentCrossesOutline,
      rotateHandle,
    };
    renderScene(ctx, scene);
  }
}
