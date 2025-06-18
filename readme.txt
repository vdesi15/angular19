import { Component, computed, EventEmitter, inject, Input, Output, Signal, ViewChild, OnChanges, SimpleChanges, effect, WritableSignal, signal, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
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

// --- App Models & Pipes ---
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { TransformPipe } from 'src/app/core/pipes/transform.pipe';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, JsonPipe, TableModule, InputTextModule, 
    ColumnFilterModule, TooltipModule, IconFieldModule, InputIconModule, TransformPipe
  ],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush // Important for manual control
})
export class LogViewerComponent implements OnChanges {
  // --- Inputs & Outputs ---
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Output() rowDrilldown = new EventEmitter<any>();

  // --- Child Reference ---
  @ViewChild('logTable') logTable!: Table;
  
  // --- MANUAL DATA MANAGEMENT (No reactive signals for table data) ---
  public tableData: any[] = []; // Regular array, not signal
  private lastProcessedLength = 0;
  private currentSearchId = '';
  private currentColumns: ColumnDefinition[] = [];

  constructor(private cdr: ChangeDetectorRef) {
    // Remove the effect - we'll handle updates manually
  }
  
  /**
   * This is the official Angular lifecycle hook for detecting changes to @Input properties.
   */
  ngOnChanges(changes: SimpleChanges): void {
    let shouldUpdateTable = false;

    // Check if the `searchInstance` input has changed
    if (changes['searchInstance']) {
      const newSearchInstance = changes['searchInstance'].currentValue as ActiveSearch;
      
      // Check if this is a completely new search
      if (this.currentSearchId !== newSearchInstance.id) {
        console.log(`[LogViewer] New search detected. Resetting table data.`);
        this.currentSearchId = newSearchInstance.id;
        this.lastProcessedLength = 0;
        this.tableData = []; // Clear existing data
        shouldUpdateTable = true;
      }
      
      // Process new data incrementally
      this.updateTableData(newSearchInstance);
    }

    // Check if the `visibleColumns` input has changed
    if (changes['visibleColumns']) {
      const newVisibleColumns = changes['visibleColumns'].currentValue as ColumnDefinition[];
      console.log(`[LogViewer] Columns changed. Rebuilding table data.`);
      this.currentColumns = [...newVisibleColumns];
      
      // Rebuild all data with new columns
      if (this.searchInstance?.data) {
        this.rebuildTableData();
      }
      shouldUpdateTable = true;
    }

    // Trigger change detection only when needed
    if (shouldUpdateTable) {
      this.cdr.detectChanges();
    }
  }

  private updateTableData(searchInstance: ActiveSearch): void {
    const hits = searchInstance.data ?? [];
    
    // Only process new hits
    if (hits.length > this.lastProcessedLength) {
      const newHits = hits.slice(this.lastProcessedLength);
      console.log(`[LogViewer] Processing ${newHits.length} new records. Total: ${hits.length}`);
      
      const newRows = this.transformHitsToRows(newHits);
      
      // Append new rows without affecting pagination
      this.tableData = [...this.tableData, ...newRows];
      this.lastProcessedLength = hits.length;
      
      // Manual change detection - this preserves table state
      this.cdr.detectChanges();
    }
  }

  private rebuildTableData(): void {
    if (!this.searchInstance?.data) return;
    
    console.log(`[LogViewer] Rebuilding entire table with ${this.searchInstance.data.length} records.`);
    const allRows = this.transformHitsToRows(this.searchInstance.data);
    this.tableData = allRows;
    this.lastProcessedLength = this.searchInstance.data.length;
  }

  private transformHitsToRows(hits: ElkHit[]): any[] {
    return hits.map(hit => {
      const row: any = { _id: hit._id, _original: hit._source };
      this.currentColumns.forEach(col => {
        row[col.name] = get(hit._source, col.field, 'N/A');
      });
      return row;
    });
  }

  // Computed property for filter fields (using getter instead of signal)
  get globalFilterFields(): string[] {
    return this.currentColumns.map(c => c.field);
  }

  // Computed property for visible columns (using getter instead of signal)
  get visibleColumnsForTemplate(): ColumnDefinition[] {
    return this.currentColumns;
  }

  applyGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.logTable.filterGlobal(value, 'contains');
  }
  
  handleRowClick(rowData: any): void {
    const drilldownQuery = rowData._original?.user?.id;
    if (drilldownQuery) {
      this.rowDrilldown.emit(drilldownQuery);
    }
  }
}