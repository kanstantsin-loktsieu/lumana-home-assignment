# Image Explorer

A typeahead search over the [NASA Image and Video Library](https://images.nasa.gov) with polygon
annotation. Results stream into a virtual-scrolled list as you type, past searches come back as
word-by-word suggestions, and any result opens in a dialog where you can draw, move and rotate
polygons on a canvas over the image. Polygons are kept per image and reappear when you reopen it.

This is the frontend part of the home assignment (`REQUIREMENTS.pdf`). No backend is needed: the
app talks to the public NASA API directly, which needs no API key.

## Run

Requires **Node `^24.15.0` or `>=26`** (Angular CLI 22.2 refuses older Node 24 releases) and npm 11.

```bash
npm ci
npm start          # http://localhost:4200
npm run build      # production build in dist/lumana-image-search/browser
```

With the [Redux DevTools](https://github.com/reduxjs/redux-devtools) browser extension you can
watch every action and the three state slices in development mode.

## Stack

- **Angular 22.2**: standalone components, zoneless change detection, OnPush by default, signals
  (`input()`, `output()`, `model()`, `viewChild()`, `computed`, `linkedSignal`, `effect`),
  **signal forms** (`form()` + `validate()`, with the search box as a custom `FormValueControl`
  bound through `[formField]`), native `animate.enter`/`animate.leave`, `@Service()` and the
  built-in control flow. Components stay signal-only; RxJS lives in effects, interceptors and the
  API service, and is converted with `toSignal` where a component needs it.
- **Angular Material 3 + CDK**: theme via `mat.theme()` following the OS light/dark setting,
  autocomplete, dialog, button toggles, and the CDK virtual scroller.
- **NgRx 22**: `@ngrx/store` (`createActionGroup`, `createFeature` with `extraSelectors`),
  `@ngrx/effects` (functional effects), `@ngrx/entity` (entity adapters for all three slices) and
  the store devtools in dev mode. Components read state with `store.selectSignal`.

## Architecture

```
src/styles/                    global stylesheet + Sass partials (@use'd by components)
src/app/
  core/http/                   HttpCache service, cache + retry interceptors, models/
  shared/
    constants/  directives/    HTTP constants; RenderedRange (CDK range as a signal)
    models/     utils/         LRU cache, query normalization and word breakdown
  features/search/
    api/                       NASA API service
    constants/                 page size, result cap
    models/                    DTOs, result/state/suggestion/saved-query models
    utils/                     DTO mapper, error mapping, pagination, history, suggestions
    state/                     search.actions / search.reducer / search.effects,
                               queries.reducer (+ entity adapter)
    components/
      search-page/             container: owns the signal form and the store wiring
        search-box/            presentational FormValueControl + autocomplete
        results-list/          virtual scroll list with batch pagination
  features/annotation/
    constants/  models/        shared editor constants; polygon, geometry, editor models
    utils/                     pure polygon geometry, canvas renderer, polygon ids
    state/                     polygon.actions / polygons.reducer
    components/
      image-dialog/            container: one image, store wiring (lazy-loaded)
        polygon-editor/        canvas editor (presentational)
```

Conventions: components live under `components/`, child components inside their parent's folder, types and interfaces live in
`models/`, helper functions and classes in `utils/`, and shared constants in `constants/`
(single-use constants stay next to their consumer). NgRx files follow NgRx's own naming
(`*.actions.ts`, `*.reducer.ts`, `*.effects.ts`).

**State slices**

| Slice      | Holds                                                     | Entity adapter key |
| ---------- | --------------------------------------------------------- | ------------------ |
| `search`   | current query, loaded results, page, total, status, error | `nasaId`           |
| `queries`  | meaningful past queries with usage count and last use     | normalized query   |
| `polygons` | polygons of all images (selected per image)               | polygon id         |

**Action flow:** typing → `[Search Page] Query Changed` → debounced effect → NASA API →
`[NASA Search API] Page Loaded` → the `search` reducer stores the page, and the `queries` reducer
remembers the query if it was meaningful. Scrolling near the end dispatches
`Next Page Requested` → paging effect → `Page Loaded` (page n). The polygon editor emits one
event per gesture, and the dialog turns it into a `[Polygon Editor] …` action.

## Optimizations

**Network**

- 300 ms debounce, query normalization (trim, collapse spaces, lowercase) and
  `distinctUntilChanged`, so "Moon " and "moon" are one request.
- Nothing is requested below 2 characters. NASA search matches whole words, not prefixes: `a`
  returns the whole library and `m` matches stray "M" tokens.
- `switchMap` cancels the previous search. Fetch is the default `HttpClient` backend in Angular
  22, so the HTTP request is really aborted.
- `exhaustMap` drops duplicate "load next page" triggers while a page is in flight, and
  `takeUntil` aborts a page request as soon as a new query starts.
- **Cache interceptor**: an in-memory response cache for GETs (5-minute TTL matching the API's
  `max-age=300`, 100-entry LRU). It also shares identical in-flight requests, using
  `shareReplay({ refCount: true })`, so cancellation still aborts the fetch. Both stores are
  private to the `HttpCache` service, which exposes get/set methods and handles expiry itself.
  Within the TTL, retyping a query, backspacing to an earlier one or picking a recent suggestion
  costs no network round-trip. The cache stays in the HTTP layer rather than the store: it holds
  raw, non-serializable responses and shared in-flight requests, which do not belong in app state.
- **Retry interceptor**: two retries with backoff for transient failures (network error, 429,
  502–504), cancellable along with the request. If a page still fails, the list shows a Retry
  button. A failed page is never re-requested automatically.
- Punctuation does not count towards the 2-character minimum, so input like `--` or `a.` is never
  sent. The API would treat it like an empty or one-letter query and return the whole library.
- Page size 50: about 0.4 s and 56 KB per page, the fewest round-trips before latency jumps.
- The dialog image is the best rendition the item actually has (`~large` → `~medium` →
  `~small` → `~thumb`), picked from the item's `links[]`. URLs are never guessed, and `~orig` is
  never used because it can be a 7776×11580 PNG or a TIFF.
- `preconnect` hints for the API and image hosts.

**DOM and rendering**

- CDK virtual scroll with a fixed 88 px row: about 20 rows in the DOM, however many results are
  loaded. Rows use `trackBy` on `nasaId` and a template cache.
- Zoneless + OnPush + signals: only components whose signals changed are checked.
- Thumbnails are `loading="lazy"` and `decoding="async"`, and have intrinsic sizes, so nothing
  shifts while they load.
- The image dialog, which holds the canvas editor, is a lazily loaded chunk.

**State**

- Entity adapters: results are de-duplicated across pages, and lookups are O(1).
- Memoized selectors. Saved queries are tokenized once per history change, not per keystroke.
  Suggestion ranking is a `computed` over that index and the input.
- Race guard: a page response is applied only if it belongs to the current query and is the next
  page.

**Canvas**

- Redraws are coalesced into one `requestAnimationFrame` and happen only when something changed.
- Pointer listeners are attached outside the template, so pointer moves never trigger change
  detection.
- A drag or rotation keeps its preview locally and dispatches **once**, on pointer up.
- The backing store follows `devicePixelRatio`, so lines stay crisp on HiDPI screens and when
  zoomed.

## Query history and suggestions

- **Meaningful query:** the first page of the search completed with at least one hit. Empty
  searches are never saved.
- **Every meaningful query is kept**, including prefixes and substrings of other saved queries:
  typing "apol" (3 hits), then "apollo" saves both. Queries are normalized, so "Moon" and "moon "
  are one entry. Repeating a saved query increases its usage count. The oldest entries are
  evicted beyond 100.
- **Word breakdown:** the input and each saved query are split into words. A saved query matches
  when any input word is a prefix of any of its words, in any order: "11 apo" suggests
  "apollo 11". Ranking is by matched words, then usage, then recency. Matched parts are
  highlighted. Focusing the empty input lists recent searches. Picking a suggestion searches
  immediately, without the debounce.

## Polygon editor

| Mode   | Mouse                                                                                            | Keyboard         |
| ------ | ------------------------------------------------------------------------------------------------ | ---------------- |
| Draw   | click to add points; click the first point, double-click, or press Enter to finish               | `D`, Enter, Esc  |
| Select | click a shape to select it; drag it to move; drag the round handle to rotate it about its centre | `S`, Delete, Esc |
| Delete | click a shape to delete it (hovered shapes turn red)                                             | `X`              |

**Clear** removes every shape on the current image. Esc first cancels a drawing or selection,
and a second Esc closes the dialog.

**Polygon model.** `points` defines exactly one polygon:

- It is an **ordered ring**. Edges join consecutive points, plus an implicit closing edge from the
  last point to the first, which is not repeated.
- It has at least 3 points, and no two consecutive points are equal.
- It is **simple**: no edges cross or touch. The editor rejects a click or a close that would
  cross the outline, and the pending segment turns red before you click.
- It has **canonical winding**: counter-clockwise on screen, reversed on creation if needed, so
  the same shape always has the same array.
- Coordinates are **normalized** (0..1 of the image), so shapes stay pinned to the same image
  features at any size.

Order-defined edges were chosen over forcing convexity, because a convex hull would silently
replace concave shapes such as an L-shape or an object outline. Simplicity is what makes
hit-testing (even-odd) agree with what the canvas fills. Moving and rotating are rigid motions, so
they preserve all of the above. Rotation runs in aspect-correct space, so shapes never shear on
non-square images, and it is applied to the points directly; no angle is stored.

The image box is fitted into the dialog with the image's aspect ratio, and the canvas lies exactly
on top of it, so converting between normalized and pixel coordinates is a plain scale.

## Decisions and trade-offs

- **Debounce in the effect, not the signal-form `debounce()` rule:** suggestions read the same
  model and should update on every keystroke.
- **The history keeps every meaningful query:** nothing is merged or superseded, so partial words
  that happened to have hits (e.g. "apol") also stay in the history.
- **Classic NgRx store, not SignalStore:** the assignment asks for actions, effects, reducers and
  selectors, and for the entity adapter.
- **The dialog is opened from the container, not from an effect:** it is stateless UI navigation.
- **Clear has no confirmation.**
- **The initial bundle budget warning is raised to 750 kB:** Material and NgRx come to about
  680 kB raw, 160 kB transferred.

## Limits

- The NASA API serves at most 10,000 results per query (`page × page_size ≤ 10000`). The list
  ends there with a hint to refine the search.
- State is in memory only and resets on reload. This was decided for the assignment.
- No automated tests, because the assignment does not ask for them.
