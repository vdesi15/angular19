// Alternative approach: Track the last processed data length
export class LogViewerComponent implements OnChanges {
  // ... existing code ...
  
  private lastProcessedLength = 0;

  constructor() {
    effect(() => {
      const currentSearch = this.searchState();
      const columns = this.visibleColumnsState();

      if (!currentSearch) return;
      
      const hits = currentSearch.data ?? [];
      console.log(`[LogViewer Effect] Running. Processing ${hits.length} hits with ${columns.length} visible columns.`);

      // Only process new hits to avoid recreating the entire table
      if (hits.length > this.lastProcessedLength) {
        const newHits = hits.slice(this.lastProcessedLength);
        console.log(`[LogViewer Effect] Processing ${newHits.length} new hits.`);
        
        const newRows = newHits.map(hit => {
          const row: any = { _id: hit._id, _original: hit._source };
          columns.forEach(col => {
            row[col.name] = get(hit._source, col.field, 'N/A');
          });
          return row;
        });
        
        // Append new rows instead of replacing all data
        this.tableData.update(currentData => [...currentData, ...newRows]);
        this.lastProcessedLength = hits.length;
      } else if (hits.length < this.lastProcessedLength) {
        // Handle case where search was reset
        const newTableData = hits.map(hit => {
          const row: any = { _id: hit._id, _original: hit._source };
          columns.forEach(col => {
            row[col.name] = get(hit._source, col.field, 'N/A');
          });
          return row;
        });
        
        this.tableData.set(newTableData);
        this.lastProcessedLength = hits.length;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchInstance']) {
      const newSearchInstance = changes['searchInstance'].currentValue as ActiveSearch;
      
      // Check if this is a new search (different ID) - reset processed length
      const currentSearch = this.searchState();
      if (!currentSearch || currentSearch.id !== newSearchInstance.id) {
        this.lastProcessedLength = 0;
        this.tableData.set([]); // Clear existing data for new search
      }
      
      console.log(`[LogViewer ngOnChanges] Input 'searchInstance' changed. Received ${newSearchInstance.data.length} records.`);
      this.searchState.set(newSearchInstance);
    }

    if (changes['visibleColumns']) {
      const newVisibleColumns = changes['visibleColumns'].currentValue as ColumnDefinition[];
      console.log(`[LogViewer ngOnChanges] Input 'visibleColumns' changed. Now showing ${newVisibleColumns.length} columns.`);
      this.visibleColumnsState.set(newVisibleColumns);
      // Reset processed length when columns change to reprocess all data
      this.lastProcessedLength = 0;
    }
  }

  // ... rest of existing methods ...
}