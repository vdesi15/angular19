import { Observable } from 'rxjs';

export interface SearchDataResponse {
  hits: any[];
  total: number;
  aggregations?: any;
}

export interface SearchStrategy {
  canHandle(query: any, context?: any): boolean;
  execute(query: string, globalFilters: any, streamFilters?: any[], preFilter?: any): Observable<any>;
  getStrategyName(): string;
  getMetadata?(): any;
  
  // NEW: URL handling methods
  handleUrlParams?(params: Record<string, string>): UrlHandlingResult | null;
  updateUrlForSearch?(query: string, currentParams: Record<string, string>): Record<string, string>;
  cleanupUrlParams?(currentParams: Record<string, string>): Record<string, string>;
}

export interface UrlHandlingResult {
  searchQuery: string;
  searchType: string;
  metadata?: any;
  shouldTriggerSearch: boolean;
}

export interface TransactionSearchResponse extends SearchDataResponse {
  transactionDetails?: any;
  relatedSpans?: any[];
}

