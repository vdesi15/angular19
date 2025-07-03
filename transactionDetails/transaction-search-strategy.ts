// src/app/features/search-logs/services/enhanced-transaction-search-strategy.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Core interfaces
import { SearchStrategy } from './search-strategies';
import { SearchFilterModel } from 'src/app/core/models/search-filter.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { ConfigService } from 'src/app/core/services/config.service';
import { SearchFilterService } from 'src/app/core/services/filters.service';
import { TransactionDetailsResponse } from '../models/transactionDetails/transaction-details.model';

export interface TransactionSearchResponse {
  hits: any[];
  total: number;
  transactionDetails?: TransactionDetailsResponse;
  transactionId: string;
}

@Injectable({ providedIn: 'root' })
export class EnhancedTransactionSearchStrategy implements SearchStrategy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private configService = inject(ConfigService);
  private searchFilterService = inject(SearchFilterService);

  // ================================
  // STRATEGY INTERFACE IMPLEMENTATION
  // ================================

  canHandle(query: any, context?: any): boolean {
    if (typeof query !== 'string') return false;
    
    // Transaction ID detection: 20-32 characters, alphanumeric + hyphens/underscores
    const transactionPattern = /^[a-zA-Z0-9_-]{20,32}$/;
    return transactionPattern.test(query.trim());
  }

  getStrategyName(): string {
    return 'EnhancedTransactionSearch';
  }

  execute(
    transactionId: string,
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[] = [],
    preFilter?: string
  ): Observable<TransactionSearchResponse> {
    console.log(`[EnhancedTransactionSearchStrategy] Executing transaction search for: ${transactionId}`);
    
    // Ensure global filters are set before making the call
    if (!this.validateGlobalFilters(globalFilters)) {
      throw new Error('Global search filters (app, env, location) must be set for transaction search');
    }

    return this.executeTransactionSearch(transactionId, globalFilters);
  }

  // ================================
  // TRANSACTION SEARCH EXECUTION
  // ================================

  /**
   * Execute transaction search
   */
  private executeTransactionSearch(
    transactionId: string,
    globalFilters: SearchFilterModel
  ): Observable<TransactionSearchResponse> {
    // Use the same endpoint as your existing transaction search
    const baseApi = this.configService.get('api.baseUrl') || '/api';
    const app = globalFilters.application?.[0] || '';
    const env = globalFilters.environment || '';
    const location = globalFilters.location || '';
    
    const url = `${baseApi}/gettxndetails/${app}/${env}/${location}/${transactionId}`;

    console.log(`[EnhancedTransactionSearchStrategy] Fetching from: ${url}`);

    return this.http.get<TransactionDetailsResponse>(url).pipe(
      map(response => {
        // Navigate to transaction details with search context
        this.navigateToTransactionResults(transactionId);

        return {
          hits: response.hits?.hits || [],
          total: response.hits?.total || 0,
          transactionDetails: response,
          transactionId
        };
      })
    );
  }

  // ================================
  // VALIDATION & NAVIGATION
  // ================================

  /**
   * Validate that required global filters are set
   */
  private validateGlobalFilters(globalFilters: SearchFilterModel): boolean {
    return !!(
      globalFilters.application?.length &&
      globalFilters.environment &&
      globalFilters.location
    );
  }

  /**
   * Navigate to transaction search results
   */
  private navigateToTransactionResults(transactionId: string): void {
    const encodedTxnId = btoa(transactionId);
    
    this.router.navigate(['/logs/search'], {
      queryParams: {
        searchText: encodedTxnId,
        // Clear any existing JIRA context
        jiraid: null
      },
      queryParamsHandling: 'merge'
    });

    console.log(`[EnhancedTransactionSearchStrategy] Navigated to transaction results for ${transactionId}`);
  }

  // ================================
  // PUBLIC HELPER METHODS
  // ================================

  /**
   * Check if a string looks like a transaction ID
   */
  public static isTransactionId(query: string): boolean {
    if (typeof query !== 'string') return false;
    const transactionPattern = /^[a-zA-Z0-9_-]{20,32}$/;
    return transactionPattern.test(query.trim());
  }

  /**
   * Extract transaction ID from various formats
   */
  public static extractTransactionId(query: string): string | null {
    if (!query || typeof query !== 'string') return null;
    
    const cleaned = query.trim();
    
    // Direct transaction ID
    if (this.isTransactionId(cleaned)) {
      return cleaned;
    }
    
    // Extract from URL or other formats if needed
    const match = cleaned.match(/([a-zA-Z0-9_-]{20,32})/);
    return match ? match[1] : null;
  }
}