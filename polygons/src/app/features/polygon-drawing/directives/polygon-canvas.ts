import { Directive, ElementRef, inject, input, OnInit } from '@angular/core';

@Directive({
  selector: '[polygonCanvas]',
})
export class PolygonCanvas implements OnInit {
  readonly imageId = input.required<number>({ alias: 'imageId' });

  private readonly canvasRef = inject(ElementRef);
  private readonly canvas = this.canvasRef.nativeElement;

  ngOnInit(): void {
    console.log(this.canvas);
  }
}
