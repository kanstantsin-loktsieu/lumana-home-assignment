import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { httpCacheInterceptor } from './core/http/interceptors/http-cache-interceptor';
import { retryInterceptor } from './core/http/interceptors/retry-interceptor';
import { polygonsFeature } from './features/annotation/state/polygons.reducer';
import { queriesFeature } from './features/search/state/queries.reducer';
import { loadNextPage, searchOnQueryChange } from './features/search/state/search.effects';
import { searchFeature } from './features/search/state/search.reducer';

const DEVTOOLS_MAX_ACTIONS = 50;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // fetch is the default backend in Angular 22, so a cancelled request aborts the fetch.
    provideHttpClient(withInterceptors([httpCacheInterceptor, retryInterceptor])),
    provideStore(),
    provideState(searchFeature),
    provideState(queriesFeature),
    provideState(polygonsFeature),
    provideEffects({ searchOnQueryChange, loadNextPage }),
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    ...(isDevMode() ? [provideStoreDevtools({ maxAge: DEVTOOLS_MAX_ACTIONS, trace: false })] : []),
  ],
};
