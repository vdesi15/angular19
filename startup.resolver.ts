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
      searchFilterService.setSearchFilterMetadata(startupData.filterMetadata);
      console.log('[StartupResolver] All startup data loaded and services populated.');
      
      // 👈 NEW: Process URL parameters after metadata is loaded
      const childRoute = this.findDeepestChild(route);
      if (childRoute?.queryParams && Object.keys(childRoute.queryParams).length > 0) {
        try {
          console.log('[StartupResolver] Processing URL parameters with loaded metadata');
          searchFilterService.parseAndApplyUrlParameters(childRoute.queryParams);
        } catch (error) {
          console.warn('[StartupResolver] Error applying URL parameters:', error);
        }
      }
    }),
    map(() => true)
  );

  // Helper function to find the deepest child route with query params
  function findDeepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }
};