import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { filter, switchMap, take, tap, forkJoin, map } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';

// Import all services needed for startup data fetching
import { SearchFilterService } from '../services/filters.service';
import { SearchFilterMetadataApiService } from '../services/search-filter-metadata-api.service';
import { ColumnDefinitionService } from '../services/column-definition.service';
import { ViewDefinitionService } from '../services/view-definition.service';

/**
 * This resolver blocks the initial application route from activating until all
 * critical startup data has been fetched.
 */
export const startupResolver: ResolveFn<boolean> = () => {
  const oidcService = inject(OidcSecurityService);
  const searchFilterService = inject(SearchFilterService);

  // For simplicity, we can inject all data services here.
  const searchFilterMetadataApi = inject(SearchFilterMetadataApiService);
  const columnDefinitionService = inject(ColumnDefinitionService);
  const viewDefinitionService = inject(ViewDefinitionService);

  return oidcService.checkAuth().pipe(
    filter(({ isAuthenticated }) => isAuthenticated),
    take(1),
    switchMap(() => {
      console.log('[StartupResolver] Authenticated. Fetching all startup data in parallel...');
      
      // Use forkJoin to run all data fetching calls concurrently
      return forkJoin({
        filterMetadata: searchFilterMetadataApi.getSearchFilterMetadata(),
        columnDefinitions: columnDefinitionService.loadDefinitions(),
        viewDefinitions: viewDefinitionService.loadViews()
      });
    }),
    tap(startupData => {
      // The individual services already set their own state via .pipe(tap(...)).
      // We just need to set the filter metadata, which is handled differently.
      searchFilterService.setSearchFilterMetadata(startupData.filterMetadata);
      console.log('[StartupResolver] All startup data loaded and services populated.');
    }),
    map(() => true) // Signal to the router that it can now proceed.
  );
};