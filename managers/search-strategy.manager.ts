// managers/search-strategy.manager.ts
// ================================
// STRATEGY MANAGER - Registry and Detection
// ================================

import { Injectable, inject } from '@angular/core';
import { SearchRequest, SearchType, EnhancedSearchRequest } from '../../models/search.model';
import { SearchQueryDetectionService, QueryDetectionResult } from '../search-query-detection.service';

// Strategy imports
import { 
  SearchStrategy,
  TransactionSearchStrategy,
  JiraSearchStrategy, 
  BatchSearchStrategy,
  NaturalLanguageSearchStrategy,
  SseStrategy,
  GuidSearchStrategy
} from '../search-strategies';

@Injectable({ providedIn: 'root' })
export class SearchStrategyManager {
  
  private queryDetectionService = inject(SearchQueryDetectionService);
  private strategies = new Map<string, SearchStrategy>();

  constructor() {
    this.initializeStrategies();
  }

  // ================================
  // STRATEGY REGISTRY
  // ================================

  private initializeStrategies(): void {
  // Enhanced strategies for better JIRA and Transaction handling
  const enhancedTransactionStrategy = inject(EnhancedTransactionSearchStrategy);
  const enhancedJiraStrategy = inject(EnhancedJiraSearchStrategy);
  
  // Existing strategies
  const batchStrategy = inject(BatchSearchStrategy);
  const naturalLanguageStrategy = inject(NaturalLanguageSearchStrategy);
  const sseStrategy = inject(SseStrategy);
  const guidStrategy = inject(GuidSearchStrategy);

  // Register enhanced strategies with priority
  this.strategies.set('transaction', enhancedTransactionStrategy);
  this.strategies.set('jira', enhancedJiraStrategy);
  
  // Register other strategies
  this.strategies.set('batch', batchStrategy);
  this.strategies.set('natural', naturalLanguageStrategy);
  this.strategies.set('browse', sseStrategy);
  this.strategies.set('error', sseStrategy);
  this.strategies.set('guid', guidStrategy); // Legacy support

  console.log('[StrategyManager] Enhanced strategies initialized:', Array.from(this.strategies.keys()));
}

// Updated mapDetectionToSearchType method
private mapDetectionToSearchType(detection: QueryDetectionResult): SearchType {
  switch (detection.type) {
    case 'transaction':
      return 'transaction';
    case 'jira':
      return 'jira';
    case 'batch':
      return 'batch';
    case 'natural':
      return 'natural';
    default:
      return 'transaction'; // Fallback
  }
}

  // ================================
  // STRATEGY SELECTION & ENHANCEMENT
  // ================================

  /**
   * Enhance a search request using intelligent detection
   */
  public enhanceRequest(request: SearchRequest): EnhancedSearchRequest {
    // For streaming searches, no enhancement needed
    if (request.type === 'browse' || request.type === 'error') {
      return request as EnhancedSearchRequest;
    }

    // For query-based searches, use detection
    if (request.query && typeof request.query === 'string') {
      const detectionResult = this.queryDetectionService.detectQueryType(request.query);
      
      if (this.queryDetectionService.isValidDetection(detectionResult)) {
        return {
          ...request,
          type: this.mapDetectionToSearchType(detectionResult),
          query: detectionResult.extractedValue,
          title: this.generateTitleFromDetection(detectionResult, request.title),
          detectionResult,
          originalQuery: request.query
        };
      }
    }

    // Return as-is if no enhancement possible
    return request as EnhancedSearchRequest;
  }

  /**
   * Get strategy for a search type
   */
  public getStrategy(searchType: SearchType): SearchStrategy | null {
    return this.strategies.get(searchType) || null;
  }

  /**
   * Get strategy for a search with context
   */
  public getStrategyForSearch(search: any): SearchStrategy | null {
    // For streaming searches
    if (search.isStreaming) {
      return this.strategies.get(search.type) || null;
    }

    // For query-based searches with detection result
    if (search.detectionResult) {
      return this.strategies.get(search.detectionResult.type) || null;
    }

    // Fallback to type-based strategy
    return this.strategies.get(search.type) || null;
  }

  // ================================
  // DETECTION UTILITIES
  // ================================

  /**
   * Test query detection (for development)
   */
  public testDetection(query: string): QueryDetectionResult {
    return this.queryDetectionService.detectQueryType(query);
  }

  /**
   * Get available strategy names
   */
  public getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if a strategy can handle a specific query
   */
  public canHandle(searchType: SearchType, query: any): boolean {
    const strategy = this.strategies.get(searchType);
    return strategy ? strategy.canHandle(query) : false;
  }

  // ================================
  // PRIVATE HELPERS
  // ================================

  private generateTitleFromDetection(detection: QueryDetectionResult, fallbackTitle?: string): string {
    const typeDescription = this.queryDetectionService.getQueryTypeDescription(detection);
    
    switch (detection.type) {
      case 'transaction':
        return `Transaction: ${detection.extractedValue}`;
      case 'jira':
        return `JIRA Ticket: ${detection.extractedValue}`;
      case 'batch':
        return `Batch: ${detection.extractedValue}`;
      case 'natural':
        return `AI Search: ${detection.extractedValue}`;
      default:
        return fallbackTitle || `Search: ${detection.extractedValue}`;
    }
  }

  // ================================
  // STRATEGY VALIDATION
  // ================================

  /**
   * Validate that all required strategies are registered
   */
  public validateStrategies(): boolean {
    const requiredStrategies = ['transaction', 'jira', 'batch', 'natural', 'browse', 'error'];
    const missing = requiredStrategies.filter(strategy => !this.strategies.has(strategy));
    
    if (missing.length > 0) {
      console.error('[StrategyManager] Missing strategies:', missing);
      return false;
    }
    
    return true;
  }

  /**
   * Get strategy information for debugging
   */
  public getStrategyInfo(): Array<{name: string, strategy: string}> {
    return Array.from(this.strategies.entries()).map(([name, strategy]) => ({
      name,
      strategy: strategy.getStrategyName()
    }));
  }
}