export type SearchType = 'browse' | 'error' | 'transaction';

export interface SearchRequest {
  type: SearchType;
  query?: any;
  title: string;
  appName: string;
  preFilter?: string;
}

export interface ElkHit {
  _id: string;
  _source: any;
}

export interface ActiveSearch extends SearchRequest {
  id: string;
  isLoading: boolean;
  isStreaming: boolean;
  isExpanded: boolean;
  data: ElkHit[];
  error?: string;
  totalRecords: number;
}