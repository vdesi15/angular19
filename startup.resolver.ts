import { ActivatedRouteSnapshot, ResolveFn, Router } from "@angular/router";
import { SearchFilterMetadataApiService } from "../../shared/services/search-filter-metadata-api.service";
import { SearchFiltersService } from "../../shared/services/search-filters.service";
import { filter, forkJoin, map, Observable, of, switchMap, take, tap } from "rxjs";
import { inject } from "@angular/core";
import { ColumnDefinitionService } from "../../features/services/column-definition.service";
import { ViewDefinitionService } from "../../features/services/view-definition.service";
import { AuthService } from "../services/auth.service";
import { toObservable } from "@angular/core/rxjs-interop";

/**
 * This resolver acts as a replacement for APP_INITIALIZER
 * It blocks the initial application route from activating untill all citical
 * startup data has been fetched.
 */
export const startupResolver: ResolveFn<boolean> = () => {
  const authService = inject(AuthService);
  const searchFilterService = inject(SearchFiltersService);
  const searchFilterMetadataApi = inject(SearchFilterMetadataApiService);
  const columnDefinitionService = inject(ColumnDefinitionService);
  const viewDefinitionService = inject(ViewDefinitionService);

  // 1. Subscribe to the public, shared `isLoading$` observable from the service.
  return authService.isLoading$.pipe(
    filter(loading => !loading), // Wait for the initial authentication check to complete.
    take(1),
    switchMap(() => {
      // The authenticationGuard runs before this, so a session should be valid.
      if (authService.hasValidSession()) {
        console.log('[StartupResolver] Authenticated. Fetching startup data...');

        // 2. Fetch all necessary data in parallel.
        return forkJoin({
          filterMetadata: searchFilterMetadataApi.getSearchFilterMetadata(),
          columnDefinitions: columnDefinitionService.loadDefinitions(),
          viewDefinitions: viewDefinitionService.loadViews()
        }).pipe(
          tap(startupData => {
            // 3. Populate services with the fetched data.
            searchFilterService.setSearchFilterMetadata(startupData.filterMetadata);
            console.log('[StartupResolver] Data loaded and services populated.');
          }),
          map(() => true) // 4. Signal to the router that resolution is complete and successful.
        );
      } else {
        // Failsafe: If for some reason there's no session, resolve immediately
        // to prevent an EmptyError. The guard will handle the redirect.
        console.warn('[StartupResolver] Running without a valid session. Skipping data fetch.');
        return of(true);
      }
    })
  );
};
