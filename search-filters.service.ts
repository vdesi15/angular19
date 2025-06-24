// src/app/core/services/filters.service.ts
import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router, ActivatedRoute, ActivatedRouteSnapshot, Params } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, filter } from 'rxjs';

import { SearchFilterModel, SearchFilterMetadata } from '../models/search-filter.model';
import { DateTimeService } from './date-time.service';

/**
 * Enhanced Search Filters Service using Angular 19 signals.
 * 
 * Key improvements:
 * - Better URL parameter handling with parseAndApplyUrlParameters method
 * - Reactive state management with signals
 * - Improved error handling and logging
 * - Prevention of navigation loops
 * - Better separation of concerns
 */
@Injectable({
  providedIn: 'root'
})
export class SearchFilterService {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private dateTimeService = inject(DateTimeService);

  // Core signals
  private readonly _filters = signal<SearchFilterModel | null>(null);
  private readonly _searchFilterMetadata = signal<SearchFilterMetadata | null>(null);
  
  // Flag to prevent recursive URL updates
  private readonly _isUpdatingUrl = signal(false);

  // Public computed signals
  public readonly filters = this._filters.asReadonly();
  public readonly searchFilterMetadata = this._searchFilterMetadata.asReadonly();

  // Computed signals for common filter checks
  public readonly hasFilters = computed(() => {
    const f = this.filters();
    return !!(f?.application?.length || f?.environment || f?.location || f?.dateRange);
  });

  public readonly filterSummary = computed(() => {
    const f = this.filters();
    if (!f || !this.hasFilters()) return 'No filters applied';
    
    const parts = [];
    if (f.application?.length) parts.push(`${f.application.length} app(s)`);
    if (f.environment) parts.push(`env: ${f.environment}`);
    if (f.location) parts.push(`loc: ${f.location}`);
    if (f.dateRange) parts.push('date range');
    
    return parts.join(', ');
  });

  constructor() {
    // Initialize with default filters
    this.initializeDefaultFilters();
    
    // Set up reactive effects
    this.setupUrlParamWatcher();
    
    console.log('[FiltersService] Initialized with signal-based state management');
  }

  // ================================
  // PUBLIC API METHODS
  // ================================

  /**
   * Set the search filter metadata (called by resolver)
   */
  public setSearchFilterMetadata(metadata: SearchFilterMetadata): void {
    console.log('[FiltersService] Setting metadata:', {
      applications: metadata.applications?.length,
      environments: Object.keys(metadata.environments || {}).length,
      locations: Object.values(metadata.environments || {}).flat().length
    });
    
    this._searchFilterMetadata.set(metadata);

    // Initialize filters with defaults if not already set
    if (!this.filters()) {
      this.initializeFiltersFromMetadata(metadata);
    }
  }

  /**
   * Update filters programmatically
   */
  public updateFilters(partialFilters: Partial<SearchFilterModel>): void {
    if (this._isUpdatingUrl()) {
      console.log('[FiltersService] Skipping update during URL sync');
      return;
    }

    console.log('[FiltersService] Updating filters:', partialFilters);
    
    const currentFilters = this.filters();
    if (!currentFilters) {
      console.warn('[FiltersService] No current filters available for update');
      return;
    }

    const newFilters = { ...currentFilters, ...partialFilters };
    
    // Validate environment/location relationship
    if (partialFilters.environment !== undefined && partialFilters.location === undefined) {
      // Environment changed, reset location if it's not valid for new environment
      const metadata = this.searchFilterMetadata();
      if (metadata && newFilters.environment) {
        const validLocations = metadata.environments[newFilters.environment] || [];
        if (newFilters.location && !validLocations.includes(newFilters.location)) {
          newFilters.location = '';
        }
      }
    }

    this._filters.set(newFilters);
    this.updateUrlParameters(newFilters);
  }

  /**
   * Parse URL parameters and apply them to filters
   * This method is called by the resolver and guards
   */
  public parseAndApplyUrlParameters(params: Params): void {
    console.log('[FiltersService] Parsing URL parameters:', params);
    
    const metadata = this.searchFilterMetadata();
    if (!metadata) {
      console.warn('[FiltersService] Cannot parse URL params without metadata');
      return;
    }

    try {
      const parsedFilters = this.parseFiltersFromParams(params, metadata);
      console.log('[FiltersService] Parsed filters from URL:', parsedFilters);
      
      // Set the flag to prevent URL update loops
      this._isUpdatingUrl.set(true);
      
      this._filters.set(parsedFilters);
      
      // Reset the flag after the update
      setTimeout(() => this._isUpdatingUrl.set(false), 50);
      
    } catch (error) {
      console.error('[FiltersService] Error parsing URL parameters:', error);
    }
  }

  /**
   * Reset filters to defaults
   */
  public resetFilters(): void {
    console.log('[FiltersService] Resetting filters to defaults');
    
    const metadata = this.searchFilterMetadata();
    if (metadata) {
      this.initializeFiltersFromMetadata(metadata);
    } else {
      this.initializeDefaultFilters();
    }
  }

  /**
   * Get filter validation errors
   */
  public getValidationErrors(): string[] {
    const errors: string[] = [];
    const filters = this.filters();
    const metadata = this.searchFilterMetadata();
    
    if (!filters || !metadata) return errors;

    // Validate application selection
    if (filters.application?.length) {
      const validApps = metadata.applications.map(a => a.label);
      const invalidApps = filters.application.filter(app => !validApps.includes(app));
      if (invalidApps.length) {
        errors.push(`Invalid applications: ${invalidApps.join(', ')}`);
      }
    }

    // Validate environment
    if (filters.environment && !Object.keys(metadata.environments).includes(filters.environment)) {
      errors.push(`Invalid environment: ${filters.environment}`);
    }

    // Validate location
    if (filters.location && filters.environment) {
      const validLocations = metadata.environments[filters.environment] || [];
      if (!validLocations.includes(filters.location)) {
        errors.push(`Invalid location '${filters.location}' for environment '${filters.environment}'`);
      }
    }

    return errors;
  }

  // ================================
  // PRIVATE IMPLEMENTATION
  // ================================

  private initializeDefaultFilters(): void {
    const defaultFilters: SearchFilterModel = {
      application: [],
      environment: '',
      location: '',
      timezone: 'UTC',
      dateRange: this.dateTimeService.getDefaultDateRange(),
      streamFilters: ''
    };

    this._filters.set(defaultFilters);
    console.log('[FiltersService] Initialized with default filters');
  }

  private initializeFiltersFromMetadata(metadata: SearchFilterMetadata): void {
    const defaultApp = metadata.applications?.[0]?.label || '';
    const defaultEnv = Object.keys(metadata.environments)[0] || '';
    const defaultLoc = defaultEnv ? (metadata.environments[defaultEnv]?.[0] || '') : '';
    const timezone = defaultLoc && metadata.locationTimezone[defaultLoc] 
      ? metadata.locationTimezone[defaultLoc] 
      : 'UTC';

    const filters: SearchFilterModel = {
      application: defaultApp ? [defaultApp] : [],
      environment: defaultEnv,
      location: defaultLoc,
      timezone,
      dateRange: this.dateTimeService.getDefaultDateRange(),
      streamFilters: ''
    };

    this._filters.set(filters);
    console.log('[FiltersService] Initialized filters from metadata:', filters);
  }

  private setupUrlParamWatcher(): void {
    // Watch for route parameter changes (for external navigation)
    const routeParams = toSignal(
      this.activatedRoute.queryParams.pipe(
        filter(() => !this._isUpdatingUrl()) // Only process external changes
      )
    );

    effect(() => {
      const params = routeParams();
      if (params && Object.keys(params).length > 0 && this.searchFilterMetadata()) {
        console.log('[FiltersService] External URL change detected, parsing parameters');
        this.parseAndApplyUrlParameters(params);
      }
    }, { allowSignalWrites: true });
  }

  private updateUrlParameters(filters: SearchFilterModel): void {
    if (this._isUpdatingUrl()) return;

    const activeRoute = this.findActiveRoute(this.router.routerState.snapshot.root);
    const allowedFilters = activeRoute.data['allowedFilters'] || [];
    
    console.log('[FiltersService] Updating URL with filters for route:', activeRoute.routeConfig?.path);

    const queryParams = this.buildQueryParams(filters, allowedFilters);

    this._isUpdatingUrl.set(true);

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    }).finally(() => {
      setTimeout(() => this._isUpdatingUrl.set(false), 50);
    });
  }

  private buildQueryParams(filters: SearchFilterModel, allowedFilters: string[]): any {
    const queryParams: any = {};

    // Application filter
    if (allowedFilters.includes('application') && filters.application?.length) {
      queryParams['applications'] = this.encode(filters.application.join(','));
    } else {
      queryParams['applications'] = null;
    }

    // Environment filter
    if (allowedFilters.includes('environment') && filters.environment) {
      queryParams['env'] = this.encode(filters.environment);
    } else {
      queryParams['env'] = null;
    }

    // Location filter
    if (allowedFilters.includes('location') && filters.location) {
      queryParams['loc'] = this.encode(filters.location);
    } else {
      queryParams['loc'] = null;
    }

    // Stream filters
    if (filters.streamFilters) {
      queryParams['stream_filters'] = this.encode(filters.streamFilters);
    } else {
      queryParams['stream_filters'] = null;
    }

    // Date range
    if (allowedFilters.includes('dateRange') && filters.dateRange) {
      const dr = filters.dateRange;
      queryParams['isAbs'] = dr.isAbsolute.toString();
      
      if (dr.isAbsolute) {
        queryParams['start'] = dr.startDate.toISOString();
        queryParams['end'] = dr.endDate.toISOString();
        queryParams['relVal'] = null;
        queryParams['relUnit'] = null;
      } else {
        queryParams['relVal'] = dr.relativeValue?.toString() ?? null;
        queryParams['relUnit'] = dr.relativeUnit ?? null;
        queryParams['start'] = null;
        queryParams['end'] = null;
      }
    } else {
      queryParams['isAbs'] = null;
      queryParams['start'] = null;
      queryParams['end'] = null;
      queryParams['relVal'] = null;
      queryParams['relUnit'] = null;
    }

    // Clean null values
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === null) {
        delete queryParams[key];
      }
    });

    return queryParams;
  }

  private parseFiltersFromParams(params: Params, meta: SearchFilterMetadata): SearchFilterModel {
    // Parse applications
    const decodedApps = params['applications'] 
      ? this.decode(params['applications']).split(',').filter(Boolean) 
      : [];
    const validApps = decodedApps.filter((app: string) => 
      meta.applications.some(a => a.label === app)
    );

    // Parse environment
    const decodedEnv = params['env'] ? this.decode(params['env']) : '';
    const envIsValid = Object.keys(meta.environments).includes(decodedEnv);
    const environment = envIsValid ? decodedEnv : '';

    // Parse location
    let location = '';
    const decodedLoc = params['loc'] ? this.decode(params['loc']) : '';
    if (envIsValid && meta.environments[environment]?.includes(decodedLoc)) {
      location = decodedLoc;
    }

    // Get timezone
    const timezone = location && meta.locationTimezone[location] 
      ? meta.locationTimezone[location] 
      : 'UTC';

    // Parse stream filters
    const streamFilters = params['stream_filters'] ? this.decode(params['stream_filters']) : '';

    // Parse date range
    const dateRange = this.dateTimeService.calculateDateRangeFromUrlParams(params);

    return {
      application: validApps,
      environment,
      location,
      timezone,
      dateRange,
      streamFilters
    };
  }

  private findActiveRoute(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    if (route.firstChild) {
      return this.findActiveRoute(route.firstChild);
    }
    return route;
  }

  private encode = (v: string): string | null => v ? encodeURIComponent(v) : null;
  private decode = (v: string): string => v ? (decodeURIComponent(v) || '') : '';
}