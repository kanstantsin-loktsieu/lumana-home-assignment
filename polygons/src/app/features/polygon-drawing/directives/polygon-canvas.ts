import { computed, Directive, effect, ElementRef, inject, input, OnInit, signal } from '@angular/core';
import { Polygon } from '../../../core/model/polygon';

@Directive({
  selector: '[polygonCanvas]',
})
export class PolygonCanvas {
  readonly imageId = input.required<number>({ alias: 'imageId' });

  private readonly polygons = signal<Polygon[]>([]);
  private readonly denormalizedPolygons = computed(() => this.polygons().map(polygon => {
    return new Polygon(polygon.vertices.map(vertex => this.normalizedToAbsolute(vertex.x, vertex.y)));
  }));
  private readonly canvas = inject(ElementRef).nativeElement as HTMLCanvasElement;
  private readonly ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

  private readonly fillStyle = 'rgba(0, 0, 255, 0.5)';
  private readonly strokeStyle = 'rgba(255, 0, 0, 1)';

  constructor() {
    effect(() => this.rerender());
  }

  private getPathFromPoints(points: Array<{ x: number; y: number }>): Path2D {
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
    console.log(this.denormalizedPolygons());
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = this.fillStyle;
    this.ctx.strokeStyle = this.strokeStyle;
    this.ctx.lineWidth = 3;
    this.denormalizedPolygons().forEach(polygon => this.renderPolygon(polygon));
  }

  private normalizedToAbsolute(x: number, y: number): { x: number; y: number } {
    return {
      x: x * this.width,
      y: y * this.height
    };
  }

  private get width() {
    return this.canvas.offsetWidth;
  }

  private get height() {
    return this.canvas.offsetHeight;
  }
}
