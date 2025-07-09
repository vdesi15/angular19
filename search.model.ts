import { StreamFilter } from "src/app/core/models/stream-filter.model";
import { TransactionDetailsResponse } from "./transactionDetails/transaction-details.model";

/**
 * Defines the type of search being performed. This controls which
 * components, strategies, and logic are used.
 */
export type SearchType = 'browse' | 'error' | 'transaction' | 'jira' | 'batch' | 'natural';

/**
 * Represents a user's request to initiate a new search.
 * This is the object passed to the SearchOrchestratorService.
 */
export interface SearchRequest {
  type: SearchType;
  title: string;
  appName: string;
  query?: any; // The main search query (e.g., a GUID for a transaction search, JIRA ID, batch ID)
  preFilter?: string; // A pre-filter for streaming searches (e.g., 'log.level:error')
  metadata?: Record<string, any>; // Additional context from query detection
}

/**
 * Represents the raw hit object from an Elasticsearch-like response.
 */
export interface ElkHit {
  _id: string;
  _source: any;
}

/**
 * Represents the payload of a single 'pushData' event from the SSE stream.
 */
export interface SseDataPayload {
  hits: ElkHit[];
  total: number;
}

/**
 * Enhanced search response that can handle different search types
 */
export interface SearchResponse {
  hits: ElkHit[];
  total: number;
  aggregations?: any;
  metadata?: Record<string, any>;
}

/**
 * Transaction-specific search response
 */
export interface TransactionSearchResponse extends SearchResponse {
  transactionDetails?: {
    transactionId: string;
    status: string;
    duration: number;
    startTime: Date;
    endTime?: Date;
    spans?: any[];
    tags?: Record<string, any>;
  };
}

/**
 * JIRA-specific search response
 */
export interface JiraSearchResponse extends SearchResponse {
  jiraDetails?: {
    ticketId: string;
    project: string;
    status: string;
    priority: string;
    assignee?: string;
    reporter?: string;
    created: Date;
    updated?: Date;
    summary: string;
    description?: string;
  };
  associatedTransactions?: ElkHit[];
}

/**
 * Batch-specific search response
 */
export interface BatchSearchResponse extends SearchResponse {
  batchDetails?: {
    batchId: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    startTime: Date;
    endTime?: Date;
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    successRate: number;
  };
  processingSteps?: any[];
  metrics?: any;
}

/**
 * Natural language search response
 */
export interface NaturalLanguageSearchResponse extends SearchResponse {
  aiContext?: {
    originalQuery: string;
    interpretedQuery: string;
    confidence: number;
    suggestions?: string[];
    translatedFilters?: any[];
  };
}

/**
 * Represents the complete state of a single search instance (an accordion panel).
 * This is the main state object managed by the SearchOrchestratorService's signal array.
 */
export interface ActiveSearch extends SearchRequest {
  id: string; // A unique ID for this specific instance
  isLoading: boolean;
  isStreaming: boolean;
  isExpanded: boolean;
  data: ElkHit[]; // The accumulated raw data from the server
  error?: string;
  totalRecords: number; // The total number of records for the query
  streamFilters: StreamFilter[]; // The array of user-applied stream filters
  
  // A map holding pre-aggregated, unique values for filterable fields.
  // e.g., { 'service.name': Set<string>, 'http.response.status_code': Set<number> }
  aggregatedFilterValues: Map<string, Set<any>>;
  
  // Additional metadata based on search type
  searchMetadata?: {
    detectionResult?: any; // Query detection result
    searchStrategy?: string; // Which strategy was used
    confidence?: number; // Detection confidence
    originalQuery?: string; // Original user input
  };
  
  // Auto-refresh settings for batch searches
  refreshInterval?: number;
  lastUpdated?: Date;

  transactionDetails?: TransactionDetailsResponse;
  batchData?: BatchSSEData[];
}

/**
 * Enhanced search request that includes detection context
 */
export interface EnhancedSearchRequest extends SearchRequest {
  detectionResult?: {
    type: string;
    confidence: number;
    extractedValue: string;
    metadata?: Record<string, any>;
  };
  originalQuery?: string;
}

/**
 * Search execution context
 */
export interface SearchExecutionContext {
  searchId: string;
  strategy: string;
  startTime: Date;
  globalFilters: any;
  streamFilters: StreamFilter[];
  preFilter?: string;
  metadata?: Record<string, any>;
}

/**
 * Search result metadata for UI display
 */
export interface SearchResultMetadata {
  executionTime: number; // milliseconds
  strategy: string;
  confidence?: number;
  recordCount: number;
  hasMore: boolean;
  lastUpdated: Date;
  errors?: string[];
  warnings?: string[];
}

// Export all types for easy importing
export {
  SearchType,
  SearchRequest,
  ElkHit,
  SseDataPayload,
  SearchResponse,
  TransactionSearchResponse,
  JiraSearchResponse,
  BatchSearchResponse,
  NaturalLanguageSearchResponse,
  ActiveSearch,
  EnhancedSearchRequest,
  SearchExecutionContext,
  SearchResultMetadata
};