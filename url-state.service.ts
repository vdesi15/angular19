import { Injectable, signal, computed, inject, WritableSignal } from '@angular/core';
import { Router, NavigationEnd, Params } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { SearchFilterMetadata } from '../models/search-filter.model';

@Injectable({
  providedIn: 'root'
})
export class UrlStateService {
  private router = inject(Router);

  // Store initial params during resolver phase
  private preservedParams: WritableSignal<Params | null> = signal(null);
  private isRestored: WritableSignal<boolean> = signal(false);

  // Current URL parameters signal
  private urlParams = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.getCurrentParams())
    ),
    { initialValue: {} }
  );

  private getCurrentParams(): Params {
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.snapshot.queryParams;
  }

  // Computed signals for parsed parameters
  public readonly applications = computed(() => {
    const params = this.getActiveParams();
    const apps = params?.['applications'];
    return apps ? this.decode(apps).split(',').filter(Boolean) : [];
  });

  public readonly environment = computed(() => {
    const params = this.getActiveParams();
    const env = params?.['env'];
    return env ? this.decode(env) : '';
  });

  public readonly location = computed(() => {
    const params = this.getActiveParams();
    const loc = params?.['loc'];
    return loc ? this.decode(loc) : '';
  });

  public readonly streamFilters = computed(() => {
    const params = this.getActiveParams();
    const filters = params?.['stream_filters'];
    return filters ? this.decode(filters) : '';
  });

  public readonly dateRange = computed(() => {
    const params = this.getActiveParams();
    const isAbsolute = params?.['isAbs'] === 'true';
    
    if (isAbsolute && params?.['start'] && params?.['end']) {
      return {
        isAbsolute: true,
        startDate: new Date(params['start']),
        endDate: new Date(params['end'])
      };
    } else if (params?.['relVal']) {
      return {
        isAbsolute: false,
        relativeValue: parseInt(params['relVal']) || 15,
        relativeUnit: params['relUnit'] || 'minutes'
      };
    }
    
    // Default date range
    return {
      isAbsolute: false,
      relativeValue: 15,
      relativeUnit: 'minutes'
    };
  });

  private getActiveParams(): Params {
    // Use preserved params if not yet restored, otherwise use current URL params
    return this.isRestored() ? this.urlParams() : (this.preservedParams() || {});
  }

  /**
   * Called by resolver to preserve URL params before data loading
   */
  public preserveInitialParams(params: Params): void {
    console.log('[UrlStateService] Preserving initial params:', params);
    this.preservedParams.set(params);
    this.isRestored.set(false);
  }

  /**
   * Called by resolver after metadata is loaded to validate and restore params
   */
  public restorePreservedParams(metadata: SearchFilterMetadata): void {
    const preserved = this.preservedParams();
    if (!preserved || this.isRestored()) return;

    console.log('[UrlStateService] Restoring preserved params with metadata validation');
    
    // Validate preserved params against metadata
    const validatedParams = this.validateParams(preserved, metadata);
    
    // Update URL with validated params
    if (Object.keys(validatedParams).length > 0) {
      this.router.navigate([], {
        queryParams: validatedParams,
        queryParamsHandling: 'replace',
        replaceUrl: true
      });
    }
    
    this.isRestored.set(true);
    console.log('[UrlStateService] URL state restored and validated');
  }

  private validateParams(params: Params, metadata: SearchFilterMetadata): Params {
    const validated: Params = {};

    // Validate applications
    if (params['applications']) {
      const apps = this.decode(params['applications']).split(',').filter(Boolean);
      const validApps = apps.filter(app => 
        metadata.applications.some(a => a.label === app)
      );
      if (validApps.length > 0) {
        validated['applications'] = this.encode(validApps.join(','));
      }
    }

    // Validate environment
    if (params['env']) {
      const env = this.decode(params['env']);
      if (Object.keys(metadata.environments).includes(env)) {
        validated['env'] = params['env'];
        
        // Validate location for this environment
        if (params['loc']) {
          const loc = this.decode(params['loc']);
          if (metadata.environments[env]?.includes(loc)) {
            validated['loc'] = params['loc'];
          }
        }
      }
    }

    // Preserve date range params (they don't need metadata validation)
    ['isAbs', 'start', 'end', 'relVal', 'relUnit'].forEach(key => {
      if (params[key]) validated[key] = params[key];
    });

    // Preserve stream filters
    if (params['stream_filters']) {
      validated['stream_filters'] = params['stream_filters'];
    }

    return validated;
  }

  /**
   * Update URL parameters programmatically
   */
  public updateParams(newParams: Record<string, string | null>): void {
    const current = this.urlParams();
    const merged = { ...current, ...newParams };
    
    // Remove null values
    Object.keys(merged).forEach(key => {
      if (merged[key] === null) delete merged[key];
    });

    this.router.navigate([], {
      queryParams: merged,
      queryParamsHandling: 'replace',
      replaceUrl: true
    });
  }

  private encode(value: string): string {
    return encodeURIComponent(value);
  }

  private decode(value: string): string {
    return decodeURIComponent(value || '');
  }
}