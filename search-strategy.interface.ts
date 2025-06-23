import { Observable } from 'rxjs';

export interface SearchDataResponse {
  hits: any[];
  total: number;
  aggregations?: any;
}

export interface SearchStrategy {
  canHandle(query: any, context?: any): boolean;
  execute(query: any, globalFilters: SearchFilterModel, streamFilters: StreamFilter[], preFilter?: string): Observable<any>;
  getStrategyName(): string;
}

export interface TransactionSearchResponse extends SearchDataResponse {
  transactionDetails?: any;
  relatedSpans?: any[];
}

export interface JiraSearchResponse extends SearchDataResponse {
  jiraDetails?: any;
  associatedTransactions?: any[];
}

export interface BatchSearchResponse extends SearchDataResponse {
  batchDetails?: any;
  batchStatus?: string;
  processedCount?: number;
