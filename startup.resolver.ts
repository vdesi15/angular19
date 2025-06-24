// src/app/core/guards/startup.resolver.ts - Minimal change
import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import { filter, switchMap, take, tap, forkJoin, map } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';

import { SearchFilterService } from '../services/filters.service';
import { SearchFilterMetadataApiService } from '../services/search-filter-metadata-api.service';
import { ColumnDefinitionService } from '../services/column-definition.service';
import { ViewDefinitionService } from '../services/view-definition.service';

/**
 * Enhanced startup resolver - just adds URL parameter processing after data load
 */
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
      // Your existing code
      searchFilterService.setSearchFilterMetadata(startupData.filterMetadata);
      console.log('[StartupResolver] All startup data loaded and services populated.');
      
      // 🔥 NEW: Process URL parameters after metadata is loaded
      const deepestRoute = findDeepestChild(route);
      const queryParams = deepestRoute.queryParams;
      
      if (queryParams && Object.keys(queryParams).length > 0) {
        console.log('[StartupResolver] Found URL parameters, applying them:', queryParams);
        searchFilterService.parseAndApplyUrlParameters(queryParams);
      } else {
        console.log('[StartupResolver] No URL parameters found');
      }
    }),
    map(() => true)
  );
};

// Helper function to find the child route with query parameters
function findDeepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let current = route;
  
  // Keep going down the route tree to find the actual destination
  while (current.firstChild) {
    current = current.firstChild;
  }
  
  // If no query params on deepest child, check parent routes
  if (!current.queryParams || Object.keys(current.queryParams).length === 0) {
    let parent = current.parent;
    while (parent) {
      if (parent.queryParams && Object.keys(parent.queryParams).length > 0) {
        return parent;
      }
      parent = parent.parent;
    }
  }
  
  return current;
}