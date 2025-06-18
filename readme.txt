import { Component, computed, inject, Input, Output, Signal, ViewChild, OnChanges, SimpleChanges, WritableSignal, signal, EventEmitter } from '@angular/core';
import { get } from 'lodash-es';
// PrimeNG Imports
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
// ... other imports

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  // ... imports
})
export class LogViewerComponent implements OnChanges {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Output() rowDrilldown = new EventEmitter<any>();

  @ViewChild('logTable') logTable!: Table;
  
  // --- STATE SIGNALS ---

  // Holds the complete, ever-growing dataset from the parent.
  private fullDataset: WritableSignal<any[]> = signal([]);
  
  // Holds the pagination state, controlled by the user.
  public currentPage: WritableSignal<number> = signal(1);
  public rowsPerPage: WritableSignal<number> = signal(50);
  public totalRecords: WritableSignal<number> = signal(0);
  
  // ✨ THE KEY: A computed signal that ONLY returns the data for the current page. ✨
  public dataForCurrentPage: Signal<any[]> = computed(() => {
    const allData = this.fullDataset();
    const page = this.currentPage();
    const rows = this.rowsPerPage();
    
    // Calculate the start and end index for the slice.
    const startIndex = (page - 1) * rows;
    const endIndex = startIndex + rows;
    
    console.log(`[LogViewer] Slicing data. Total: ${allData.length}. Page: ${page}. Showing records ${startIndex} to ${endIndex-1}.`);
    
    return allData.slice(startIndex, endIndex);
  });

  constructor() {}
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchInstance']) {
      const currentSearch = changes['searchInstance'].currentValue as ActiveSearch;
      
      console.log(`[LogViewer ngOnChanges] Received ${currentSearch.data.length} total records.`);

      // Update the full dataset with the new, larger array from the service.
      const processedData = this.processHits(currentSearch.data ?? []);
      this.fullDataset.set(processedData);
      
      // Update the totalRecords for the paginator.
      this.totalRecords.set(currentSearch.data.length);
    }
  }
  
  /**
   * Called by the p-table paginator when the user changes page or page size.
   */
  onPageChange(event: { page: number, rows: number }): void {
    // The `page` property from the event is 0-indexed, so we add 1.
    const newPage = (event.page ?? 0) + 1;
    const newRows = event.rows ?? 50;

    console.log(`[LogViewer] User changed page to ${newPage} with ${newRows} rows per page.`);
    
    // Update our local state signals. This will trigger the `dataForCurrentPage`
    // computed signal to re-slice the data.
    this.currentPage.set(newPage);
    this.rowsPerPage.set(newRows);
  }

  private processHits(hits: ElkHit[]): any[] {
    const columns = this.visibleColumns;
    return hits.map(hit => {
      const row: any = { _id: hit._id, _original: hit._source };
      columns.forEach(col => {
        row[col.name] = get(hit._source, col.field, 'N/A');
      });
      return row;
    });
  }

  // ... other methods ...
}