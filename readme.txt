Part 3: Final LogViewerComponent and SearchResultComponent
These are updated to integrate the new features.
log-viewer.component.ts (Updated)
This component now receives the list of applied stream filters and uses them in its tableData calculation.
Generated typescript
// in LogViewerComponent...
@Input() appliedStreamFilters: StreamFilter[] = [];

public tableData: Signal<any[]> = computed(() => {
  const allHits = this.searchInstance.data as ElkHit[] ?? [];
  const filters = this.appliedStreamFilters;

  // 1. Apply stream filters first
  const streamFilteredHits = (filters.length > 0)
    ? allHits.filter(hit => {
        return filters.every(filter => {
          const rowValue = get(hit._source, filter.field);
          return String(rowValue) === filter.value;
        });
      })
    : allHits;

  // 2. Then flatten the remaining data for display
  const columns = this.visibleColumns;
  return streamFilteredHits.map(hit => {
    // ... mapping logic
  });
});

// Update the totalRecords for the paginator to reflect the filtered count
public totalRecords: Signal<number> = computed(() => this.tableData().length);
Use code with caution.
TypeScript
search-result.component.ts (Updated)
This component now manages the state for the new StreamingFilterComponent.
Generated typescript
// in SearchResultComponent...
@Component({
  imports: [ /* ..., */ StreamingFilterComponent ],
})
export class SearchResultComponent {
  // ...
  // ✨ State for the new stream filters ✨
  public streamFilters: WritableSignal<StreamFilter[]> = signal([]);

  // This will be passed down to the LogViewer
  public filteredData = computed(() => {
    const filters = this.streamFilters();
    if (filters.length === 0) return this.search.data;
    // ... filtering logic ...
    return this.search.data.filter(hit => { /* ... */ });
  });
  
  // ✨ Updated records summary ✨
  public recordsSummary = computed(() => {
    const totalLoaded = this.search.data.length;
    const filteredCount = this.logViewer?.table.totalRecords ?? 0; // Get filtered count from p-table
    
    if (this.search.isStreaming) {
      let summary = `(Loaded: ${totalLoaded}`;
      if (filteredCount < totalLoaded) {
        summary += ` / Filtered: ${filteredCount}`;
      }
      return summary + ')';
    }
    // ...
  });
  
  onStreamFiltersChange(filters: StreamFilter[]) {
    this.streamFilters.set(filters);
    // You could optionally re-trigger the SSE stream here with the new filters
    // by calling the orchestrator.
  }
}
Use code with caution.
TypeScript
search-result.component.html
Generated html
<!-- in p-accordion-content -->
@if(search.type !== 'transaction') {
  <app-streaming-filter 
    [fullDataset]="search.data" 
    [appliedFilters]="streamFilters()"
    (filtersChange)="onStreamFiltersChange($event)">
  </app-streaming-filter>
}

<!-- ... wrapper ... -->
  @if (search.isLoading && search.data.length === 0) {
    <!-- ✨ Show skeleton WITH headers ✨ -->
    <app-table-skeleton [columns]="allColumnsForViewType()"></app-table-skeleton>
  } @else {
    <app-log-viewer 
      [appliedStreamFilters]="streamFilters()"
      ...>
    </app-log-viewer>
  }
Use code with caution.
Html
log-viewer.component.scss (Final CSS Fix)
Generated scss
// ...
::ng-deep .p-datatable-thead > tr > th {
  padding: 0.5rem; 
  .p-column-filter {
    width: 100%; // Make the container fill the cell
  }
  input.p-inputtext {
    width: 100%; // Make the input fill the container
  }
}
Use code with caution.
Scss
Final Orchestrator Change for Filter Re-triggering
Generated typescript
// in SearchOrchestratorService...
constructor() {
  const filtersService = inject(FiltersService);
  // ✨ Re-trigger streaming searches when global filters change ✨
  effect(() => {
    const filters = filtersService.filters();
    if (!filters) return;

    this.activeSearches().forEach(search => {
      if (search.isStreaming) {
        console.log(`Global filters changed. Re-triggering stream for: ${search.title}`);
        this.fetchDataFor(search); // Re-fetch data for this active stream
      }
    });
  });
}
