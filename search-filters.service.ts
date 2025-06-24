import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { SearchFilterModel, SearchFilterMetadata } from '../models/search-filter.model';
import { UrlStateService } from './url-state.service';

@Injectable({
  providedIn: 'root'
})
export class SearchFilterService {
  private urlStateService = inject(UrlStateService);

  // Internal state signals
  private _metadata: WritableSignal<SearchFilterMetadata | null> = signal(null);

  // Public readonly signals
  public readonly searchFilterMetadata = this._metadata.asReadonly();

  // Computed filter model from URL state and metadata
  public readonly filters = computed<SearchFilterModel | null>(() => {
    const metadata = this._metadata();
    if (!metadata) return null;

    const apps = this.urlStateService.applications();
    const env = this.urlStateService.environment();
    const loc = this.urlStateService.location();
    const streamFilters = this.urlStateService.streamFilters();
    const dateRange = this.urlStateService.dateRange();

    // Validate applications against metadata
    const validApps = apps.filter(app => 
      metadata.applications.some(a => a.label === app)
    );

    // Validate environment
    const validEnv = Object.keys(metadata.environments).includes(env) ? env : '';

    // Validate location
    let validLoc = '';
    if (validEnv && metadata.environments[validEnv]?.includes(loc)) {
      validLoc = loc;
    }

    // Get timezone
    const timezone = validLoc && metadata.locationTimezone[validLoc] 
      ? metadata.locationTimezone[validLoc] 
      : 'UTC';

    return {
      application: validApps,
      environment: validEnv,
      location: validLoc,
      timezone,
      dateRange,
      streamFilters
    };
  });

  constructor() {
    // Auto-sync filters back to URL when changed programmatically
    effect(() => {
      const currentFilters = this.filters();
      if (currentFilters) {
        this.syncFiltersToUrl(currentFilters);
      }
    });
  }

  /**
   * Set metadata (called by resolver)
   */
  public setSearchFilterMetadata(metadata: SearchFilterMetadata): void {
    console.log('[SearchFilterService] Setting metadata:', metadata);
    this._metadata.set(metadata);
  }

  /**
   * Update filters programmatically
   */
  public updateFilters(partialFilters: Partial<SearchFilterModel>): void {
    console.log('[SearchFilterService] Updating filters:', partialFilters);
    
    const current = this.filters();
    if (!current) {
      console.warn('[SearchFilterService] No current filters available');
      return;
    }

    const updated = { ...current, ...partialFilters };
    this.syncFiltersToUrl(updated);
  }

  private syncFiltersToUrl(filters: SearchFilterModel): void {
    const params: Record<string, string | null> = {};

    params['applications'] = filters.application?.length 
      ? encodeURIComponent(filters.application.join(',')) 
      : null;
    
    params['env'] = filters.environment 
      ? encodeURIComponent(filters.environment) 
      : null;
    
    params['loc'] = filters.location 
      ? encodeURIComponent(filters.location) 
      : null;
    
    params['stream_filters'] = filters.streamFilters 
      ? encodeURIComponent(filters.streamFilters) 
      : null;

    if (filters.dateRange) {
      const dr = filters.dateRange;
      params['isAbs'] = dr.isAbsolute.toString();
      
      if (dr.isAbsolute) {
        params['start'] = dr.startDate.toISOString();
        params['end'] = dr.endDate.toISOString();
        params['relVal'] = null;
        params['relUnit'] = null;
      } else {
        params['relVal'] = dr.relativeValue?.toString() ?? null;
        params['relUnit'] = dr.relativeUnit ?? null;
        params['start'] = null;
        params['end'] = null;
      }
    }

    this.urlStateService.updateParams(params);
  }
}