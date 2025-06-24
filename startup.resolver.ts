import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { filter, switchMap, take, tap, forkJoin, map } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';

import { SearchFilterService } from '../services/filters.service';
import { SearchFilterMetadataApiService } from '../services/search-filter-metadata-api.service';
import { ColumnDefinitionService } from '../services/column-definition.service';
import { ViewDefinitionService } from '../services/view-definition.service';
import { UrlStateService } from '../services/url-state.service';

/**
 * Enhanced startup resolver that preserves URL state during data loading
 */
export const startupResolver: ResolveFn<boolean> = () => {
  const oidcService = inject(OidcSecurityService);
  const searchFilterService = inject(SearchFilterService);
  const searchFilterMetadataApi = inject(SearchFilterMetadataApiService);
  const columnDefinitionService = inject(ColumnDefinitionService);
  const viewDefinitionService = inject(ViewDefinitionService);
  const urlStateService = inject(UrlStateService);
  const router = inject(Router);

  return oidcService.checkAuth().pipe(
    filter(({ isAuthenticated }) => isAuthenticated),
    take(1),
    tap(() => {
      // 🚀 CRITICAL: Capture URL state BEFORE data loading
      const currentParams = router.routerState.root.snapshot.queryParams;
      console.log('[StartupResolver] Preserving URL params:', currentParams);
      urlStateService.preserveInitialParams(currentParams);
    }),
    switchMap(() => {
      console.log('[StartupResolver] Authenticated. Fetching all startup data in parallel...');
      
      return forkJoin({
        filterMetadata: searchFilterMetadataApi.getSearchFilterMetadata(),
        columnDefinitions: columnDefinitionService.loadDefinitions(),
        viewDefinitions: viewDefinitionService.loadViews()
      });
    }),
    tap(startupData => {
      // Set metadata in services
      searchFilterService.setSearchFilterMetadata(startupData.filterMetadata);
      
      // 🚀 CRITICAL: Now that metadata is loaded, restore URL state
      urlStateService.restorePreservedParams(startupData.filterMetadata);
      
      console.log('[StartupResolver] All startup data loaded and URL state restored.');
    }),
    map(() => true)
  );
};