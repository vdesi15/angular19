// batch-view.model.ts
export interface BatchSearchRequest {
  batchId: string;
  appName: string;
  environment?: string;
  location?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface BatchDetails {
  batchId: string;
  status: BatchStatus;
  startTime: Date;
  endTime?: Date;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  successRate: number;
  estimatedTimeRemaining?: number;
  processingNode?: string;
  priority: BatchPriority;
  metadata: Record<string, any>;
  errors?: BatchError[];
}

export enum BatchStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED'
}

export enum BatchPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface BatchError {
  id: string;
  timestamp: Date;
  severity: 'ERROR' | 'WARNING' | 'CRITICAL';
  message: string;
  recordId?: string;
  stackTrace?: string;
  retryCount: number;
  maxRetries: number;
}

export interface BatchProcessingStep {
  stepId: string;
  name: string;
  status: BatchStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recordsProcessed: number;
  recordsFailed: number;
  progress: number; // 0-100
  details?: Record<string, any>;
}

export interface BatchMetrics {
  throughput: number; // records per second
  averageProcessingTime: number; // milliseconds per record
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  queueSize: number;
  activeWorkers: number;
}

export interface BatchSearchResponse {
  batchDetails: BatchDetails;
  processingSteps: BatchProcessingStep[];
  metrics: BatchMetrics;
  relatedBatches?: BatchDetails[];
  logs: BatchLogEntry[];
  total: number;
}

export interface BatchLogEntry {
  id: string;
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  source: string;
  batchId: string;
  stepId?: string;
  recordId?: string;
  threadId?: string;
  metadata?: Record<string, any>;
}

// Active batch search state
export interface ActiveBatchSearch {
  id: string;
  type: 'batch';
  title: string;
  batchId: string;
  appName: string;
  isLoading: boolean;
  isExpanded: boolean;
  data: BatchSearchResponse | null;
  error?: string;
  refreshInterval?: number; // for auto-refresh
  lastUpdated?: Date;
}

// Batch toolbar actions
export interface BatchAction {
  id: string;
  label: string;
  icon: string;
  severity?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'danger';
  disabled?: boolean;
  tooltip?: string;
  action: (batchId: string) => void;
}

// Batch view configuration
export interface BatchViewConfig {
  refreshInterval: number;
  autoRefresh: boolean;
  showMetrics: boolean;
  showLogs: boolean;
  showSteps: boolean;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  maxLogEntries: number;
}

// Column definitions for batch log table
export interface BatchLogColumnDefinition {
  field: string;
  header: string;
  sortable: boolean;
  filterable: boolean;
  width?: string;
  type: 'text' | 'date' | 'number' | 'badge' | 'json';
  format?: string;
  severity?: Record<string, string>; // for badge colors
}

// Real-time updates
export interface BatchUpdateEvent {
  type: 'STATUS_CHANGE' | 'PROGRESS_UPDATE' | 'ERROR_OCCURRED' | 'COMPLETED' | 'METRICS_UPDATE';
  batchId: string;
  timestamp: Date;
  data: any;
}

// Batch comparison interface
export interface BatchComparison {
  batches: BatchDetails[];
  comparisonMetrics: {
    averageDuration: number;
    averageSuccessRate: number;
    commonErrors: BatchError[];
    performanceTrends: any[];
  };
}

// Export interfaces for use in other modules
export {
  BatchSearchRequest,
  BatchDetails,
  BatchStatus,
  BatchPriority,
  BatchError,
  BatchProcessingStep,
  BatchMetrics,
  BatchSearchResponse,
  BatchLogEntry,
  ActiveBatchSearch,
  BatchAction,
  BatchViewConfig,
  BatchLogColumnDefinition,
  BatchUpdateEvent,
  BatchComparison
};