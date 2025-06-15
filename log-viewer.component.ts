import { Component, computed, EventEmitter, inject, Input, Output, Signal, ViewChild } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';

// --- PrimeNG Modules ---
import { Table, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ColumnFilterModule } from 'primeng/columnfilter';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

// --- App Components & Services ---
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { TransformPipe } from 'src/app/core/pipes/transform.pipe';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, JsonPipe, TableModule, InputTextModule, 
    ColumnFilterModule, IconFieldModule, InputIconModule, TransformPipe
  ],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss']
})
export class LogViewerComponent {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) allColumnsForViewType: ColumnDefinition[] = [];
  @Input({ required: true }) viewId!: string;
  @Output() rowDrilldown = new EventEmitter<any>();

  // Get a reference to the p-table component instance in the template
  @ViewChild('logTable') logTable!: Table;

  private viewDefService = inject(ViewDefinitionService);
  
  // --- Computed Signals for Data Processing ---

  // This signal determines which columns should be rendered based on the selected view.
  public activeColumns: Signal<ColumnDefinition[]> = computed(() => {
    const selectedViewId = this.viewId;
    
    // If no view is selected, show all initially visible columns.
    if (!selectedViewId) {
      return this.allColumnsForViewType.filter(c => c.visible);
    }
    
    return this.allColumnsForViewType.filter(col => {
      // ✨ FIX 1: If `views` property doesn't exist, the column is universal.
      if (!col.views) {
        return true;
      }
      // Otherwise, check if the current viewId is in the column's list.
      return col.views.split(',').map(v => v.trim()).includes(selectedViewId);
    });
  });

  // This signal flattens the raw ELK data into a simple array of objects for the table.
  public tableData: Signal<any[]> = computed(() => {
    const columns = this.activeColumns();
    const hits = this.searchInstance.data as ElkHit[] ?? [];

    return hits.map(hit => {
      const row: any = { _id: hit._id, _original: hit._source }; // Add _id for dataKey
      columns.forEach(col => {
        row[col.name] = get(hit._source, col.field, 'N/A');
      });
      return row;
    });
  });

  // --- Event Handlers ---

  handleRowClick(rowData: any) {
    const drilldownQuery = rowData._original?.user?.id; // Example drill-down
    if (drilldownQuery) {
      this.rowDrilldown.emit(drilldownQuery);
    }
  }
  
  // This is called by the global filter input in the table's caption.
  applyGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.logTable.filterGlobal(value, 'contains');
  }
}     