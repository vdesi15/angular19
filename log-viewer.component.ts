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
export class LogViewerComponent implements OnChanges {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Output() rowDrilldown = new EventEmitter<any>();

  @ViewChild('logTable') logTable!: Table;
  
  // Local state for table data
  private tableDataSignal: WritableSignal<any[]> = signal([]);
  
  // Computed signal for filtered data based on stream filters
  public tableData: Signal<any[]> = computed(() => {
    const allData = this.tableDataSignal();
    const streamFilters = this.searchInstance?.streamFilters ?? [];
    
    if (streamFilters.length === 0) {
      return allData;
    }
    
    // Apply stream filters
    return allData.filter(row => {
      return streamFilters.every(filter => {
        const value = get(row._original, filter.field);
        return filter.values.includes(String(value));
      });
    });
  });
  
  public totalRecords: Signal<number> = computed(() => this.tableData().length);

  private cdr = inject(ChangeDetectorRef);
  private previousSearchId: string | null = null;

  constructor() {
    console.log("[LogViewerComponent] Initialized");
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchInstance']) {
      const currentSearch = changes['searchInstance'].currentValue as ActiveSearch;
      const previousSearch = changes['searchInstance'].previousValue as ActiveSearch | undefined;

      // Check if this is a completely different search or if data was cleared
      const isDifferentSearch = !previousSearch || currentSearch.id !== previousSearch.id;
      const wasDataCleared = previousSearch && 
        currentSearch.id === previousSearch.id && 
        currentSearch.data.length === 0 && 
        previousSearch.data.length > 0;

      if (isDifferentSearch || wasDataCleared) {
        console.log("[LogViewer] New search or data cleared. Resetting table.");
        
        // Clear table data
        this.tableDataSignal.set([]);
        
        // Reset paginator
        if (this.logTable) {
          this.logTable.first = 0;
          this.logTable.reset();
        }
      }

      // Process new data if available
      if (currentSearch.data.length > 0) {
        const processedData = this.processAllData(currentSearch.data);
        this.tableDataSignal.set(processedData);
        this.cdr.detectChanges();
      }
    }

    if (changes['visibleColumns']) {
      // Force table update when columns change
      this.cdr.detectChanges();
    }
  }

  private processAllData(hits: ElkHit[]): any[] {
    const columns = this.visibleColumns;
    return hits.map(hit => {
      const row: any = { 
        _id: hit._id, 
        _original: hit._source 
      };
      
      columns.forEach(col => {
        row[col.name] = get(hit._source, col.field, 'N/A');
      });
      
      return row;
    });
  }

  applyGlobalFilter(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (this.logTable) {
      this.logTable.filterGlobal(target.value, 'contains');
    }
  }

  handleRowClick(rowData: any): void {
    // Emit drilldown event for transaction searches
    if (this.searchInstance.type === 'transaction' && rowData._original?.trace?.id) {
      this.rowDrilldown.emit(rowData._original.trace.id);
    }
  }

  // Public method to get filtered count for parent component
  public getFilteredCount(): number {
    return this.logTable?.filteredValue?.length ?? this.tableData().length;
  }
}