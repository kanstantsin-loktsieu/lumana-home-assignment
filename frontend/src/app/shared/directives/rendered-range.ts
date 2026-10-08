import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Directive, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

// the directive lives and dies with the viewport, so the stream is converted once, with no
// re-subscribing when the list appears and disappears.
@Directive({ selector: 'cdk-virtual-scroll-viewport[appRenderedRange]' })
export class RenderedRange {
  private readonly viewport = inject(CdkVirtualScrollViewport);

  readonly range = toSignal(this.viewport.renderedRangeStream, {
    initialValue: this.viewport.getRenderedRange(),
  });
}
