import { Component, computed, EventEmitter, inject, Input, Output, Signal, WritableSignal, signal, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';

// --- PrimeNG Modules ---
import { Table, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ColumnFilterModule } from 'primeng/columnfilter';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';

// --- App Components, Models & Services ---
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';
import { TransformPipe } from 'src/app/core/pipes/transform.pipe';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, JsonPipe, TableModule, InputTextModule, 
    ColumnFilterModule, IconFieldModule, InputIconModule, TooltipModule, TransformPipe
  ],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss']
})
export class LogViewerComponent implements OnChanges {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) allColumnsForViewType: ColumnDefinition[] = [];
  @Input({ required: true }) viewId!: string;
  @Output() rowDrilldown = new EventEmitter<any>();

  // Get a reference to the p-table component instance in the template
  @ViewChild('logTable') logTable!: Table;

  private viewDefService = inject(ViewDefinitionService);
  
  // Writable signal for the global filter text input
  public globalFilter: WritableSignal<string> = signal('');
  // Writable signal to hold the state of which columns are currently visible
  public visibleColumns: WritableSignal<ColumnDefinition[]> = signal([]);

  // This computed signal determines which columns are *available* for the selected view.
  public availableColumnsForView: Signal<ColumnDefinition[]> = computed(() => {
    const selectedViewId = this.viewId;
    // If no view is selected, all columns are potentially available.
    if (!selectedViewId) {
      return this.allColumnsForViewType;
    }
    // Filter columns based on the selected view.
    return this.allColumnsForViewType.filter(col => {
      // If `views` is not defined on a column, it's universal and should be included.
      if (!col.views) {
        return true;
      }
      // Otherwise, check if the current viewId is in the column's comma-separated list.
      return col.views.split(',').map(v => v.trim()).includes(selectedViewId);
    });
  });

  // This computed signal flattens the raw ELK data into a simple array of objects for the table.
  public tableData: Signal<any[]> = computed(() => {
    // This depends on visibleColumns, so the table re-renders when column visibility changes.
    const columns = this.visibleColumns();
    const hits = this.searchInstance.data as ElkHit[] ?? [];

    return hits.map(hit => {
      const row: any = { _id: hit._id, _original: hit._source }; // Keep original for context
      columns.forEach(col => {
        // Use the `field` property for safe, deep data extraction.
        row[col.name] = get(hit._source, col.field, 'N/A');
      });
      return row;
    });
  });
  
  // We use ngOnChanges to react when the inputs from the parent component change.
  ngOnChanges(changes: SimpleChanges): void {
    // If the available columns or the selected view changes, reset to the default visibility.
    if (changes['allColumnsForViewType'] || changes['viewId']) {
      this.resetColumnsToDefault();
    }
  }

  /**
   * Public method called by the parent to reset column visibility.
   */
  public resetColumnsToDefault(): void {
    // Filter the available columns to only those marked as `visible: true` by the API.
    const defaultVisible = this.availableColumnsForView().filter(c => c.visible);
    this.visibleColumns.set(defaultVisible);
  }

  /**
   * Called by the global filter input in the table's caption.
   */
  applyGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.logTable.filterGlobal(value, 'contains');
  }
  
  /**
   * Emits the original source data of a row when clicked for drill-down.
   */
  handleRowClick(rowData: any): void {
    const drilldownQuery = rowData._original?.user?.id; // Example drill-down field
    if (drilldownQuery) {
      this.rowDrilldown.emit(drilldownQuery);
    }
  }
}