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
  minWidth?: string; // Minimum width
  maxWidth?: string; // Maximum width
  isClickable?: boolean;
  clickTarget?: 'TransactionDetailsGrid' | 'Editor' | string;
  sortable?: boolean;
  filterable?: boolean;
  dataType?: 'text' | 'number' | 'date' | 'boolean';
  alignment?: 'left' | 'center' | 'right';
}

export interface CellClickEvent {
  column: ColumnDefinition;
  rowData: any;
  originalData: any;
  clickTarget: string;
}