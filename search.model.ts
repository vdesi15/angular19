import { StreamFilter } from "src/app/core/models/stream-filter.model";

/**
 * Defines the type of search being performed. This controls which
 * components, strategies, and logic are used.
 */
export type SearchType = 'browse' | 'error' | 'transaction';

/**
 * Represents a user's request to initiate a new search.
 * This is the object passed to the SearchOrchestratorService.
 */
export interface SearchRequest {
  type: SearchType;
  title: string;
  appName: string;
  query?: any; // The main search query (e.g., a GUID for a transaction search)
  preFilter?: string; // A pre-filter for streaming searches (e.g., 'log.level:error')
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
}