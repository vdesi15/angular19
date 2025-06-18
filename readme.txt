import { Component, computed, EventEmitter, inject, Input, Output, Signal, ViewChild } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';

// --- PrimeNG Modules ---
import { Table, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ColumnFilterModule } from 'primeng/columnfilter';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

// --- App Components, Models & Services ---
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { TransformPipe } from 'src/app/core/pipes/transform.pipe';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    JsonPipe, 
    TableModule, 
    InputTextModule, 
    ColumnFilterModule, 
    TooltipModule, 
    IconFieldModule, 
    InputIconModule, 
    TransformPipe
  ],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss']
})
export class LogViewerComponent {
  // --- Inputs & Outputs ---
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Output() rowDrilldown = new EventEmitter<any>();

  // Get a reference to the p-table component instance in the template
  @ViewChild('logTable') logTable!: Table;
  
  // --- Derived Signals ---

  // This signal flattens the raw ELK data from the parent into a simple array of objects.
  public tableData: Signal<any[]> = computed(() => {
    const columns = this.visibleColumns;
    const hits = this.searchInstance.data as ElkHit[] ?? [];

    return hits.map(hit => {
      const row: any = { 
        _id: hit._id, 
        _original: hit._source // Keep original source for context in transforms/events
      };
      columns.forEach(col => {
        // Use the `field` property for safe, deep data extraction.
        row[col.name] = get(hit._source, col.field, 'N/A');
      });
      return row;
    });
  });

  // This signal derives the list of field names for the p-table's global filter.
  public globalFilterFields = computed<string[]>(() => {
    return this.visibleColumns.map(c => c.name);
  });

  // --- Event Handlers ---

  /**
   * Called by the global filter input in the table's caption.
   * It triggers the p-table's built-in filtering mechanism.
   */
  applyGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.logTable.filterGlobal(value, 'contains');
  }
  
  /**
   * Emits the original source data of a row when clicked for drill-down.
   */
  handleRowClick(rowData: any): void {
    // Example: Drill down using a specific field from the original source data.
    const drilldownQuery = rowData._original?.user?.id; 
    if (drilldownQuery) {
      this.rowDrilldown.emit(drilldownQuery);
    }
  }
}



