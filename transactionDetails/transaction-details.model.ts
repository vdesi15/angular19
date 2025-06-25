// models/transaction-details.model.ts

export interface TransactionDetailsRequest {
  transactionId: string;
  appName: string;
  environment: string;
  location: string;
}

export interface TransactionHit {
  _index: string;
  _id: string;
  _source: any;
}

export interface TransactionHitsResponse {
  total: number;
  hits: TransactionHit[];
}

export interface TransactionTimelineItem {
  action: string;
  id: string;
  time: string; // ISO datetime string
  e: string; // event description
  l: string; // key field for timeline grouping/flow
  current?: boolean; // indicates if this is the current/active step
}

export interface TransactionDetailsResponse {
  hits: TransactionHitsResponse;
  overflow: boolean;
  call_count: number;
  FORMATTED_PAYLOADS: any[];
  TRANSACTION_TIMELINE: TransactionTimelineItem[];
}

export interface TransactionSummary {
  transactionId: string;
  status: string;
  duration: number;
  startTime: string;
  service: string;
  endpoint: string;
}

export interface TransactionDetailsSearch {
  id: string;
  type: 'transactionDetails';
  title: string;
  transactionId: string;
  appName: string;
  environment: string;
  location: string;
  isLoading: boolean;
  isExpanded: boolean;
  data: TransactionDetailsResponse | null;
  error?: string;
  parentSearchId?: string;
}