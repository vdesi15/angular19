import { afterNextRender, AfterViewInit, ChangeDetectorRef, Component, computed, effect, ElementRef, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, signal, Signal, SimpleChanges, ViewChild, WritableSignal } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';
import { Table, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TransformPipe } from '../../../core/pipes/transform.pipe';
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from '../../models/column-definition.model';
import { ViewDefinitionService } from '../../services/view-definition.service';
import { FilterService } from 'primeng/api';
import { CellClickActionService } from '../../services/cell-click-action.service';
import { DynamicRowsService } from '../../services/dynamic-rows.service';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, InputTextModule,
    IconFieldModule, InputIconModule
],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss'],
  providers: [TransformPipe]
})
export class LogViewerComponent implements OnChanges{
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Input() selectedViewFilter?: string; // Applies only to transaction details searches.
  @Input() selectedViewId?: string;
  @Output() rowDrilldown = new EventEmitter<any>();
  @Output() filteredCountChange = new EventEmitter<number>();

  @ViewChild('logTable') logTable!: Table;
  @ViewChild('tableContainer', { static: true }) tableContainer!: ElementRef;

  private searchState: WritableSignal<ActiveSearch> = signal(this.searchInstance);
  public visibleColumnsState: WritableSignal<ColumnDefinition[]> = signal([]);

  public tableData: any[] = [];
  public totalRecords: number = 0;
  public isLoading: boolean = false;
  public dynamicRows = signal<number>(20);

  private cdr = inject(ChangeDetectorRef);
  private transformPipe = inject(TransformPipe);
  private viewService = inject(ViewDefinitionService);
  private cellClickActionService = inject(CellClickActionService);
  private dynamicRowsService = inject(DynamicRowsService);

  constructor() {
    console.log("LogViewerComponent created.");
    afterNextRender(() => {
      this.setupResizeObserver();
    });
  }

  private setupResizeObserver(): void {
    if (!this.tableContainer?.nativeElement) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        this.dynamicRowsService.updateContainerHeight(height);
      }
    });

    resizeObserver.observe(this.tableContainer.nativeElement);
  }

  private rowsEffect = effect(() => {
    const rows = this.dynamicRowsService.optimalRowsPerPage();
    this.dynamicRows.set(rows);
  });


  /**
   * Public method called by the parent to reset column visibility.
   */
  public resetColumnsToDefault(): void {
    // Filter the available columns to only those marked as `visible: true` by the API.
    const defaultVisible = this.visibleColumnsState().filter(c => c.visible);
    this.visibleColumnsState.set(defaultVisible);
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

  /**
   * Check if a cell should be clickable (contains identifier)
   */
  public isCellClickable(column: ColumnDefinition, rowData: any): boolean {
    // Make certain fields clickable for drilldown
    const clickableFields = ['_source.tifw.txnid', '_source.message', '_source.timestamp', `_source['@timestamp']`];

    return clickableFields.includes(column.field);
  }

  /**
   * Handle cell-specific clicks
   */
  public handleCellClick(columnDef: ColumnDefinition, rowData: any, event: Event, cellValue: any): void {
    if (this.isCellClickable(columnDef, rowData)) {
      event.stopPropagation();
      this.cellClickActionService.handleCellClick({
        columnDef: columnDef,
        rowData: rowData,
        cellValue: cellValue,
        transactionDetails: this.searchInstance.transactionDetails,
        activeSearch: this.searchInstance
      });
    }
  }

  /**
   * Get cell value with support for nested properties
   */
  public getCellValue(rowData: any, fieldPath: string): any {
    if (!rowData || !fieldPath) return null;

    const keys = fieldPath.split('.');
    let value = get(rowData._original, fieldPath, '');
    return value;
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

      // 🔥 FIX 1: Only process selectedViewId changes that are NOT first change
      if (changes['selectedViewId'] && !changes['selectedViewId'].firstChange) {
        console.log(`[LogViewer] View filter changed, reprocessing data. New View Filter : `, this.selectedViewFilter);
        this.reProcessCurrentData();
        return; // Early return to prevent duplicate processing
      }

      const newHits = this.getNewHits(currentSearch, previousSearch);

      if (newHits.length > 0) {
        const processedNewRows = this.processHits(newHits);
        this.tableData.push(...processedNewRows);
        this.totalRecords = this.tableData.length;
        this.cdr.detectChanges();
        console.log(`[LogViewer] Appended ${processedNewRows.length} rows. Total now: ${this.tableData.length}`);
      }
    }

    // 🔥 FIX 1: Handle view filter changes separately to prevent duplication
    if (this.isViewChanged(changes)) {
      console.log('[LogViewer] View has changed. Reprocessing data and resetting paginator.');
      this.reProcessCurrentData();
    }
  }

  /**
     * Helper function to detect if the view filter has actually changed.
     */
  private isViewChanged(changes: SimpleChanges): boolean {
    const viewFilterChange = changes['selectedViewFilter'];
    if (viewFilterChange && !viewFilterChange.firstChange && viewFilterChange.currentValue !== viewFilterChange.previousValue) {
      return true;
    }
    // You can add other view-related inputs here if needed
    // const viewIdChange = changes['selectedViewId'];
    // if (viewIdChange && !viewIdChange.firstChange && ...) return true;

    return false;
  }

  // 🔥 FIX 1: Enhanced reprocessing method
  public reProcessCurrentData(): void {
    if (this.searchInstance.data.length > 0) {
      console.log('[LogViewer] Reprocessing current data with view filter:', this.selectedViewFilter);
      this.tableData = this.processHits(this.searchInstance.data);
      this.totalRecords = this.tableData.length;
      this.cdr.detectChanges();

      // Reset table to first page when reprocessing
      if (this.logTable) {
        this.logTable.first = 0;
      }
    }
  }

  // 🔥 FIX 2: Dynamic rows calculation based on container height
  public getOptimalRowsPerPage(): number {
    if (!this.tableContainer?.nativeElement) return 20;

    const containerHeight = this.tableContainer.nativeElement.offsetHeight;
    const headerHeight = 80; // Approximate header + filter height
    const paginatorHeight = 50; // Paginator height
    const rowHeight = 35; // Approximate row height

    const availableHeight = containerHeight - headerHeight - paginatorHeight;
    const calculatedRows = Math.floor(availableHeight / rowHeight);

    // Ensure reasonable bounds
    return Math.max(10, Math.min(50, calculatedRows));
  }

  // 🔥 FIX: Helper methods for template
  public getPaginatorEndRange(): number {
    const start = (this.logTable?.first || 0);
    const rows = (this.logTable?.rows || 20);
    const end = start + rows;
    return end > this.totalRecords ? this.totalRecords : end;
  }

  public getPaginatorStartRange(): number {
    return (this.logTable?.first || 0) + 1;
  }

  /**
   * Called when the user uses the filter bar.
   */
  public onFilter(): void {
    // This gets called by PrimeNG whenever any filtering occurs
    /*
    setTimeout(() => {
      const filteredCount = this.logTable?.filteredValue?.length ?? this.tableData.length;
      console.log(`[LogViewer] Filter applied, new count: ${filteredCount}`);
      this.filteredCountChange.emit(filteredCount);
    }, 200);
    */
  }

  /**
   * Load the newly streamed hits.
   */
  private getNewHits(current: ActiveSearch, previous: ActiveSearch | undefined): ElkHit[] {
    const currentData = current?.data ?? [];
    if (!previous) { return currentData; }
    const previousLength = previous.data?.length ?? 0;
    if (currentData.length <= previousLength) { return []; }
    return currentData.slice(previousLength);
  }

  /**
   * This takes in the incoming ELK hits and applies transform on them.
   * @param hits ELK hits
   * @returns Processed ELK hits
   */
  private processHits(hits: ElkHit[]): any[] {
    const columns = this.visibleColumns;

    let filteredHits = hits;
    if (this.searchInstance.type === 'transaction' && this.selectedViewFilter) {
      filteredHits = this.viewService.filterByViews(hits, this.selectedViewFilter);
      this.filteredCountChange.emit(filteredHits.length);
    }
    else if (this.searchInstance.type === 'jira' && this.selectedViewFilter) {
      filteredHits = this.viewService.filterByViews(hits, this.selectedViewFilter);
      this.filteredCountChange.emit(filteredHits.length);
    }

    return filteredHits.map(hit => {
      const row: any = { _id: hit._id, _original: hit };
      columns.forEach(col => {
        const rawValue = get(hit, col.field, '');
        row[col.id] = rawValue;
        const transformedValue = this.transformPipe.transform(rawValue, col.transform, hit);
        const filterFieldName = `${col.id}_filter`;
        row[filterFieldName] = String(transformedValue);
      });
      return row;
    });
  }

  /**
   * Return the value of each cell.
   * @param rowData ELK Row data
   * @param col Current Column
   * @returns value of the cell
   */
  getCellDisplayValue(rowData: any, col: ColumnDefinition): string {
    return rowData[col.id + '_filter'];
  }
}     
