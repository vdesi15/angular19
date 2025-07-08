import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { filter, switchMap, take, tap, forkJoin, map, of } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { AuthService } from '../services/auth.service';
import { SplashScreenService } from '../services/splash-screen.service';
import { SearchFilterService } from '../services/filters.service';
import { SearchFilterMetadataApiService } from '../services/search-filter-metadata-api.service';
import { ColumnDefinitionService } from '../services/column-definition.service';
import { ViewDefinitionService } from '../services/view-definition.service';

export const startupResolver: ResolveFn<boolean> = () => {
  const authService = inject(AuthService);
  const splashScreenService = inject(SplashScreenService);
  const searchFilterService = inject(SearchFilterService);
  const searchFilterMetadataApi = inject(SearchFilterMetadataApiService);
  const columnDefinitionService = inject(ColumnDefinitionService);
  const viewDefinitionService = inject(ViewDefinitionService);

  // Wait for the initial authentication check to complete.
  return toObservable(authService.isLoading).pipe(
    filter(isLoading => !isLoading), // Proceed only when loading is false
    take(1),
    switchMap(() => {
      // The authentication guard has already run, so we should have a valid session.
      if (authService.hasValidSession()) {
        console.log('[StartupResolver] Authenticated. Fetching all startup data...');
        // Let the user know what's happening.
        splashScreenService.setMessage('Preparing your workspace...');

        // Fetch all necessary data in parallel for maximum speed.
        return forkJoin({
          filterMetadata: searchFilterMetadataApi.getSearchFilterMetadata(),
          columnDefinitions: columnDefinitionService.loadDefinitions(),
          viewDefinitions: viewDefinitionService.loadViews()
        }).pipe(
          tap(startupData => {
            // Once data arrives, populate the necessary services.
            searchFilterService.setSearchFilterMetadata(startupData.filterMetadata);
            console.log('[StartupResolver] Startup data loaded and services populated.');
          }),
          map(() => true) // Signal to the router that resolution is successful.
        );
      } else {
        // This case should not be hit if the auth guard is working correctly,
        // but it's a safe fallback.
        console.warn('[StartupResolver] User is not authenticated. Skipping data fetch.');
        return of(true); // Allow navigation to continue (guard will redirect).
      }
    })
  );
};