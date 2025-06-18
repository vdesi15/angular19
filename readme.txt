Excellent. These are the final, critical polishing steps that will transform your data grid from functional to professional. We will address every single one of these UI/UX and logic issues.
The Strategy
Table Sizing: We'll use PrimeNG's [scrollable]="true" and scrollHeight="flex" properties, combined with specific CSS on the parent containers, to make the table fill the available vertical space.
Compact Density: PrimeNG tables have a size property. We'll set it to "small" to reduce padding everywhere.
Accordion Sizing: We will use CSS to override the default padding on the accordion header and content to make it more compact.
Global Filter: We will simply remove the pTemplate="caption" from the LogViewerComponent's HTML to get rid of the global filter input.
Column Filter Bug: This is a classic bug when using [(ngModel)] inside a loop. The solution is to use PrimeNG's built-in p-columnFilter filtering mechanism, which manages its own state correctly.
Advanced Skeleton: We will refactor the skeleton logic. The SearchResultComponent will render the table header immediately and will only show the row skeleton inside the table's body while loading.
Dynamic Accordion Header: We'll create a new computed signal in the SearchResultComponent to generate the dynamic record count text and display it in the accordion header.
Part 1: LogViewerComponent - The Power Grid
This component will see the most significant changes to implement the advanced table features.
log-viewer.component.ts
Generated typescript
import { Component, computed, EventEmitter, inject, Input, Output, Signal, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';

// PrimeNG Modules
import { Table, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ColumnFilterModule } from 'primeng/columnfilter';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge'; // For styling

// App Components & Services
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { TransformPipe } from 'src/app/core/pipes/transform.pipe';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, JsonPipe, TableModule, InputTextModule, 
    ColumnFilterModule, TooltipModule, BadgeModule, TransformPipe
  ],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss']
})
export class LogViewerComponent implements OnChanges {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) allColumnsForViewType: ColumnDefinition[] = [];
  @Input({ required:true }) viewId!: string;
  @Output() rowDrilldown = new EventEmitter<any>();

  @ViewChild('logTable') logTable!: Table;
  private viewDefService = inject(ViewDefinitionService);
  
  // --- No longer need global filter signal ---

  // `visibleColumns` state management is removed from here and managed in the parent.
  @Input() visibleColumns: ColumnDefinition[] = [];

  // This computed signal flattens the raw ELK data. The table will handle filtering.
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

  // No ngOnChanges needed for this simplified version
  ngOnChanges(changes: SimpleChanges) {}
  
  handleRowClick(rowData: any) {
    const drilldownQuery = rowData._original?.user?.id;
    if (drilldownQuery) {
      this.rowDrilldown.emit(drilldownQuery);
    }
  }
}
Use code with caution.
TypeScript
log-viewer.component.html (The Advanced Table)
This template now uses p-columnFilter for per-column filtering and removes the global caption filter.
Generated html
<!-- 
  ✨ FIX 1 & 2: `scrollHeight="flex"` and `size="small"` for a compact, flexible table.
-->
<p-table #logTable 
  [value]="tableData()" 
  [columns]="visibleColumns" 
  dataKey="_id"
  [paginator]="true" 
  [rows]="50" 
  [rowsPerPageOptions]="[25, 50, 100, 250]"
  [scrollable]="true" 
  scrollHeight="flex"
  [resizableColumns]="true" 
  columnResizeMode="expand"
  [tableStyle]="{'min-width': '50rem'}"
  styleClass="p-datatable-striped p-datatable-sm"> <!-- p-datatable-sm for small size -->

  <!-- ✨ FIX 4: The entire `pTemplate="caption"` is removed. -->

  <ng-template pTemplate="header" let-columns>
    <!-- Row 1: Column Display Names -->
    <tr>
      @for(col of columns; track col.id) {
        <th pResizableColumn [style.width]="col.width">
          {{ col.displayName }}
        </th>
      }
    </tr>
    <!-- Row 2: Per-Column Filter Inputs -->
    <tr>
      @for(col of columns; track col.id) {
        <th>
          <!-- ✨ FIX 5: Use p-columnFilter for robust, isolated filtering -->
          @if(col.enableFiltering) {
            <p-columnFilter [field]="col.name" matchMode="contains" [showMenu]="false">
              <ng-template pTemplate="filter" let-value let-filter="filterCallback">
                <!-- Each filter has its own ngModel, preventing the bug -->
                <input type="text" pInputText [ngModel]="value" (ngModelChange)="filter($event)" class="p-inputtext-sm">
              </ng-template>
            </p-columnFilter>
          }
        </th>
      }
    </tr>
  </ng-template>

  <ng-template pTemplate="body" let-rowData let-columns="columns">
    <tr (click)="handleRowClick(rowData)" class="p-selectable-row">
      @for(col of columns; track col.id) {
        <td>
          <span class="p-column-title">{{ col.displayName }}</span>
          {{ rowData[col.name] | transform:col.transform:rowData._original }}
        </td>
      }
    </tr>
  </ng-template>
  
  <ng-template pTemplate="emptymessage" let-columns>
    <tr><td [attr.colspan]="columns.length" class="text-center p-4">No records found.</td></tr>
  </ng-template>
</p-table>
Use code with caution.
Html
log-viewer.component.scss
This ensures the host container can flex correctly.
Generated scss
:host {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0;
}

// Ensure the table component itself fills the host
::ng-deep .p-datatable {
  height: 100%;
  display: flex;
  flex-direction: column;

  .p-datatable-wrapper {
    flex-grow: 1;
  }
}
Use code with caution.
Scss
Part 2: SearchResultComponent - The Smart Host
This component now handles the advanced skeleton loading and the dynamic accordion header.
search-result.component.ts
Generated typescript
// ... imports
import { Table } from 'primeng/table'; // Import Table for ViewChild type

@Component({
  selector: 'app-search-result',
  // ...
})
export class SearchResultComponent {
  @Input({ required: true }) search!: ActiveSearch;
  
  // Keep the reference to the LogViewer to access its state
  @ViewChild(LogViewerComponent) private logViewer?: LogViewerComponent;
  
  // ... other injections and computed signals (allColumnsForViewType, availableViews) ...
  
  public selectedViewId: WritableSignal<string> = signal('');
  public visibleColumns: WritableSignal<ColumnDefinition[]> = signal([]);

  // ✨ FIX 7: Computed signal for the dynamic accordion header text ✨
  public recordsSummary = computed(() => {
    const total = this.search.totalRecords;
    // Get the filtered count from the table's state, if it exists
    const filteredCount = this.logViewer?.logTable.totalRecords ?? total;
    
    if (total === 0) return '';
    if (filteredCount < total) {
      return `(Filtered: ${filteredCount} / Total: ${total})`;
    }
    return `(Total Records: ${total})`;
  });

  constructor() {
    effect(() => {
      const available = this.availableViews();
      if (available.length > 0) {
        const defaultView = available.find(v => v.default) ?? available[0];
        this.selectedViewId.set(defaultView.viewId);
      }
    });

    effect(() => {
      this.resetColumnsToDefault();
    });
  }

  resetColumnsToDefault(): void {
    const available = this.availableColumnsForViewType();
    const defaultVisible = available.filter(c => c.visible);
    this.visibleColumns.set(defaultVisible);
  }

  // ... other methods (onDrilldown, closePanel, etc.)
}
Use code with caution.
TypeScript
search-result.component.html
This template now implements the advanced skeleton loading pattern.
Generated html
<p-accordion [multiple]="true" [activeIndex]="search.isExpanded ? 0 : -1" styleClass="result-accordion compact">
  <p-accordion-panel>
    <p-accordion-header>
      <div class="accordion-header">
        <div class="header-left">
          <span class="font-bold text-lg mr-3">{{ search.title }}</span>
          <!-- ✨ FIX 7: Use the new computed signal for the summary ✨ -->
          <span class="text-sm text-color-secondary ml-2">{{ recordsSummary() }}</span>
        </div>
        <div class="header-right">
          @if(search.isStreaming) {
            <!-- ... stop button ... -->
          }
          <!-- ... close button ... -->
        </div>
      </div>
    </p-accordion-header>
    <p-accordion-content>
      <!-- ... Toolbars ... -->
      
      <!-- ✨ FIX 6: Advanced Skeleton Logic ✨ -->
      <div class="result-content-wrapper">
        @if (search.isLoading && search.data.length === 0) {
          <!-- Pass the resolved columns to the skeleton -->
          <app-table-skeleton [columns]="allColumnsForViewType()"></app-table-skeleton>
        } @else {
          <app-log-viewer 
            [searchInstance]="search"
            [allColumnsForViewType]="allColumnsForViewType()" 
            [viewId]="selectedViewId()"
            [visibleColumns]="visibleColumns()"
            (rowDrilldown)="onDrilldown($event)">
          </app-log-viewer>
        }
      </div>
    </p-accordion-content>
  </p-accordion-panel>
</p-accordion>
Use code with caution.
Html
search-result.component.scss
We add a class for compact styling.
Generated scss
// ✨ FIX 3: Compact accordion styles ✨
:host ::ng-deep .result-accordion.compact {
  .p-accordion-header-link {
    padding: 0.5rem 1rem !important; // Reduce header padding
  }
  .p-accordion-content {
    padding: 0; // Remove content padding so the table/toolbar can be edge-to-edge
  }
}

// ... other styles
.result-content-wrapper {
  height: 65vh;
  display: flex;
  flex-direction: column;
}