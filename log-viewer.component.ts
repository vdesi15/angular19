// log-viewer.component.ts - Updated with enhanced click handling
import { Component, Input, Output, EventEmitter, ViewChild, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { get } from 'lodash-es';

// PrimeNG imports
import { Table, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';

// App imports
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition, CellClickEvent } from 'src/app/core/models/column-definition.model';
import { TransformPipe } from 'src/app/core/pipes/transform.pipe';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    TransformPipe
  ],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss']
})
export class LogViewerComponent implements OnChanges {
  @Input() data: any[] = [];
  @Input() loading = false;
  @Input() searchType: string = 'streaming';
  @Input() appName: string = '';
  @Input() filters: StreamFilter[] = [];
  @Input() transactionDetails?: TransactionDetailsResponse; // For actions that need full context

  @Output() rowDrilldown = new EventEmitter<any>();
  
  @ViewChild('logTable') logTable!: Table;

  // Injected services
  private columnDefinitionService = inject(ColumnDefinitionService);
  private viewDefinitionService = inject(ViewDefinitionService);
  private cellClickActionService = inject(CellClickActionService);

  // State signals
  private _processedData: WritableSignal<any[]> = signal([]);
  public readonly loadingArray = Array(10).fill(null);

  // Computed signals
  public readonly displayData = computed(() => 
    this.loading ? [] : this._processedData()
  );
  
  public readonly isLoading = computed(() => this.loading);
  
  public readonly columnDefinitions = computed(() => 
    this.columnDefinitionService.getColumnsForSearchType(this.searchType)
  );
  
  public readonly viewDefinition = computed(() => 
    this.viewDefinitionService.getViewForSearchType(this.searchType)
  );
  
  public readonly visibleColumns = computed(() => {
    const columns = this.columnDefinitions();
    const view = this.viewDefinition();
    
    if (!view?.visibleColumns?.length) {
      return columns.filter(col => col.visible);
    }
    
    return columns.filter(col => 
      col.visible && view.visibleColumns!.includes(col.id)
    );
  });

  ngOnInit(): void {
    this.processData();
  }

  ngOnChanges(): void {
    this.processData();
  }

  /**
   * Process raw data for display
   */
  private processData(): void {
    if (!this.data?.length) {
      this._processedData.set([]);
      return;
    }

    const processed = this.data.map((item, index) => ({
      ...item,
      _rowId: item.id || `row_${index}`,
      _index: index
    }));

    this._processedData.set(processed);
  }

  /**
   * Handle cell click events
   */
  public handleCellClick(
    event: Event, 
    columnDef: ColumnDefinition, 
    rowData: any, 
    cellValue: any
  ): void {
    if (columnDef.onClick) {
      event.stopPropagation();
      
      console.log(`[LogViewer] Cell clicked on column: ${columnDef.field}`, {
        action: columnDef.onClick.action,
        format: columnDef.onClick.format,
        cellValue,
        rowData
      });

      this.cellClickActionService.handleCellClick({
        columnDef,
        rowData,
        cellValue,
        transactionDetails: this.transactionDetails
      });
    }
  }

  /**
   * Handle row click for drill-down functionality
   */
  public handleRowClick(rowData: any): void {
    const identifier = this.extractIdentifierFromRow(rowData);
    if (identifier) {
      console.log(`[LogViewer] Row clicked, drilling down with: ${identifier}`);
      this.rowDrilldown.emit(identifier);
    }
  }

  /**
   * Extract identifier from row data for drill-down
   */
  private extractIdentifierFromRow(rowData: any): string | null {
    const identifierFields = ['transactionId', 'id', 'traceId', 'requestId', 'correlationId'];
    
    for (const field of identifierFields) {
      const value = this.getCellValue(rowData, field);
      if (value) {
        return String(value);
      }
    }

    const source = rowData._source || rowData;
    for (const field of identifierFields) {
      const value = source[field];
      if (value) {
        return String(value);
      }
    }

    return null;
  }

  /**
   * Get tooltip text for click actions
   */
  public getClickTooltip(action: string): string {
    switch (action) {
      case 'OpenTransactionComponent':
        return 'Click to view transaction details';
      case 'ShowRawJSON':
        return 'Click to view raw JSON data';
      case 'ShowSourceInputOutputMessageinXML':
        return 'Click to view message details';
      default:
        return 'Click to perform action';
    }
  }

  /**
   * Get cell value with support for nested properties
   */
  public getCellValue(rowData: any, fieldPath: string): any {
    if (!rowData || !fieldPath) return null;

    const keys = fieldPath.split('.');
    let value = rowData;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Format cell value based on column definition
   */
  public formatCellValue(value: any, column: ColumnDefinition): string {
    if (value === null || value === undefined) {
      return '<span class="text-400">—</span>';
    }

    // Apply column-specific formatting based on transform property
    switch (column.transform) {
      case 'date':
        return this.formatDate(value);
      case 'timestamp':
        return this.formatTimestamp(value);
      case 'duration':
        return this.formatDuration(value);
      case 'status':
        return this.formatStatus(value);
      case 'level':
        return this.formatLogLevel(value);
      case 'json':
        return this.formatJson(value);
      default:
        return this.formatDefault(value);
    }
  }

  private formatDate(value: any): string {
    try {
      const date = new Date(value);
      return date.toLocaleDateString();
    } catch {
      return String(value);
    }
  }

  private formatTimestamp(value: any): string {
    try {
      const date = new Date(value);
      return date.toLocaleString();
    } catch {
      return String(value);
    }
  }

  private formatDuration(value: any): string {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    
    if (num < 1000) return `${num}ms`;
    if (num < 60000) return `${(num / 1000).toFixed(2)}s`;
    return `${(num / 60000).toFixed(2)}m`;
  }

  private formatStatus(value: any): string {
    const status = String(value).toLowerCase();
    let severity = 'info';
    
    if (['error', 'failed', 'failure'].includes(status)) {
      severity = 'danger';
    } else if (['warning', 'warn'].includes(status)) {
      severity = 'warning';
    } else if (['success', 'completed', 'ok'].includes(status)) {
      severity = 'success';
    }
    
    return `<p-tag severity="${severity}" value="${value}"></p-tag>`;
  }

  private formatLogLevel(value: any): string {
    const level = String(value).toUpperCase();
    let severity = 'info';
    
    switch (level) {
      case 'ERROR':
        severity = 'danger';
        break;
      case 'WARN':
      case 'WARNING':
        severity = 'warning';
        break;
      case 'INFO':
        severity = 'info';
        break;
      case 'DEBUG':
        severity = 'secondary';
        break;
    }
    
    return `<p-tag severity="${severity}" value="${level}"></p-tag>`;
  }

  private formatJson(value: any): string {
    try {
      if (typeof value === 'string') {
        JSON.parse(value);
        return `<code class="json-preview">${this.truncateText(value, 100)}</code>`;
      } else if (typeof value === 'object') {
        const jsonStr = JSON.stringify(value, null, 2);
        return `<code class="json-preview">${this.truncateText(jsonStr, 100)}</code>`;
      }
    } catch {
      // Not valid JSON, treat as string
    }
    return this.formatDefault(value);
  }

  private formatDefault(value: any): string {
    const str = String(value);
    return this.truncateText(str, 200);
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  }

  public getColumnStyle(column: ColumnDefinition): any {
    const style: any = {};
    
    if (column.width) {
      style.width = column.width;
      style.minWidth = column.width;
    }
    
    if (column.onClick) {
      style.cursor = 'pointer';
    }
    
    return style;
  }

  public getColumnHeaderStyle(column: ColumnDefinition): any {
    const style: any = {};
    
    if (column.width) {
      style.width = column.width;
      style.minWidth = column.width;
    }
    
    return style;
  }

  public trackByRowId(index: number, item: any): any {
    return item._rowId || item.id || index;
  }
}