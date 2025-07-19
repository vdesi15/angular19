// src/app/shared/services/url-builder.service.ts
import { Injectable, inject } from '@angular/core';
import { FiltersService } from 'src/app/core/services/filters.service';

@Injectable({
  providedIn: 'root'
})
export class UrlBuilderService {
  private filtersService = inject(FiltersService);
  
  public buildSearchLink(query: string): string {
    const filters = this.filtersService.filters();
    if (!filters) return '#';

    const baseUrl = window.location.origin;
    const currentApp = filters.application?.[0] || '';
    const currentEnv = filters.environment || '';
    const currentLoc = filters.location || '';

    // URL encode all parameters
    const encodedApp = encodeURIComponent(currentApp);
    const encodedEnv = encodeURIComponent(currentEnv);
    const encodedLoc = encodeURIComponent(currentLoc);
    const encodedQuery = encodeURIComponent(query);

    return `${baseUrl}/logs/search?applications=${encodedApp}&env=${encodedEnv}&location=${encodedLoc}&searchText=${encodedQuery}`;
  }
}