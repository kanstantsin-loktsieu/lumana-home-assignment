export interface Point {
  x: number;
  y: number;
}

export class Polygon {
  public readonly vertices: Array<Point>;
  public readonly geometricProperties = {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    centerX: 0,
    centerY: 0
  };

  constructor(vertices: Array<Point>) {
    this.vertices = vertices.slice();
    this.initGeometricProperties(vertices);
  }

  // it's crude and mathematically incorrect, but sufficient
  public containsPoint(point: Point) {
    return point.x >= this.geometricProperties.minX
      && point.x <= this.geometricProperties.maxX
      && point.y >= this.geometricProperties.minY
      && point.y <= this.geometricProperties.maxY;
  }

  private initGeometricProperties(vertices: Array<Point>) {
    vertices.forEach(vertex => {
      this.geometricProperties.minX = Math.min(this.geometricProperties.minX ?? vertex.x, vertex.x);
      this.geometricProperties.maxX = Math.max(this.geometricProperties.maxX ?? vertex.x, vertex.x);
      this.geometricProperties.minY = Math.min(this.geometricProperties.minY ?? vertex.y, vertex.y);
      this.geometricProperties.maxY = Math.max(this.geometricProperties.maxY ?? vertex.y, vertex.y);
    });
    this.geometricProperties.centerX = this.geometricProperties.minX + (this.geometricProperties.maxX - this.geometricProperties.minX) / 2;
    this.geometricProperties.centerY = this.geometricProperties.minY + (this.geometricProperties.maxY - this.geometricProperties.minY) / 2;
  }
}