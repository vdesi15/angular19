// src/app/core/guards/startup.resolver.ts - Final version
import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import { filter, switchMap, take, tap, forkJoin, map } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';

import { SearchFilterService } from '../services/filters.service';
import { SearchFilterMetadataApiService } from '../services/search-filter-metadata-api.service';
import { ColumnDefinitionService } from '../services/column-definition.service';
import { ViewDefinitionService } from '../services/view-definition.service';

export const startupResolver: ResolveFn<boolean> = (route: ActivatedRouteSnapshot) => {
  const oidcService = inject(OidcSecurityService);
  const searchFilterService = inject(SearchFilterService);
  const searchFilterMetadataApi = inject(SearchFilterMetadataApiService);
  const columnDefinitionService = inject(ColumnDefinitionService);
  const viewDefinitionService = inject(ViewDefinitionService);

  return oidcService.checkAuth().pipe(
    filter(({ isAuthenticated }) => isAuthenticated),
    take(1),
    switchMap(() => {
      console.log('[StartupResolver] Authenticated. Fetching all startup data in parallel...');
      
      return forkJoin({
        filterMetadata: searchFilterMetadataApi.getSearchFilterMetadata(),
        columnDefinitions: columnDefinitionService.loadDefinitions(),
        viewDefinitions: viewDefinitionService.loadViews()
      });
    }),
    tap(startupData => {
      searchFilterService.setSearchFilterMetadata(startupData.filterMetadata);
      console.log('[StartupResolver] All startup data loaded and services populated.');
      
      // 🔥 Process URL parameters AFTER data is loaded
      const queryParams = findQueryParams(route);
      if (queryParams && Object.keys(queryParams).length > 0) {
        console.log('[StartupResolver] Processing URL parameters:', queryParams);
        try {
          searchFilterService.parseAndApplyUrlParameters(queryParams);
          console.log('[StartupResolver] URL parameters applied successfully');
        } catch (error) {
          console.error('[StartupResolver] Error applying URL parameters:', error);
        }
      }
    }),
    map(() => true)
  );
};

// Helper to find query parameters in route tree
function findQueryParams(route: ActivatedRouteSnapshot): any {
  // Check current route first
  if (route.queryParams && Object.keys(route.queryParams).length > 0) {
    return route.queryParams;
  }
  
  // Check all child routes
  let current = route;
  while (current.firstChild) {
    current = current.firstChild;
    if (current.queryParams && Object.keys(current.queryParams).length > 0) {
      return current.queryParams;
    }
  }
  
  // Check parent routes
  let parent = route.parent;
  while (parent) {
    if (parent.queryParams && Object.keys(parent.queryParams).length > 0) {
      return parent.queryParams;
    }
    parent = parent.parent;
  }
  
  return null;
}