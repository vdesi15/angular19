Step 1: The SearchOrchestratorService (The Core Fix)
This is where the magic happens. We will change processSseEvent to mutate the array.
File: src/app/features/search-logs/services/search-orchestrator.service.ts (Definitive Final Version)
Generated typescript
// ... imports

@Injectable({ providedIn: 'root' })
export class SearchOrchestratorService {
  public activeSearches: WritableSignal<ActiveSearch[]> = signal([]);
  // ... other properties and constructor

  private processSseEvent(id: string, event: SseEvent): void {
    const searches = this.activeSearches();
    const targetSearchIndex = searches.findIndex(s => s.id === id);
    if (targetSearchIndex === -1) return;

    const targetSearch = searches[targetSearchIndex];
    let updatedSearch: ActiveSearch;

    switch(event.type) {
      case 'OPEN':
        updatedSearch = { ...targetSearch, isLoading: true, isStreaming: true, data: [] };
        break;
      
      case 'DATA':
        if (!event.data?.hits) {
          updatedSearch = targetSearch;
          break;
        }
        
        // ✨ THE KEY FIX: MUTATE the data array on the existing object. ✨
        targetSearch.data.push(...event.data.hits);
        
        // Now, create a new object reference for the signal system, but ensure
        // it points to our mutated data array. This gives us the best of both worlds.
        updatedSearch = { 
          ...targetSearch, // This carries over the reference to the mutated `data` array
          totalRecords: event.data.total ?? targetSearch.totalRecords,
          // We can set isLoading to false after the first chunk arrives
          // so the skeleton disappears, but keep isStreaming true.
          isLoading: false 
        };
        break;
        
      case 'END':
      case 'ERROR':
        updatedSearch = { ...targetSearch, isLoading: false, isStreaming: false, error: event.error?.message };
        break;
        
      default:
        updatedSearch = targetSearch;
        break;
    }
    
    // Update the main array to trigger change detection down the component tree.
    const newSearches = [...searches];
    newSearches[targetSearchIndex] = updatedSearch;
    this.activeSearches.set(newSearches);
  }

  // ... rest of the service is unchanged and correct
}
Use code with caution.
TypeScript
Step 2: The LogViewerComponent (Simplified Again)
We can now remove the complex ngOnChanges and effect logic from the LogViewerComponent. It can go back to being a simpler component that relies on a computed signal, because the underlying data source is now stable.
File: src/app/features/search-logs/components/log-viewer/log-viewer.component.ts (Definitive Final Version)
Generated typescript
import { Component, computed, EventEmitter, inject, Input, Output, Signal, ViewChild } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';

// PrimeNG Modules
import { Table, TableModule } from 'primeng/table';
// ... other PrimeNG imports

// App Models & Pipes
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { TransformPipe } from 'src/app/core/pipes/transform.pipe';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [ /* ... all necessary modules ... */ ],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss']
})
export class LogViewerComponent {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Output() rowDrilldown = new EventEmitter<any>();

  @ViewChild('logTable') logTable!: Table;

  // ✨ BACK TO A SIMPLE COMPUTED SIGNAL ✨
  // This is now safe because the underlying `searchInstance.data` array reference is stable.
  // The computed signal will re-run, but it won't cause the table to reset its page.
  public tableData: Signal<any[]> = computed(() => {
    const columns = this.visibleColumns;
    const hits = this.searchInstance.data as ElkHit[] ?? [];
    
    return hits.map(hit => {
      const row: any = { _id: hit._id, _original: hit._source };
      columns.forEach(col => {
        row[col.name] = get(hit._source, col.field, 'N/A');
      });
      return row;
    });
  });

  // This computed signal is also fine.
  public globalFilterFields = computed<string[]>(() => {
    return this.visibleColumns.map(c => c.field);
  });
  
  // No more constructor effect or ngOnChanges needed for data handling!
  constructor() {}
  
  applyGlobalFilter(event: Event): void { /* ... */ }
  handleRowClick(rowData: any): void { /* ... */ }
}
Use code with caution.
TypeScript
log-viewer.component.html (Final Version)
The template is now simple and correct for client-side pagination.
Generated html
<p-table #logTable 
  [value]="tableData()" 
  [columns]="visibleColumns"
  [paginator]="true" 
  [rows]="50" 
  [rowsPerPageOptions]="[25, 50, 100, 250]"
  ...
>
  <!-- ... all other template sections are correct ... -->
</p-table>
