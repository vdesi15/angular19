import { Component, Input, Output, EventEmitter, ViewChild, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { get } from 'lodash-es';
import { Table, TableModule, TablePageEvent } from 'primeng/table'; // Import TablePageEvent
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
  
  // ✨ THE FIX: `tableData` is now a simple array property. Not a signal. ✨
  public tableData: any[] = [];
  public totalRecords: number = 0;

  // ✨ Inject ChangeDetectorRef to manually trigger updates ✨
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    console.log("LogViewerComponent created.");
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchInstance']) {
      const currentSearch = changes['searchInstance'].currentValue as ActiveSearch;
      const previousSearch = changes['searchInstance'].previousValue as ActiveSearch | undefined;

      // If this is a completely different search result, clear everything.
      if (!previousSearch || currentSearch.id !== previousSearch.id) {
        console.log("[LogViewer] New search detected. Resetting table.");
        this.tableData = [];
        // Reset paginator to the first page
        if (this.logTable) {
          this.logTable.first = 0;
        }
      }

      const newHits = this.getNewHits(currentSearch, previousSearch);

      if (newHits.length > 0) {
        const processedNewRows = this.processHits(newHits);
        
        // ✨ THE KEY: Mutate the array directly. ✨
        this.tableData.push(...processedNewRows);
        
        // Update the total records for the paginator.
        this.totalRecords = this.tableData.length;

        // ✨ Manually tell Angular to detect these changes. ✨
        // This forces the p-table to update its view without a hard reset.
        this.cdr.detectChanges();
        
        console.log(`[LogViewer] Appended ${processedNewRows.length} rows. Total now: ${this.tableData.length}`);
      }
    }
  }

  private getNewHits(current: ActiveSearch, previous: ActiveSearch | undefined): ElkHit[] {
    const currentData = current?.data ?? [];
    if (!previous) { return currentData; }
    const previousLength = previous.data?.length ?? 0;
    if (currentData.length <= previousLength) { return []; }
    return currentData.slice(previousLength);
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

  // The rest of the component is unchanged.
}