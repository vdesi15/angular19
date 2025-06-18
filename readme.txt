import { Component, Input, OnChanges, SimpleChanges, WritableSignal, signal, ViewChild } from '@angular/core';
import { get } from 'lodash-es';
// ... other imports

@Component({
  selector: 'app-log-viewer',
  // ...
})
export class LogViewerComponent implements OnChanges {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  // ... other inputs/outputs

  @ViewChild('logTable') logTable!: Table;
  
  // This signal holds the data displayed by the table.
  public tableData: WritableSignal<any[]> = signal([]);

  /**
   * This hook fires when an @Input changes. It's our main trigger.
   */
  ngOnChanges(changes: SimpleChanges): void {
    // We only care about changes to the main searchInstance object
    if (changes['searchInstance']) {
      const currentSearch = changes['searchInstance'].currentValue as ActiveSearch;
      const previousSearch = changes['searchInstance'].previousValue as ActiveSearch;

      // Check if this is the first time data is coming in or if it's an incremental update
      const newHits = this.getNewHits(currentSearch, previousSearch);

      if (newHits.length > 0) {
        // Process ONLY the new rows
        const processedNewRows = this.processHits(newHits);

        // ✨ THE KEY: Update the signal by pushing to the existing value's array ✨
        this.tableData.update(currentRows => {
          return [...currentRows, ...processedNewRows];
        });
      }

      // If it's a completely new search (e.g., different ID), clear the table
      if (previousSearch && currentSearch.id !== previousSearch.id) {
        this.tableData.set([]);
      }
    }
  }
  
  /**
   * Helper to get only the new hits that arrived in this change.
   */
  private getNewHits(current: ActiveSearch, previous: ActiveSearch | undefined): ElkHit[] {
    if (!previous || previous.data.length === 0) {
      return current.data; // This is the first batch of data
    }
    // Return only the items that were added since the last update
    return current.data.slice(previous.data.length);
  }
  
  /**
   * Helper to process an array of raw hits into table rows.
   */
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

  // The rest of the component (global filter, row click) is unchanged.
}