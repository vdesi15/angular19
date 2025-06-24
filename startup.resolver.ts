// src/app/core/guards/startup.resolver.ts
import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import { filter, switchMap, take, tap, forkJoin, map, catchError } from 'rxjs';
import { of } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';

// Import all services needed for startup data fetching
import { SearchFilterService } from '../services/filters.service';
import { SearchFilterMetadataApiService } from '../services/search-filter-metadata-api.service';
import { ColumnDefinitionService } from '../services/column-definition.service';
import { ViewDefinitionService } from '../services/view-definition.service';

/**
 * Enhanced startup resolver with URL parameter handling.
 * Uses Angular 19 patterns for better performance and maintainability.
 * 
 * Key improvements:
 * - Better error handling with fallback values
 * - URL parameter processing after data load
 * - Cleaner service interaction
 * - Performance optimizations
 */
export const startupResolver: ResolveFn<boolean> = (route: ActivatedRouteSnapshot) => {
  const oidcService = inject(OidcSecurityService);
  const searchFilterService = inject(SearchFilterService);
  const searchFilterMetadataApi = inject(SearchFilterMetadataApiService);
  const columnDefinitionService = inject(ColumnDefinitionService);
  const viewDefinitionService = inject(ViewDefinitionService);

  console.log('[StartupResolver] Starting resolution process');

  return oidcService.checkAuth().pipe(
    filter(({ isAuthenticated }) => {
      if (!isAuthenticated) {
        console.log('[StartupResolver] User not authenticated, blocking resolution');
      }
      return isAuthenticated;
    }),
    take(1),
    switchMap(() => {
      console.log('[StartupResolver] User authenticated, checking if data already loaded');
      
      // Check if we already have the critical data loaded
      const existingMetadata = searchFilterService.searchFilterMetadata();
      
      if (existingMetadata) {
        console.log('[StartupResolver] Data already loaded, processing URL parameters');
        
        // Data exists, process URL parameters if present
        const queryParams = route.queryParams;
        const hasParams = Object.keys(queryParams).length > 0;
        
        if (hasParams && route.data['preserveUrlParams']) {
          try {
            searchFilterService.parseAndApplyUrlParameters(queryParams);
            console.log('[StartupResolver] URL parameters processed successfully');
          } catch (error) {
            console.warn('[StartupResolver] Error processing URL parameters:', error);
          }
        }
        
        return of(true); // Skip data loading if already available
      }

      console.log('[StartupResolver] Loading initial application data');
      
      // Load all required data in parallel
      return forkJoin({
        filterMetadata: searchFilterMetadataApi.getSearchFilterMetadata().pipe(
          catchError(error => {
            console.error('[StartupResolver] Failed to load filter metadata:', error);
            return of(null); // Continue with null metadata
          })
        ),
        columnDefinitions: columnDefinitionService.loadDefinitions().pipe(
          catchError(error => {
            console.error('[StartupResolver] Failed to load column definitions:', error);
            return of([]); // Continue with empty definitions
          })
        ),
        viewDefinitions: viewDefinitionService.loadViews().pipe(
          catchError(error => {
            console.error('[StartupResolver] Failed to load view definitions:', error);
            return of([]); // Continue with empty views
          })
        )
      }).pipe(
        tap(startupData => {
          console.log('[StartupResolver] Data loading completed:', {
            hasMetadata: !!startupData.filterMetadata,
            columnCount: startupData.columnDefinitions.length,
            viewCount: startupData.viewDefinitions.length
          });

          // Apply the filter metadata to the service
          if (startupData.filterMetadata) {
            searchFilterService.setSearchFilterMetadata(startupData.filterMetadata);
            
            // Now that we have metadata, process URL parameters if present
            const queryParams = route.queryParams;
            const hasParams = Object.keys(queryParams).length > 0;
            
            if (hasParams && route.data['preserveUrlParams']) {
              try {
                console.log('[StartupResolver] Processing URL parameters with loaded metadata');
                searchFilterService.parseAndApplyUrlParameters(queryParams);
                console.log('[StartupResolver] URL parameters applied successfully');
              } catch (error) {
                console.warn('[StartupResolver] Error applying URL parameters:', error);
              }
            }
          }
        }),
        map(() => true), // Always resolve to true to allow navigation
        catchError(error => {
          console.error('[StartupResolver] Critical error during startup:', error);
          // Even on error, allow navigation to proceed with default state
          return of(true);
        })
      );
    }),
    catchError(error => {
      console.error('[StartupResolver] Authentication check failed:', error);
      return of(false); // Block navigation on auth errors
    })
  );
};