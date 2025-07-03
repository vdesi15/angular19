// src/app/features/search-logs/services/enhanced-jira-search-strategy.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { get } from 'lodash-es';

// Core interfaces
import { SearchStrategy } from './search-strategies';
import { SearchFilterModel } from 'src/app/core/models/search-filter.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { ConfigService } from 'src/app/core/services/config.service';
import { SearchFilterService } from 'src/app/core/services/filters.service';

// Enhanced JIRA Services
import { EnhancedJiraService, TestCycleExecution } from './enhanced-jira.service';
import { TransactionDetailsResponse } from '../models/transactionDetails/transaction-details.model';

export interface JiraSearchResponse {
  hits: any[];
  total: number;
  jiraDetails?: {
    jiraId: string;
    currentId?: string;
    searchType: 'jira-id' | 'test-case' | 'test-cycle' | 'execution';
    executions?: TestCycleExecution[];
  };
  transactionDetails?: TransactionDetailsResponse;
}

@Injectable({ providedIn: 'root' })
export class EnhancedJiraSearchStrategy implements SearchStrategy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private configService = inject(ConfigService);
  private searchFilterService = inject(SearchFilterService);
  private jiraService = inject(EnhancedJiraService);

  // ================================
  // STRATEGY INTERFACE IMPLEMENTATION
  // ================================

  canHandle(query: any, context?: any): boolean {
    if (typeof query !== 'string') return false;
    
    const detectionResult = this.jiraService.detectJiraId(query);
    return detectionResult.isValid;
  }

  getStrategyName(): string {
    return 'EnhancedJiraSearch';
  }

  execute(
    query: string,
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[] = [],
    preFilter?: string
  ): Observable<JiraSearchResponse> {
    console.log(`[EnhancedJiraSearchStrategy] Executing JIRA search for: ${query}`);
    
    const detectionResult = this.jiraService.detectJiraId(query);
    
    if (!detectionResult.isValid) {
      return of({
        hits: [],
        total: 0,
        jiraDetails: {
          jiraId: query,
          searchType: 'jira-id'
        }
      });
    }

    return this.executeJiraSearch(detectionResult.id, detectionResult.type, globalFilters);
  }

  // ================================
  // JIRA SEARCH EXECUTION
  // ================================

  /**
   * Execute JIRA search based on type
   */
  private executeJiraSearch(
    jiraId: string, 
    searchType: string, 
    globalFilters: SearchFilterModel
  ): Observable<JiraSearchResponse> {
    switch (searchType) {
      case 'test-cycle':
        return this.handleTestCycleSearch(jiraId, globalFilters);
      case 'jira-id':
      case 'test-case':
      case 'execution':
        return this.handleDirectJiraSearch(jiraId, searchType, globalFilters);
      default:
        return this.handleDirectJiraSearch(jiraId, 'jira-id', globalFilters);
    }
  }

  /**
   * Handle test cycle search - needs execution selection
   */
  private handleTestCycleSearch(
    testCycleId: string, 
    globalFilters: SearchFilterModel
  ): Observable<JiraSearchResponse> {
    // For test cycles, we need to show the execution selection dialog
    // The actual search will happen after user selects execution or entire cycle
    return new Observable(observer => {
      this.jiraService.getTestCycleExecutions(testCycleId).then(executions => {
        observer.next({
          hits: [],
          total: 0,
          jiraDetails: {
            jiraId: testCycleId,
            searchType: 'test-cycle',
            executions
          }
        });
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Handle direct JIRA search (tickets, test cases, executions)
   */
  private handleDirectJiraSearch(
    jiraId: string,
    searchType: string,
    globalFilters: SearchFilterModel,
    currentId?: string
  ): Observable<JiraSearchResponse> {
    const backendUrl = this.configService.get('api.baseUrl') || '/api';
    const encodedJiraId = btoa(jiraId);
    const url = `${backendUrl}/getdatafromjiraattachment/${encodedJiraId}/${currentId || 'null'}`;

    console.log(`[EnhancedJiraSearchStrategy] Fetching from: ${url}`);

    return this.http.get<TransactionDetailsResponse>(url).pipe(
      map(response => {
        // Extract and update global filters
        this.updateGlobalFiltersFromResponse(response);

        // Navigate to search results with JIRA context
        this.navigateToJiraResults(jiraId, currentId);

        return {
          hits: response.hits?.hits || [],
          total: response.hits?.total || 0,
          jiraDetails: {
            jiraId,
            currentId,
            searchType: searchType as any
          },
          transactionDetails: response
        };
      }),
      catchError(error => {
        console.error('[EnhancedJiraSearchStrategy] API error:', error);
        return of({
          hits: [],
          total: 0,
          jiraDetails: {
            jiraId,
            currentId,
            searchType: searchType as any
          }
        });
      })
    );
  }

  // ================================
  // GLOBAL FILTER EXTRACTION
  // ================================

  /**
   * Extract and update global filters from response
   */
  private updateGlobalFiltersFromResponse(response: TransactionDetailsResponse): void {
    if (!response?.hits?.hits?.length) return;

    const hits = response.hits.hits;
    let app = '';
    let env = '';
    let location = '';

    // Loop through hits to find the filter values
    for (const hit of hits) {
      const source = hit._source;
      
      if (!app) {
        app = get(source, 'app.name') || get(source, 'application') || '';
      }
      
      if (!env) {
        env = get(source, 'env') || get(source, 'environment') || '';
      }
      
      if (!location) {
        const site = get(source, 'site') || '';
        if (site) {
          // Convert site to location using locationToSiteMapping
          location = this.convertSiteToLocation(site, env);
        }
      }

      // Break early if we found all values
      if (app && env && location) break;
    }

    if (app || env || location) {
      console.log(`[EnhancedJiraSearchStrategy] Updating global filters:`, { app, env, location });
      
      this.searchFilterService.updateFilters({
        application: app ? [app] : [],
        environment: env,
        location: location
      });
    }
  }

  /**
   * Convert site to location using startup metadata
   */
  private convertSiteToLocation(site: string, env: string): string {
    const metadata = this.searchFilterService.searchFilterMetadata();
    if (!metadata?.siteToLocationMapping) return '';

    const envKey = env.toUpperCase();
    const locationsForEnv = metadata.siteToLocationMapping[envKey];
    if (!locationsForEnv) return '';

    const foundEntry = Object.entries(locationsForEnv)
      .find(([_, siteArray]) => siteArray.includes(site));
    
    return foundEntry ? foundEntry[0] : '';
  }

  // ================================
  // NAVIGATION HELPERS
  // ================================

  /**
   * Navigate to JIRA search results
   */
  private navigateToJiraResults(jiraId: string, currentId?: string): void {
    const encodedJiraId = btoa(jiraId);
    const queryParams: any = {
      jiraid: encodedJiraId
    };

    if (currentId) {
      queryParams.searchText = btoa(currentId);
    }

    this.router.navigate(['/logs/search'], {
      queryParams,
      queryParamsHandling: 'merge'
    });

    console.log(`[EnhancedJiraSearchStrategy] Navigated to JIRA results for ${jiraId}`);
  }

  // ================================
  // PUBLIC METHODS FOR MANAGER INTEGRATION
  // ================================

  /**
   * Execute search for specific execution (called from managers)
   */
  public searchExecution(executionId: string, globalFilters: SearchFilterModel): Observable<JiraSearchResponse> {
    return this.handleDirectJiraSearch(executionId, 'execution', globalFilters);
  }

  /**
   * Execute search for test cycle (called from managers)
   */
  public searchTestCycle(testCycleId: string, globalFilters: SearchFilterModel): Observable<JiraSearchResponse> {
    return this.handleDirectJiraSearch(testCycleId, 'test-cycle', globalFilters);
  }

  /**
   * Execute search with current ID (for timeline navigation)
   */
  public searchWithCurrentId(
    jiraId: string, 
    currentId: string, 
    globalFilters: SearchFilterModel
  ): Observable<JiraSearchResponse> {
    return this.handleDirectJiraSearch(jiraId, 'jira-id', globalFilters, currentId);
  }

  /**
   * Handle timeline item click navigation
   */
  public handleTimelineNavigation(timelineItem: any, currentJiraId: string): void {
    const txnId = get(timelineItem, 'txnid') || get(timelineItem, 'id');
    if (!txnId) {
      console.warn('[EnhancedJiraSearchStrategy] No transaction ID found in timeline item');
      return;
    }

    const encodedTxnId = btoa(txnId);
    const encodedJiraId = btoa(currentJiraId);

    this.router.navigate(['/logs/search'], {
      queryParams: {
        jiraid: encodedJiraId,
        searchText: encodedTxnId
      },
      queryParamsHandling: 'merge'
    });

    console.log(`[EnhancedJiraSearchStrategy] Timeline navigation to ${txnId}`);
  }

  // NEW: Handle URL parameters for JIRA searches
  handleUrlParams(params: Record<string, string>): UrlHandlingResult | null {
    const jiraId = params['jiraId'];
    const searchText = params['searchText'];
    
    if (jiraId && searchText) {
      // JIRA with searchText (currentTxnId)
      const decodedJiraId = this.safeBase64Decode(jiraId);
      const decodedSearchText = this.safeBase64Decode(searchText);
      
      if (decodedJiraId && decodedSearchText && this.canHandle(decodedJiraId)) {
        return {
          searchQuery: decodedJiraId,
          searchType: 'jira',
          metadata: {
            fromUrl: true,
            currentTxnId: decodedSearchText,
            isTimelineNavigation: true,
            originalParams: { jiraId, searchText }
          },
          shouldTriggerSearch: true
        };
      }
    } else if (jiraId) {
      // Regular JIRA search
      const decodedJiraId = this.safeBase64Decode(jiraId);
      
      if (decodedJiraId && this.canHandle(decodedJiraId)) {
        return {
          searchQuery: decodedJiraId,
          searchType: 'jira',
          metadata: {
            fromUrl: true,
            originalParam: 'jiraId'
          },
          shouldTriggerSearch: true
        };
      }
    }
    
    return null;
  }
  
  // NEW: Update URL for JIRA searches
  updateUrlForSearch(query: string, currentParams: Record<string, string>): Record<string, string> {
    const updatedParams = { ...currentParams };
    
    // Add encoded JIRA ID
    updatedParams['jiraId'] = btoa(query);
    
    // Remove transaction params if they exist
    delete updatedParams['searchText'];
    
    // Keep datetime params for JIRA searches (they might be relevant)
    
    return updatedParams;
  }
  
  // NEW: Cleanup URL params
  cleanupUrlParams(currentParams: Record<string, string>): Record<string, string> {
    const cleanedParams = { ...currentParams };
    delete cleanedParams['jiraId'];
    delete cleanedParams['searchText'];
    return cleanedParams;
  }
  
  private safeBase64Decode(encoded: string): string | null {
    try {
      return atob(encoded);
    } catch (error) {
      console.warn('[JiraStrategy] Failed to decode base64:', encoded);
      return null;
    }
  }
}