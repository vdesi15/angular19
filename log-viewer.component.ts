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
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Input() selectedViewFilter?: string;  
  @Output() rowDrilldown = new EventEmitter<any>();
  @Output() filteredCountChange = new EventEmitter<number>();
  
  // ✨ New output for cell clicks
  @Output() cellClick = new EventEmitter<CellClickEvent>();

  @ViewChild('logTable') logTable!: Table;
  @ViewChild('tableContainer', { static: true }) tableContainer!: ElementRef;
  
  // Simple properties
  public tableData: any[] = [];
  public totalRecords: number = 0;
  public isLoading: boolean = false;

  private viewDefService = inject(ViewDefinitionService);
  private cellClickActionService = inject(CellClickActionService);
  public globalFilterFields = computed(() => 
    this.visibleColumns.map(c => c.name)
  );

  private cdr = inject(ChangeDetectorRef);
  
  constructor() {
    console.log("[LogViewerComponent] Initialized");
  }

   ngOnChanges(changes: SimpleChanges): void {
  let shouldReprocessAll = false;

  // Handle search instance changes
  if (changes['searchInstance']) {
    const currentSearch = changes['searchInstance'].currentValue as ActiveSearch;
    const previousSearch = changes['searchInstance'].previousValue as ActiveSearch | undefined;

    this.isLoading = currentSearch.isLoading;

    // New search - reset everything
    if (!previousSearch || currentSearch.id !== previousSearch.id) {
      console.log("[LogViewer] New search detected. Resetting table.");
      this.resetTableData();
      shouldReprocessAll = true;
    }
    // Same search - check for new data
    else if (this.hasNewData(currentSearch, previousSearch)) {
      console.log('[LogViewer] New data detected, will reprocess all data');
      shouldReprocessAll = true;
    }

    if (currentSearch.error) {
      console.error(`[LogViewer] Search error: ${currentSearch.error}`);
    }
  }

  // 🔥 FIX 1: Add strict checking for view filter changes
  if (changes['selectedViewFilter']) {
    const currentFilter = changes['selectedViewFilter'].currentValue;
    const previousFilter = changes['selectedViewFilter'].previousValue;
    
    // Only process if values actually changed AND not first change
    if (currentFilter !== previousFilter && !changes['selectedViewFilter'].firstChange) {
      console.log('[LogViewer] View filter changed from', previousFilter, 'to', currentFilter);
      shouldReprocessAll = true;
    }
  }

  // Handle column changes
  if (changes['visibleColumns']) {
    const currentColumns = changes['visibleColumns'].currentValue;
    const previousColumns = changes['visibleColumns'].previousValue;
    
    // Only process if columns actually changed AND not first change
    const columnsChanged = !changes['visibleColumns'].firstChange && 
                          JSON.stringify(currentColumns) !== JSON.stringify(previousColumns);
    
    if (columnsChanged) {
      console.log("[LogViewer] Visible columns updated:", this.visibleColumns.length);
      shouldReprocessAll = true;
    }
  }

  // Reprocess all data if needed (single point of processing)
  if (shouldReprocessAll) {
    console.log('[LogViewer] REPROCESSING - Reason:', {
      searchChange: !!changes['searchInstance'],
      filterChange: !!changes['selectedViewFilter'],
      columnChange: !!changes['visibleColumns']
    });
    this.reprocessAllData();
  }
}
/**
 * SINGLE METHOD: Process all current data from scratch
 * This ensures consistent filtering across all data
 */
private reprocessAllData(): void {
  const allHits = this.searchInstance.data || [];
  console.log(`[LogViewer] Reprocessing all data: ${allHits.length} hits with view filter: ${this.selectedViewFilter}`);
  
  if (allHits.length === 0) {
    this.resetTableData();
    return;
  }

  // Apply view filter first, then transform
  const filteredAndTransformed = this.processHits(allHits);
  
  this.tableData = filteredAndTransformed;
  this.totalRecords = this.tableData.length;
  this.cdr.detectChanges();
  
  // Notify parent
  setTimeout(() => {
    this.filteredCountChange.emit(this.tableData.length);
  }, 0);

  console.log(`[LogViewer] Processed ${allHits.length} → ${this.tableData.length} rows`);
}


  /**
   * Check if there's new data compared to previous search
   */
  private hasNewData(current: ActiveSearch, previous: ActiveSearch): boolean {
    const currentLength = current.data?.length || 0;
    const previousLength = previous.data?.length || 0;
    return currentLength > previousLength;
  }

  /**
   * Reset table to empty state
   */
  private resetTableData(): void {
    this.tableData = [];
    this.totalRecords = 0;
    
    setTimeout(() => {
      this.filteredCountChange.emit(0);
    }, 0);
    
    if (this.logTable) {
      this.logTable.first = 0;
    }
  }

  /**
   * Public method for external reprocessing (if needed)
   */
  public reprocessCurrentData(): void {
    this.reprocessAllData();
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
    
    // Step 1: Apply view filter ONLY for transaction searches
    let filteredHits = hits;
    if (this.searchInstance.type === 'transaction' && this.selectedViewFilter) {
      filteredHits = this.viewDefService.applyViewFilter(hits, this.selectedViewFilter);
      console.log(`[LogViewer] View filter applied: ${hits.length} → ${filteredHits.length} rows`);
    }
    
    // Step 2: Your existing transformation logic
    return filteredHits.map(hit => {
      const row: any = { 
        _id: hit._id, 
        _original: hit._source
      };
      
      columns.forEach(col => {
        const rawValue = get(hit._source, col.field, null);
        row[col.id] = rawValue;
        const transformedValue = this.transformPipe.transform(rawValue, col.transform, hit);
        const filterFieldName = `${col.id}_filter`;
        row[filterFieldName] = String(transformedValue);
      });
      
      return row;
    });
  }

  public applyGlobalFilter(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (this.logTable) {
      this.logTable.filterGlobal(target.value, 'contains');
      
      setTimeout(() => {
        const filteredCount = this.logTable.filteredValue?.length ?? this.tableData.length;
        this.filteredCountChange.emit(filteredCount);
      }, 200);
    }
  }

  public onFilter(): void {
    setTimeout(() => {
      const filteredCount = this.logTable?.filteredValue?.length ?? this.tableData.length;
      console.log(`[LogViewer] Filter applied, new count: ${filteredCount}`);
      this.filteredCountChange.emit(filteredCount);
    }, 200);
  }

  public handleRowClick(rowData: any): void {
    const identifier = this.extractIdentifierFromRow(rowData);
    if (identifier) {
      console.log(`[LogViewer] Row clicked, drilling down with: ${identifier}`);
      this.rowDrilldown.emit(identifier);
    }
  }

  public handleCellClick(column: ColumnDefinition, rowData: any, event: Event, cellValue: string): void {
    if(this.isCellClickable(column)) {
       event.stopPropagation(); 
       this.cellClickActionService.handleCellClick({
        column,
        rowData,
        cellValue,
        transactionDetails: this.searchInstance.transactionDetails,
        this.searchInstance
      });
    }
  }

  // ✨ Updated method to check if cell is clickable
  public isCellClickable(column: ColumnDefinition): boolean {
    return column.isClickable === true;
  }

  public exportData(): void {
    console.log(`[LogViewer] Export requested for ${this.tableData.length} rows`);
  }

  public refresh(): void {
    console.log("[LogViewer] Manual refresh requested");
  }
}