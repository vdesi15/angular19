// src/app/core/guards/url-parameters.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { SearchFilterService } from '../services/filters.service';
import { signal, effect } from '@angular/core';

/**
 * This guard handles URL parameter preservation and restoration.
 * It runs AFTER authentication/authorization but BEFORE the component loads.
 * 
 * Features:
 * - Preserves URL parameters during authentication flow
 * - Handles initial URL parameter parsing
 * - Prevents redundant navigation loops
 * - Uses Angular 19 signals for reactive state management
 */

// Signal to track if we're in the middle of URL restoration
const isRestoringUrl = signal(false);

export const urlParametersGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const searchFilterService = inject(SearchFilterService);
  const router = inject(Router);
  
  // Check if this route should preserve URL parameters
  const shouldPreserveParams = route.data['preserveUrlParams'] === true;
  
  if (!shouldPreserveParams) {
    return true; // Skip URL processing for routes that don't need it
  }

  console.log('[UrlParametersGuard] Processing URL parameters for route:', route.routeConfig?.path);
  
  // Get current query parameters
  const queryParams = route.queryParams;
  const hasQueryParams = Object.keys(queryParams).length > 0;
  
  if (!hasQueryParams) {
    console.log('[UrlParametersGuard] No query parameters found, allowing navigation');
    return true;
  }

  // Check if we already have filter metadata loaded
  const filterMetadata = searchFilterService.searchFilterMetadata();
  
  if (!filterMetadata) {
    // If no metadata, we need to wait for the resolver to complete
    // The resolver will handle URL parameter parsing after data is loaded
    console.log('[UrlParametersGuard] No filter metadata yet, letting resolver handle URL params');
    return true;
  }

  // If we have metadata and parameters, process them now
  if (!isRestoringUrl()) {
    console.log('[UrlParametersGuard] Processing URL parameters with available metadata');
    
    // Set the restoration flag to prevent loops
    isRestoringUrl.set(true);
    
    try {
      // Parse and apply URL parameters
      searchFilterService.parseAndApplyUrlParameters(queryParams);
      console.log('[UrlParametersGuard] URL parameters successfully applied');
    } catch (error) {
      console.error('[UrlParametersGuard] Error parsing URL parameters:', error);
    } finally {
      // Reset the flag after a short delay
      setTimeout(() => isRestoringUrl.set(false), 100);
    }
  }

  return true;
};