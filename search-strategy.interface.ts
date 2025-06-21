import { Observable } from 'rxjs';

export interface SearchDataResponse {
  hits: any[];
  total: number;
}

export interface SearchStrategy {
  canHandle(query: string): boolean;
  execute(
    query: any, 
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[],
    preFilter?: string
  ): Observable<any>; // Returns SseEvent stream or SearchDataResponse
}