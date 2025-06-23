import { Component, Input, Output, EventEmitter, ViewChild, OnChanges, SimpleChanges, inject, ChangeDetectorRef, Signal, computed, WritableSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { get } from 'lodash-es';

// PrimeNG imports
import { Table, TableModule, TablePageEvent } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';

// App imports
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
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
export class LogViewerComponent implements OnChanges, OnInit, OnDestroy  {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Output() rowDrilldown = new EventEmitter<any>();

  @ViewChild('logTable') logTable!: Table;
  @ViewChild('tableContainer', { static: true }) tableContainer!: ElementRef;
  
  // Local state for table data
  public tableData = signal<any[]>([]);
  public totalRecords = signal<number>(0);
  public isLoading = signal<boolean>(false);

  public dynamicRowsPerPage = signal<number>(50);
  public availableRowOptions = signal<number[]>([25, 50, 100, 250]);

  public globalFilterFields = computed(() => 
    this.visibleColumns.map(c => c.name)
  );

  private cdr = inject(ChangeDetectorRef);
  private resizeObserver: ResizeObserver | null = null;
  
  constructor() {
    console.log("[LogViewerComponent] Initialized");
  }

  ngOnInit(): void {
    // ✨ Set up resize observer for dynamic row calculation
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        this.calculateOptimalRows();
      });
      
      if (this.tableContainer) {
        this.resizeObserver.observe(this.tableContainer.nativeElement);
      }
    }
    
    // ✨ Initial calculation
    setTimeout(() => this.calculateOptimalRows(), 100);
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private calculateOptimalRows(): void {
    if (!this.tableContainer) return;
    
    const containerHeight = this.tableContainer.nativeElement.clientHeight;
    
    // Approximate heights (in pixels)
    const headerHeight = 100; // Table header + filter row
    const rowHeight = 35;     // Approximate row height
    const paginatorHeight = 50; // Paginator height
    const bufferHeight = 20;   // Extra buffer
    
    const availableHeight = containerHeight - headerHeight - paginatorHeight - bufferHeight;
    const calculatedRows = Math.floor(availableHeight / rowHeight);
    
    // ✨ Constrain to reasonable bounds and available options
    const minRows = 10;
    const maxRows = 250;
    const optimalRows = Math.max(minRows, Math.min(maxRows, calculatedRows));
    
    // ✨ Find the closest available option
    const options = this.availableRowOptions();
    const closestOption = options.reduce((prev, curr) => 
      Math.abs(curr - optimalRows) < Math.abs(prev - optimalRows) ? curr : prev
    );
    
    // ✨ Only update if significantly different
    if (Math.abs(this.dynamicRowsPerPage() - closestOption) > 5) {
      this.dynamicRowsPerPage.set(closestOption);
      console.log(`[LogViewer] Dynamic rows updated to: ${closestOption} (container height: ${containerHeight}px)`);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchInstance']) {
      const currentSearch = changes['searchInstance'].currentValue as ActiveSearch;
      const previousSearch = changes['searchInstance'].previousValue as ActiveSearch | undefined;

      // Update loading state signal
      this.isLoading.set(currentSearch.isLoading);

      // If this is a completely different search result, clear everything.
      if (!previousSearch || currentSearch.id !== previousSearch.id) {
        console.log("[LogViewer] New search detected. Resetting table.");
        this.tableData.set([]);
        this.totalRecords.set(0);
        
        // Reset paginator to the first page
        if (this.logTable) {
          this.logTable.first = 0;
        }
      }

      const newHits = this.getNewHits(currentSearch, previousSearch);

      if (newHits.length > 0) {
        const processedNewRows = this.processHits(newHits);
        
        this.tableData.update(current => [...current, ...processedNewRows]);
        this.totalRecords.set(this.tableData().length);
        
        this.cdr.detectChanges();
        
        console.log(`[LogViewer] Appended ${processedNewRows.length} rows. Total now: ${this.tableData().length}`);
      }

      // Handle error states
      if (currentSearch.error) {
        console.error(`[LogViewer] Search error: ${currentSearch.error}`);
      }
    }

    // Update loading state when visibleColumns change
    if (changes['visibleColumns']) {
      console.log("[LogViewer] Visible columns updated:", this.visibleColumns.length);
    }
  }

  private getNewHits(current: ActiveSearch, previous: ActiveSearch | undefined): ElkHit[] {
    const currentData = current?.data ?? [];
    if (!previous) { 
      return currentData; 
    }
    
    const previousLength = previous.data?.length ?? 0;
    if (currentData.length <= previousLength) { 
      return []; 
    }
    
    return currentData.slice(previousLength);
  }

  private processHits(hits: ElkHit[]): any[] {
    const columns = this.visibleColumns;
    return hits.map(hit => {
      const row: any = { 
        _id: hit._id, 
        _original: hit._source,
        _timestamp: new Date() // Add timestamp for sorting/filtering
      };
      
      columns.forEach(col => {
        const rawValue = get(hit._source, col.field, null);
        row[col.name] = rawValue;
      });
      
      return row;
    });
  }

  /**
   * Handle global filter input for the table
   */
  public applyGlobalFilter(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (this.logTable) {
      this.logTable.filterGlobal(target.value, 'contains');
    }
  }

  /**
   * Handle row click for drilldown
   */
  public handleRowClick(rowData: any): void {
    // Extract a meaningful identifier for drilldown
    const identifier = this.extractIdentifierFromRow(rowData);
    if (identifier) {
      console.log(`[LogViewer] Row clicked, drilling down with: ${identifier}`);
      this.rowDrilldown.emit(identifier);
    }
  }

  /**
   * Extract identifier from row data for drilldown
   */
  private extractIdentifierFromRow(rowData: any): string | null {
    // Try common identifier fields
    const identifierFields = [
      'trace.id', 'traceId', 'transaction.id', 'transactionId', 
      'span.id', 'spanId', 'correlation.id', 'correlationId',
      'request.id', 'requestId', '_id'
    ];

    for (const field of identifierFields) {
      const value = get(rowData._original, field) || rowData[field];
      if (value && typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    // Fallback to the document ID
    return rowData._id || null;
  }

  /**
   * Check if a cell should be clickable (contains identifier)
   */
  public isCellClickable(column: ColumnDefinition, rowData: any): boolean {
    // Make certain fields clickable for drilldown
    const clickableFields = [
      'trace.id', 'traceId', 'transaction.id', 'transactionId',
      'span.id', 'spanId', 'correlation.id', 'correlationId'
    ];
    
    return clickableFields.includes(column.field);
  }

  /**
   * Handle cell-specific clicks
   */
  public handleCellClick(column: ColumnDefinition, rowData: any, event: Event): void {
    if (this.isCellClickable(column, rowData)) {
      event.stopPropagation();
      const value = get(rowData._original, column.field) || rowData[column.name];
      if (value) {
        console.log(`[LogViewer] Cell clicked, drilling down with: ${value}`);
        this.rowDrilldown.emit(value);
      }
    }
  }

  /**
   * Export current table data (for future enhancement)
   */
  public exportData(): void {
    const data = this.tableData();
    console.log(`[LogViewer] Export requested for ${data.length} rows`);
    // Implementation for data export can be added here
  }

  /**
   * Refresh the current view
   */
  public refresh(): void {
    console.log("[LogViewer] Manual refresh requested");
    // This could trigger a refresh of the current search
    // Implementation depends on parent component needs
  }
}