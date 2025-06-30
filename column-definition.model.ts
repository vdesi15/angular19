// src/app/core/models/column-definition.model.ts
export interface ColumnDefinition {
  id: string;
  name: string;
  displayName: string;
  field: string;
  visible: boolean;
  enableFiltering?: boolean;
  transform?: string;
  views?: string; // Comma-separated list of view IDs where this column should appear
  width?: string; // CSS width value (e.g., '150px', '20%', '10rem')
  sortable?: boolean;
  filterable?: boolean;
  onClick?: OnClick; // New property for click actions
}

// Transaction Details Response interface
export interface CorrelationTabData {
  [correlationId: string]: {
    input?: any;
    output?: any;
  };
}

export interface TransactionDetailsResponse {
  hits: any; // TransactionHitsPayload
  overflow: boolean;
  call_count: number;
  FORMATTED_PAYLOADS: any[];
  TRANSACTION_TIMELINE: any[]; // TransactionTimelineItem[]
  ADDITIONAL_TAB_DATA_BY_CORRID: CorrelationTabData[];
}

export interface OnClick {
  action: 'ShowRawJSON' | 'ShowSourceInputOutputMessageinXML' | 'OpenTransactionComponent' | string;
  format: 'xml' | 'json' | 'text' | 'yaml';
}