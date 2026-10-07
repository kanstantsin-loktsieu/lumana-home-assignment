import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from '@angular/cdk/scrolling';
import { DatePipe, DecimalPipe, formatNumber } from '@angular/common';
import {
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RenderedRange } from '../../../../../shared/directives/rendered-range';
import { MAX_REACHABLE_RESULTS } from '../../../constants/search.constants';
import { SearchResultItem } from '../../../models/search-result';
import { SearchStatus } from '../../../models/search-state';

@Component({
  selector: 'app-results-list',
  imports: [
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    RenderedRange,
    DatePipe,
    DecimalPipe,
    MatButton,
    MatIcon,
    MatProgressBar,
  ],
  templateUrl: './results-list.html',
  styleUrl: './results-list.scss',
  host: {
    '[style.--row-height.px]': 'rowHeight',
    '[style.--thumb-width.px]': 'thumbWidth',
    '[style.--thumb-height.px]': 'thumbHeight',
  },
})
export class ResultsList {
  readonly items = input.required<readonly SearchResultItem[]>();
  readonly status = input.required<SearchStatus>();
  readonly query = input.required<string>();
  readonly totalHits = input.required<number>();
  readonly canLoadMore = input.required<boolean>();
  readonly isCapped = input.required<boolean>();
  readonly errorMessage = input<string | null>(null);

  readonly nearEnd = output<void>();
  readonly opened = output<SearchResultItem>();
  readonly retry = output<void>();

  private readonly renderedRange = viewChild(RenderedRange);
  private readonly locale = inject(LOCALE_ID);

  protected readonly rowHeight = 88;
  protected readonly thumbWidth = 104;
  protected readonly thumbHeight = 72;
  protected readonly minBufferPx = this.rowHeight * 5;
  protected readonly maxBufferPx = this.rowHeight * 10;
  protected readonly templateCacheSize = 40;
  protected readonly maxReachable = MAX_REACHABLE_RESULTS;
  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);
  protected readonly rowsFromEndToPrefetch = 15;

  protected readonly hasItems = computed(() => this.items().length > 0);
  protected readonly reachedEnd = computed(
    () => this.status() === 'loaded' && this.hasItems() && !this.canLoadMore() && !this.isCapped(),
  );

  /**
   * Screen-reader summary. While the same query loads more pages (loaded → loadingMore → loaded)
   * it keeps its text, so the count is not announced again; a new query always starts fresh.
   */
  protected readonly announcement = linkedSignal<
    { status: SearchStatus; query: string; totalHits: number },
    string
  >({
    source: () => ({ status: this.status(), query: this.query(), totalHits: this.totalHits() }),
    computation: ({ status, query, totalHits }, previous) => {
      if (status === 'idle') {
        return '';
      }
      const sameQuery = previous?.source.query === query;
      if (status === 'loading' || status === 'loadingMore') {
        return sameQuery ? previous.value : '';
      }
      if (status === 'error') {
        // A failed later page is announced by the footer's alert; a failed first page here.
        return sameQuery ? previous.value : `Search for ${query} failed`;
      }
      if (totalHits === 0) {
        return `No images match ${query}`;
      }
      const count = formatNumber(totalHits, this.locale);
      return `${count} ${totalHits === 1 ? 'result' : 'results'} for ${query}`;
    },
  });

  protected readonly trackByNasaId = (_: number, item: SearchResultItem): string => item.nasaId;

  constructor() {
    effect(() => {
      const range = this.renderedRange()?.range();
      if (
        range &&
        this.canLoadMore() &&
        range.end >= this.items().length - this.rowsFromEndToPrefetch
      ) {
        this.nearEnd.emit();
      }
    });
  }
}
