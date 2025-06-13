import { Observable } from 'rxjs';

export interface SearchDataResponse {
  hits: any[];
  total: number;
}

export interface SearchStrategy {
  canHandle(query: string): boolean;
  execute(query: any, preFilter?: string): Observable<SearchDataResponse | any>;
}