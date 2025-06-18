import { Component, computed, EventEmitter, inject, Input, Output, Signal, ViewChild, OnChanges, SimpleChanges, effect, WritableSignal, signal } from '@angular/core';
// ... other imports

@Component({ /* ... */ })
export class LogViewerComponent implements OnChanges {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Output() rowDrilldown = new EventEmitter<any>();

  @ViewChild('logTable') logTable!: Table;
  
  // This signal holds the complete, flattened dataset.
  private allTableData: WritableSignal<any[]> = signal([]);
  // This signal holds the state of the paginator's "first" record index.
  private paginatorFirst: WritableSignal<number> = signal(0);
  
  constructor() {
    // This effect's ONLY job is to update our full dataset when new hits arrive.
    // It depends only on the raw data from the parent.
    effect(() => {
      const hits = this.searchInstance.data ?? [];
      const columns = this.visibleColumns;
      
      console.log(`[LogViewer DataEffect] Received ${hits.length} total hits.`);

      const newTableData = hits.map(hit => {
        const row: any = { _id: hit._id, _original: hit._source };
        columns.forEach(col => { row[col.name] = get(hit._source, col.field, 'N/A'); });
        return row;
      });
      
      this.allTableData.set(newTableData);
    });
  }

  // ngOnChanges is no longer needed for data, but can be kept for columns.
  ngOnChanges(changes: SimpleChanges) {
    // ...
  }
  
  /**
   * This method is called by the paginator when the user changes the page.
   * We simply update our local signal to store the new page state.
   */
  onPageChange(event: any): void {
    this.paginatorFirst.set(event.first);
  }

  // ... handleRowClick, applyGlobalFilter, etc. ...
}

<p-table #logTable 
  [value]="allTableData()" <!-- Bind to the full dataset -->
  [columns]="visibleColumns"
  [paginator]="true" 
  [rows]="50" 
  [totalRecords]="allTableData().length"
  [first]="paginatorFirst()" <!-- ✨ Control the paginator's state with our signal -->
  (onPageChange)="onPageChange($event)" <!-- ✨ Update our state when the user paginates -->
  ...
>
  <!-- ... rest of template ... -->
</p-table>