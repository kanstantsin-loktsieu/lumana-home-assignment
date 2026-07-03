import { computed, Directive, effect, ElementRef, inject, input, signal } from '@angular/core';
import { Point, Polygon } from '../../../core/model/polygon';
import { Store } from '@ngrx/store';
import { selectImagePolygons } from '../../../store/image-polygons/selectors';
import { ImagePolygonsActions } from '../../../store/image-polygons/actions';

@Directive({
  selector: '[polygonCanvas]',
  host: {
    '(click)': 'handleClick($event)',
    '(mousemove)': 'handleMouseMove($event)'
  }
})
export class PolygonCanvas {
  private readonly store = inject(Store);

  readonly imageId = input.required<number>({ alias: 'imageId' });

  private readonly polygons = computed(() => this.store.selectSignal(selectImagePolygons)()[this.imageId()] ?? []);
  private readonly selectedPolygonIndex = signal(-1);
  private readonly currDrawnPolygonVertices = signal<Array<Point>>([]);
  private readonly drawingPolygon = computed(() => this.currDrawnPolygonVertices().length > 0);
  private readonly pointerCoordinates = signal<Point>({ x: 0, y: 0 });

  private readonly canvas = inject(ElementRef).nativeElement as HTMLCanvasElement;
  private readonly ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  private get width() { return this.canvas.offsetWidth }
  private get height() {  return this.canvas.offsetHeight }

  private readonly fillStyle = 'rgba(0, 0, 255, 0.5)';
  private readonly strokeStyle = 'rgba(255, 0, 0, 1)';
  private readonly boundaryWidth = 2;

  constructor() {
    effect(() => this.rerender());
  }

  private getPathFromPoints(points: Array<Point>): Path2D {
    const path = new Path2D();
    if (!points.length) {
      return path;
    }
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y);
    }
    path.closePath();
    return path;
  }

  private renderPolygon(polygon: Polygon, selected = false) {
    const boundaryPath = this.getPathFromPoints(polygon.vertices);
    this.ctx.fill(boundaryPath);
    this.ctx.stroke(boundaryPath);
  }

  private rerender() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = this.fillStyle;
    this.ctx.strokeStyle = this.strokeStyle;
    this.ctx.lineWidth = this.boundaryWidth;
    this.polygons().forEach((polygon, index) => this.renderPolygon(polygon, index === this.selectedPolygonIndex()));
    if (this.drawingPolygon()) {
      this.ctx.stroke(this.getPathFromPoints([...this.currDrawnPolygonVertices(), this.pointerCoordinates()]));
    }
  }

  private storeNewPolygon(polygon: Polygon) {
    this.store.dispatch(ImagePolygonsActions.addPolygon({ imageId: this.imageId(), polygon }));
  }

  private stopDrawingPolygon() {
    if (this.currDrawnPolygonVertices().length > 2) {
      this.storeNewPolygon(new Polygon(this.currDrawnPolygonVertices()));
    }
    this.currDrawnPolygonVertices.set([]);
  }

  protected handleMouseMove(event: MouseEvent) {
    this.pointerCoordinates.set({ x: event.offsetX, y: event.offsetY });
  }

  protected handleClick(event: PointerEvent) {
    const canvasPoint = { x: event.offsetX, y: event.offsetY };

    const newSelectedPolygonIndex = this.polygons().findIndex(polygon => polygon.containsPoint(canvasPoint));
    if (newSelectedPolygonIndex !== this.selectedPolygonIndex()) {
      this.selectedPolygonIndex.set(newSelectedPolygonIndex);
      return;
    }

    this.currDrawnPolygonVertices.update(prev => [...prev, canvasPoint]);
    if (event.shiftKey && this.drawingPolygon()) {
      this.stopDrawingPolygon();
    }
  }
}
