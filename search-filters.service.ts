import { Injectable, signal, effect, inject, computed, untracked, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute, Params, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { filter as rxjsFilter, map } from 'rxjs/operators';
import { SearchFilterMetadata, SearchFilterModel, DateTimeRange } from '../models/search-filter.model';
import { StreamFilter } from '../models/stream-filter.model';
import { DateTimeService } from './date-time.service';

@Injectable({
  providedIn: 'root'
})
export class FiltersService {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private dateTimeService = inject(DateTimeService);

  private readonly _searchFilterMetadata: WritableSignal<SearchFilterMetadata | undefined> = signal(undefined);
  private readonly _filters: WritableSignal<SearchFilterModel | undefined> = signal(undefined);

  // ✨ Add a change trigger signal to force reactivity
  private readonly _filterChangeId: WritableSignal<number> = signal(0);

  public readonly searchFilterMetadata = this._searchFilterMetadata.asReadonly();
  public readonly filters = this._filters.asReadonly();
  
  // ✨ Create a computed that includes the change trigger for better reactivity
  public readonly filtersWithChangeId = computed(() => ({
    filters: this.filters(),
    changeId: this._filterChangeId()
  }));

  private queryParams = toSignal(
    this.router.events.pipe(
      rxjsFilter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.routerState.root.snapshot.queryParams)
    ),
    { initialValue: this.router.routerState.root.snapshot.queryParams }
  );

  constructor() {
    const filtersFromUrl = computed<SearchFilterModel | undefined>(() => {
      const params = this.queryParams();
      const meta = this.searchFilterMetadata();
      if (!params || !meta) return undefined;
      return this.parseFiltersFromParams(params, meta);
    });

    effect(() => {
      const fromUrl = filtersFromUrl();
      if (fromUrl) {
        untracked(() => { 
          this._filters.set(fromUrl);
          this._filterChangeId.update(id => id + 1); // ✨ Trigger change
        });
      }
    });

    effect(() => {
      this.queryParams(); 
      const activeRoute = this.findActiveRoute(this.router.routerState.snapshot.root);
      untracked(() => {
        if (this.filters()) {
          this.updateQueryParams(this.filters()!, activeRoute);
        }
      });
    });
  }

  public setSearchFilterMetadata(metadata: SearchFilterMetadata): void {
    this._searchFilterMetadata.set(metadata);
  }

  public updateFilters(partialFilters: Partial<SearchFilterModel>): void {
    console.log('[FiltersService] updateFilters called with:', partialFilters);
    
    const currentFilters = this.filters();
    if (!currentFilters) {
      console.warn('[FiltersService] No current filters available');
      return;
    }

    const newFilters = { ...currentFilters, ...partialFilters };
    
    // ✨ Update both the filters and trigger change detection
    this._filters.set(newFilters);
    this._filterChangeId.update(id => id + 1);
    
    console.log('[FiltersService] Filters updated. New change ID:', this._filterChangeId());
    
    const activeRoute = this.findActiveRoute(this.router.routerState.snapshot.root);
    this.updateQueryParams(newFilters, activeRoute);
  }

  private updateQueryParams(filters: SearchFilterModel, route: ActivatedRouteSnapshot): void {
    const allowedFilters = route.data['allowedFilters'] || [];
    const queryParams: any = {};

    queryParams['applications'] = allowedFilters.includes('application') && filters.application?.length ? this.encode(filters.application.join(',')) : null;
    queryParams['env'] = allowedFilters.includes('environment') && filters.environment ? this.encode(filters.environment) : null;
    queryParams['loc'] = allowedFilters.includes('location') && filters.location ? this.encode(filters.location) : null;
    queryParams['stream_filters'] = filters.streamFilters ? this.encode(filters.streamFilters) : null;
    queryParams['site'] = null;

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

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private parseFiltersFromParams(params: Params, meta: SearchFilterMetadata): SearchFilterModel {
    const decodedApps = params['applications'] ? this.decode(params['applications']).split(',').filter(Boolean) : [];
    const validApps = decodedApps.filter((app: string) => meta.applications.some(a => a.label === app));
    const decodedEnv = params['env'] ? this.decode(params['env']) : '';
    const streamFilters = this.decode(params['stream_filters']);
    const envIsValid = Object.keys(meta.environments).includes(decodedEnv);
    const environment = envIsValid ? decodedEnv : '';
    let location = '';
    const decodedLoc = params['loc'] ? this.decode(params['loc']) : '';
    if (envIsValid && meta.environments[environment]?.includes(decodedLoc)) {
      location = decodedLoc;
    } else {
      const decodedSite = params['site'] ? this.decode(params['site']) : '';
      const siteMappingEnvKey = environment.toUpperCase();
      if (envIsValid && decodedSite && meta.siteToLocationMapping[siteMappingEnvKey]) {
        const locationsForEnv = meta.siteToLocationMapping[siteMappingEnvKey];
        const foundEntry = Object.entries(locationsForEnv).find(([locKey, siteArray]) => siteArray.includes(decodedSite));
        if (foundEntry) location = foundEntry[0];
      }
    }
    const timezone = location && meta.locationTimezone[location] ? meta.locationTimezone[location] : 'UTC';
    const dateRange = this.dateTimeService.calculateDateRangeFromUrlParams(params);
    return { application: validApps, environment, location, timezone, dateRange, streamFilters };
  }
  
  private findActiveRoute(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    if (route.firstChild) return this.findActiveRoute(route.firstChild);
    return route;
  }
  
  private encode = (v: string): string | null => v ? encodeURIComponent(v) : null;
  private decode = (v: string): string => v ? (decodeURIComponent(v) || '') : '';
}