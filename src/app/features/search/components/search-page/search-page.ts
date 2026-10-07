import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, validate } from '@angular/forms/signals';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import type { ImageDialog } from '../../../annotation/components/image-dialog/image-dialog';
import { ImageDialogData } from '../../../annotation/models/image-dialog-data';
import { SearchResultItem } from '../../models/search-result';
import { SearchStatus } from '../../models/search-state';
import { queriesFeature } from '../../state/queries.reducer';
import { SearchPageActions } from '../../state/search.actions';
import { searchFeature } from '../../state/search.reducer';
import { rankSuggestions } from '../../utils/query-suggestions';
import { queryTooShortError } from '../../utils/searchable-query';
import { ResultsList } from './results-list/results-list';
import { SearchBox } from './search-box/search-box';

const DIALOG_MAX_WIDTH_PX = 1100;
const DIALOG_MAX_HEIGHT_PX = 1000;
const DIALOG_VIEWPORT_PERCENT = 96;

@Component({
  selector: 'app-search-page',
  imports: [FormField, SearchBox, ResultsList],
  templateUrl: './search-page.html',
  styleUrl: './search-page.scss',
})
export class SearchPage {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private isOpeningDialog = false;

  private readonly hero = viewChild.required<ElementRef<HTMLElement>>('hero');
  private readonly searchBox = viewChild.required(SearchBox);

  protected readonly results = this.store.selectSignal(searchFeature.selectResults);
  protected readonly status = this.store.selectSignal(searchFeature.selectStatus);
  protected readonly hasLeftIdle = linkedSignal<SearchStatus, boolean>({
    source: this.status,
    computation: (status, previous) => (previous?.value ?? false) || status !== 'idle',
  });
  protected readonly query = this.store.selectSignal(searchFeature.selectQuery);
  protected readonly totalHits = this.store.selectSignal(searchFeature.selectTotalHits);
  protected readonly canLoadMore = this.store.selectSignal(searchFeature.selectCanLoadMore);
  protected readonly isCapped = this.store.selectSignal(searchFeature.selectIsCapped);
  private readonly error = this.store.selectSignal(searchFeature.selectError);
  protected readonly errorMessage = computed(() => this.error()?.message ?? null);

  protected readonly searchModel = signal({ query: '' });
  protected readonly searchForm = form(this.searchModel, (path) => {
    validate(path.query, ({ value }) => queryTooShortError(value()));
  });

  private readonly queryIndex = this.store.selectSignal(queriesFeature.selectQueryIndex);
  protected readonly suggestions = computed(() =>
    rankSuggestions(this.queryIndex(), this.searchModel().query),
  );

  constructor() {
    this.store.dispatch(() => SearchPageActions.queryChanged({ query: this.searchModel().query }));

    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.searchBox().repositionPanel());
      observer.observe(this.hero().nativeElement, { box: 'border-box' });
      inject(DestroyRef).onDestroy(() => observer.disconnect());
    });
  }

  protected onSuggestionPicked(query: string): void {
    this.store.dispatch(SearchPageActions.suggestionPicked({ query }));
  }

  protected loadMore(): void {
    this.store.dispatch(SearchPageActions.nextPageRequested());
  }

  protected retry(): void {
    this.store.dispatch(SearchPageActions.retryRequested());
  }

  protected async openImageDialog(image: SearchResultItem): Promise<void> {
    if (this.isOpeningDialog || this.dialog.openDialogs.length > 0) {
      return;
    }
    this.isOpeningDialog = true;
    try {
      const { ImageDialog } =
        await import('../../../annotation/components/image-dialog/image-dialog');
      this.dialog.open<ImageDialog, ImageDialogData>(ImageDialog, {
        data: { image },
        width: `min(${DIALOG_MAX_WIDTH_PX}px, ${DIALOG_VIEWPORT_PERCENT}vw)`,
        maxWidth: `${DIALOG_VIEWPORT_PERCENT}vw`,
        height: `min(${DIALOG_VIEWPORT_PERCENT}dvh, ${DIALOG_MAX_HEIGHT_PX}px)`,
        maxHeight: `${DIALOG_VIEWPORT_PERCENT}dvh`,
        autoFocus: 'dialog',
        restoreFocus: true,
        panelClass: 'image-dialog-panel',
      });
    } finally {
      this.isOpeningDialog = false;
    }
  }
}
