// ================================
// STRATEGY MANAGER - Registry and Detection
// ================================

import { Injectable, computed, inject, signal } from '@angular/core';
import { SearchRequest, SearchType, EnhancedSearchRequest } from '../../models/search.model';
import { SearchQueryDetectionService, QueryDetectionResult } from '../search-query-detection.service';
import { TransactionSearchStrategy } from '../../strategies/transaction-details-strategy';
import { JiraSearchStrategy } from '../../strategies/jira-search-strategy';
import { LotSearchStrategy } from '../../strategies/lot-search-strategy';
import { NaturalLanguageSearchStrategy } from '../../strategies/nlp-search-strategy';
import { SearchStrategy, UrlHandlingResult } from '../../strategies/search-strategy.interface';
import { SseStrategy } from '../../strategies/sse-strategy';

@Injectable({ providedIn: 'root' })
export class SearchStrategyManager {
  
  private queryDetectionService = inject(SearchQueryDetectionService);
  private strategies = signal(new Map<string, SearchStrategy>());
  private readonly lastUsedStrategy = signal<string | null>(null);

  public readonly availableStrategies = computed(() =>
    Array.from(this.strategies().keys())
  );

  constructor() {
    this.initializeStrategies();
  }

  // ================================
  // STRATEGY REGISTRY
  // ================================

  private initializeStrategies(): void {
    const strategiesMap = new Map<string, SearchStrategy>();

    const transactionStrategy = inject(TransactionSearchStrategy);
    const jiraStrategy = inject(JiraSearchStrategy);
    const lotStrategy = inject(LotSearchStrategy);
    const naturalLanguageStrategy = inject(NaturalLanguageSearchStrategy);
    const sseStrategy = inject(SseStrategy);

    strategiesMap.set('transaction', transactionStrategy);
    strategiesMap.set('jira', jiraStrategy);
    strategiesMap.set('lot', lotStrategy);
    strategiesMap.set('natural', naturalLanguageStrategy);
    strategiesMap.set('browse', sseStrategy);
    strategiesMap.set('error', sseStrategy);

    this.strategies.set(strategiesMap);

    console.log('[StrategyManager] Modern strategies initialized:', this.availableStrategies());
  }


  // ================================
  // URL Handling
  // ================================

  /**
   * 
   * @param params 
   * @returns 
   */
  public handleUrlParameters(params: Record<string, string>): UrlHandlingResult | null {
    const currentStrategies = this.strategies();

    // Try each strategy to see if it can handle the URL params
    for (const [strategyType, strategy] of currentStrategies) {
      if (strategy.handleUrlParams) {
        const result = strategy.handleUrlParams(params);
        if (result) {
          console.log(`[StrategyManager] URL handled by ${strategyType} strategy:`, result);
          return result;
        }
      }
    }

    console.log('[StrategyManager] No strategy could handle URL parameters');
    return null;
  }

  /**
   * Update URL using the appropriate strategy
   * @param query 
   * @param currentParams 
   * @returns 
   */
  public updateUrlForSearch(query: string, currentParams: Record<string, string>): Record<string, string> {
    const selectedStrategy = this.selectBestStrategy(query);

    if (selectedStrategy && selectedStrategy.updateUrlForSearch) {
      return selectedStrategy.updateUrlForSearch(query, currentParams);
    }

    // Fallback: basic encoding
    return {
      ...currentParams,
      searchText: btoa(query)
    };
  }

  /**
   *  Cleanup URL using the appropriate strategy
   * @param query 
   * @param currentParams 
   * @returns 
   */
  public cleanupUrlParams(query: string, currentParams: Record<string, string>): Record<string, string> {
    const selectedStrategy = this.selectBestStrategy(query);

    if (selectedStrategy && selectedStrategy.cleanupUrlParams) {
      return selectedStrategy.cleanupUrlParams(currentParams);
    }

    // Fallback: remove common search params
    const cleanedParams = { ...currentParams };
    delete cleanedParams['searchText'];
    delete cleanedParams['jiraId'];
    return cleanedParams;
  }

  // ================================
  // STRATEGY SELECTION & ENHANCEMENT
  // ================================

  public enhanceRequest(request: SearchRequest): EnhancedSearchRequest {
    // For streaming searches, no enhancement needed
    if (request.type === 'browse' || request.type === 'error') {
      return request as EnhancedSearchRequest;
    }

    // For query-based searches, use strategy selection
    if (request.query && typeof request.query === 'string') {
      const selectedStrategy = this.selectBestStrategy(request.query);

      if (selectedStrategy) {
        const detectedType = this.getStrategyType(selectedStrategy);

        return {
          ...request,
          type: detectedType,
          query: request.query.trim(),
          title: this.generateTitleFromType(detectedType, request.query, request.title),
          strategy: selectedStrategy.getStrategyName?.() || 'unknown',
          originalQuery: request.query
        };
      }
    }

    // Return as-is if no enhancement possible
    return request as EnhancedSearchRequest;
  }

  public selectBestStrategy(query: string, context?: any): SearchStrategy | null {
    const currentStrategies = this.strategies();

    // Iterate through strategies in priority order
    for (const [strategyName, strategy] of currentStrategies) {
      if (strategy.canHandle && strategy.canHandle(query, context)) {
        this.lastUsedStrategy.set(strategyName);
        console.log(`[StrategyManager] Selected strategy: ${strategyName} for query: ${query.substring(0, 50)}...`);
        return strategy;
      }
    }

    console.warn('[StrategyManager] No strategy can handle query:', query);
    return null;
  }

  /**
   * Get strategy by type - fallback method
   */
  public getStrategy(searchType: SearchType): SearchStrategy | null {
    return this.strategies().get(searchType) || null;
  }

  // ================================
  // STRATEGY UTILITIES
  // ================================

  /**
   * Get strategy type from strategy instance
   */
  private getStrategyType(strategy: SearchStrategy): SearchType {
    const currentStrategies = this.strategies();

    for (const [type, strategyInstance] of currentStrategies) {
      if (strategyInstance === strategy) {
        return type as SearchType;
      }
    }

    return 'transaction'; // Fallback
  }

  /**
   * Generate title based on detected type and query
   */
  private generateTitleFromType(type: SearchType, query: string, fallbackTitle?: string): string {
    const truncatedQuery = query.length > 20 ? `${query.substring(0, 20)}...` : query;

    switch (type) {
      case 'transaction':
        return `Transaction: ${truncatedQuery}`;
      case 'jira':
        return `JIRA: ${truncatedQuery}`;
      case 'lot':
        return `Lot: ${truncatedQuery}`;
      case 'natural':
        return `Search: ${truncatedQuery}`;
      case 'browse':
        return 'Browse Logs';
      case 'error':
        return 'Error Stream';
      default:
        return fallbackTitle || `Search: ${truncatedQuery}`;
    }
  }

  // ================================
  // STRATEGY TESTING & VALIDATION
  // ================================

  /**
   * Test which strategies can handle a query (development helper)
   */
  public testStrategiesForQuery(query: string): Array<{ strategy: string, canHandle: boolean, name: string }> {
    const currentStrategies = this.strategies();
    const results: Array<{ strategy: string, canHandle: boolean, name: string }> = [];

    for (const [strategyType, strategy] of currentStrategies) {
      const canHandle = strategy.canHandle ? strategy.canHandle(query) : false;
      const name = strategy.getStrategyName?.() || strategyType;

      results.push({
        strategy: strategyType,
        canHandle,
        name
      });
    }

    return results.sort((a, b) => Number(b.canHandle) - Number(a.canHandle));
  }

  /**
   * Validate that all required strategies are registered
   */
  public validateStrategies(): { isValid: boolean, missing: string[], extra: string[] } {
    const requiredStrategies = ['transaction', 'jira', 'lot', 'natural', 'browse', 'error'];
    const currentStrategies = Array.from(this.strategies().keys());

    const missing = requiredStrategies.filter(strategy => !currentStrategies.includes(strategy));
    const extra = currentStrategies.filter(strategy => !requiredStrategies.includes(strategy) && strategy !== 'guid');

    const isValid = missing.length === 0;

    if (!isValid) {
      console.error('[StrategyManager] Validation failed:', { missing, extra });
    }

    return { isValid, missing, extra };
  }

  /**
   * Get strategy information for debugging
   */
  public getStrategyInfo(): Array<{ type: string, name: string, canHandleMethod: boolean }> {
    const currentStrategies = this.strategies();

    return Array.from(currentStrategies.entries()).map(([type, strategy]) => ({
      type,
      name: strategy.getStrategyName?.() || 'Unknown',
      canHandleMethod: typeof strategy.canHandle === 'function'
    }));
  }

  // ================================
  // REACTIVE GETTERS - Angular 19 Signal Access
  // ================================

  /**
   * Get last used strategy name (reactive)
   */
  public getLastUsedStrategy() {
    return this.lastUsedStrategy();
  }

  /**
   * Check if a specific strategy exists (reactive)
   */
  public hasStrategy(strategyType: string): boolean {
    return this.strategies().has(strategyType);
  }

  /**
   * Get strategy statistics (reactive)
   */
  public getStrategyStats() {
    const currentStrategies = this.strategies();
    const withCanHandle = Array.from(currentStrategies.values())
      .filter(strategy => typeof strategy.canHandle === 'function').length;

    return {
      total: currentStrategies.size,
      withCanHandle,
      lastUsed: this.lastUsedStrategy()
    };
  }
}
