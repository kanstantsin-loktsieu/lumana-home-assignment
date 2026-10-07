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
import { SearchStatus } from '../../models/search-state';
import { SearchResultItem } from '../../models/search-result';
import { ResultsList } from './results-list/results-list';
import { SearchBox } from './search-box/search-box';
import { SearchPageActions } from '../../state/search.actions';
import { queriesFeature } from '../../state/queries.reducer';
import { searchFeature } from '../../state/search.reducer';
import { rankSuggestions } from '../../utils/query-suggestions';
import { queryTooShortError } from '../../utils/searchable-query';

/** The image dialog grows with the viewport up to these sizes, and never past this share of it. */
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
  /** Prevents a double-click from opening two dialogs while the chunk loads. */
  private isOpeningDialog = false;

  private readonly hero = viewChild.required<ElementRef<HTMLElement>>('hero');
  private readonly searchBox = viewChild.required(SearchBox);

  protected readonly results = this.store.selectSignal(searchFeature.selectResults);
  protected readonly status = this.store.selectSignal(searchFeature.selectStatus);
  /**
   * The intro only animates back in after a search was cleared; on first load it is simply there,
   * so the page does not shift while it renders.
   */
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
  /** Ranked on every keystroke (no debounce), so suggestions feel instant. */
  protected readonly suggestions = computed(() =>
    rankSuggestions(this.queryIndex(), this.searchModel().query),
  );

  constructor() {
    // Reactive dispatch: re-dispatches whenever the query changes; the effect debounces it.
    this.store.dispatch(() => SearchPageActions.queryChanged({ query: this.searchModel().query }));

    // Clearing the search brings the hero back (headline + padding transition), which moves the
    // search box down after the suggestions panel has opened. The panel is positioned once on open,
    // so re-anchor it on every frame in which the hero's size changes.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.searchBox().repositionPanel());
      observer.observe(this.hero().nativeElement, { box: 'border-box' });
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** A picked suggestion is searched immediately, without the typing debounce. */
  protected onSuggestionPicked(query: string): void {
    this.store.dispatch(SearchPageActions.suggestionPicked({ query }));
  }

  protected loadMore(): void {
    this.store.dispatch(SearchPageActions.nextPageRequested());
  }

  /** Retries whatever failed: the first page of the query, or the next page of the list. */
  protected retry(): void {
    this.store.dispatch(SearchPageActions.retryRequested());
  }

  /**
   * The dialog is stateless UI navigation, so it is opened here rather than through an effect.
   * It is loaded lazily: the canvas editor is not needed until the first result is opened.
   */
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
