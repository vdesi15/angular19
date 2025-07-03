// src/app/features/search-logs/services/search-strategy.manager.ts
// ================================
// MODERNIZED STRATEGY MANAGER - Angular 19 with Signals
// ================================

import { Injectable, inject, signal, computed } from '@angular/core';
import { SearchRequest, SearchType, EnhancedSearchRequest } from '../models/search.model';

// Strategy imports
import { 
  SearchStrategy,
  TransactionSearchStrategy,
  JiraSearchStrategy, 
  BatchSearchStrategy,
  NaturalLanguageSearchStrategy,
  SseStrategy,
  GuidSearchStrategy
} from './search-strategies';

@Injectable({ providedIn: 'root' })
export class SearchStrategyManager {
  
  // Angular 19 signals for reactive state management
  private readonly strategies = signal(new Map<string, SearchStrategy>());
  private readonly lastUsedStrategy = signal<string | null>(null);
  
  // Computed properties using Angular 19 computed signals
  public readonly availableStrategies = computed(() => 
    Array.from(this.strategies().keys())
  );
  
  public readonly strategyCount = computed(() => 
    this.strategies().size
  );

  constructor() {
    this.initializeStrategies();
  }

  // ================================
  // STRATEGY REGISTRY - Enhanced with Angular 19 patterns
  // ================================

  private initializeStrategies(): void {
    const strategiesMap = new Map<string, SearchStrategy>();

    // Enhanced strategies for better handling
    const transactionStrategy = inject(TransactionSearchStrategy);
    const jiraStrategy = inject(JiraSearchStrategy);
    const batchStrategy = inject(BatchSearchStrategy);
    const naturalLanguageStrategy = inject(NaturalLanguageSearchStrategy);
    const sseStrategy = inject(SseStrategy);
    const guidStrategy = inject(GuidSearchStrategy);

    // Register strategies in priority order
    strategiesMap.set('transaction', transactionStrategy);
    strategiesMap.set('jira', jiraStrategy);
    strategiesMap.set('batch', batchStrategy);
    strategiesMap.set('natural', naturalLanguageStrategy);
    strategiesMap.set('browse', sseStrategy);
    strategiesMap.set('error', sseStrategy);
    strategiesMap.set('guid', guidStrategy); // Legacy support

    // Update the signal
    this.strategies.set(strategiesMap);

    console.log('[StrategyManager] Modern strategies initialized:', this.availableStrategies());
  }

  // ================================
  // INTELLIGENT STRATEGY SELECTION - canHandle() Based
  // ================================

  /**
   * Enhanced strategy selection using canHandle() methods
   * Returns the first strategy that can handle the query
   */
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

  /**
   * Enhanced request processing without QueryDetectionService
   */
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
      case 'batch':
        return `Batch: ${truncatedQuery}`;
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
  public testStrategiesForQuery(query: string): Array<{strategy: string, canHandle: boolean, name: string}> {
    const currentStrategies = this.strategies();
    const results: Array<{strategy: string, canHandle: boolean, name: string}> = [];
    
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
  public validateStrategies(): {isValid: boolean, missing: string[], extra: string[]} {
    const requiredStrategies = ['transaction', 'jira', 'batch', 'natural', 'browse', 'error'];
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
  public getStrategyInfo(): Array<{type: string, name: string, canHandleMethod: boolean}> {
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