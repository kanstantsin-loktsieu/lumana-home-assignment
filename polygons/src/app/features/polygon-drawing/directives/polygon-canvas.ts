import { computed, Directive, effect, ElementRef, inject, input, linkedSignal, signal } from '@angular/core';
import { Polygon } from '../../../core/model/polygon';

interface Point {
  x: number,
  y: number
}

@Directive({
  selector: '[polygonCanvas]',
  host: {
    '(click)': 'handleClick($event)',
    '(mousemove)': 'handleMouseMove($event)'
  }
})
export class PolygonCanvas {
  readonly imageId = input.required<number>({ alias: 'imageId' });

  private readonly storedPolygons = signal<Polygon[]>([]);
  private readonly newPolygons = signal<Polygon[]>([]);
  private readonly renderedPolygons = computed(() => [...this.storedPolygons(), ...this.newPolygons()]);
  private readonly currDrawnPolygonVertices = signal<Array<Point>>([]);
  private readonly pointerCoordinates = signal<Point>({ x: 0, y: 0 });

  private readonly canvas = inject(ElementRef).nativeElement as HTMLCanvasElement;
  private readonly ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  private get width() { return this.canvas.offsetWidth }
  private get height() {  return this.canvas.offsetHeight }

  private readonly fillStyle = 'rgba(0, 0, 255, 0.5)';
  private readonly strokeStyle = 'rgba(255, 0, 0, 1)';

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

  private renderPolygon(polygon: Polygon) {
    const boundaryPath = this.getPathFromPoints(polygon.vertices);
    this.ctx.fill(boundaryPath);
    this.ctx.stroke(boundaryPath);
  }

  private rerender() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = this.fillStyle;
    this.ctx.strokeStyle = this.strokeStyle;
    this.ctx.lineWidth = 3;
    this.renderedPolygons().forEach(polygon => this.renderPolygon(polygon));
    if (this.currDrawnPolygonVertices().length) {
      this.ctx.stroke(this.getPathFromPoints([...this.currDrawnPolygonVertices(), this.pointerCoordinates()]));
    }
  }

  protected handleMouseMove(event: MouseEvent) {
    this.pointerCoordinates.set({ x: event.offsetX, y: event.offsetY });
  }

  protected handleClick(event: PointerEvent) {
    const canvasPoint = { x: event.offsetX, y: event.offsetY };
    this.currDrawnPolygonVertices.update(prev => [...prev, canvasPoint]);
    if (event.shiftKey) {
      this.newPolygons.update(prev => [...prev, new Polygon(this.currDrawnPolygonVertices())]);
      this.currDrawnPolygonVertices.set([]);
    }
  }
}
