Part 1: The StreamingToolbarComponent and its Logic
This component is used for the Browse/Error views.
streaming-toolbar.component.ts
(This component is simple, it just receives data and emits events)
Generated typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';

@Component({
  selector: 'app-streaming-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolbarModule, ButtonModule, MultiSelectModule],
  template: `
    <p-toolbar>
      <div class="p-toolbar-group-left">
        <p-multiSelect 
          [options]="allAvailableColumns" 
          [ngModel]="currentlyVisibleColumns"
          (ngModelChange)="visibleColumnsChange.emit($event)"
          optionLabel="displayName" 
          placeholder="Select Columns" 
          selectedItemsLabel="{0} columns selected"
          styleClass="w-full md:w-20rem"
          [filter]="true">
        </p-multiSelect>
        <button pButton type="button" label="Reset Columns" icon="pi pi-replay" class="p-button-text ml-2" (click)="reset.emit()"></button>
      </div>
      <div class="p-toolbar-group-right">
        <button pButton type="button" label="Add Filter" icon="pi pi-filter-plus" class="p-button-outlined"></button>
      </div>
    </p-toolbar>
  `
})
export class StreamingToolbarComponent {
  // Receives the full list of columns that CAN be selected.
  @Input() allAvailableColumns: ColumnDefinition[] = [];
  // Receives the list of columns that ARE CURRENTLY selected.
  @Input() currentlyVisibleColumns: ColumnDefinition[] = [];
  
  // Emits the new, complete list of selected columns when the user makes a change.
  @Output() visibleColumnsChange = new EventEmitter<ColumnDefinition[]>();
  @Output() reset = new EventEmitter<void>();
}
Use code with caution.
TypeScript
Part 2: The TransactionToolbarComponent
This component is used for the Transaction Detail view.
transaction-toolbar.component.ts
Generated typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
// ... other imports for toolbar, dropdown, etc.
import { ViewDefinition } from 'src/app/core/models/view-definition.model';

@Component({
  selector: 'app-transaction-toolbar',
  standalone: true,
  imports: [/* ... */],
  template: `
    <p-toolbar>
      <div class="p-toolbar-group-left">
        <p-dropdown [options]="availableViews" [(ngModel)]="selectedViewId" (ngModelChange)="viewChange.emit($event)"
          optionLabel="displayName" optionValue="viewId" placeholder="Select View"></p-dropdown>
      </div>
      <div class="p-toolbar-group-right">
        <!-- Share, Download, Metrics buttons -->
      </div>
    </p-toolbar>
  `
})
export class TransactionToolbarComponent {
  @Input() availableViews: ViewDefinition[] = [];
  @Input() selectedViewId!: string;
  @Output() viewChange = new EventEmitter<string>();
}
Use code with caution.
TypeScript
Part 3: SearchResultComponent - The Orchestrator
This is where all the logic is correctly implemented. It will manage two different sets of visible columns based on the search type.
search-result.component.ts (Definitive Final Version)
Generated typescript
import { Component, Input, computed, inject, WritableSignal, signal, Signal, effect } from '@angular/core';
// ... other imports
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';

@Component({
  selector: 'app-search-result',
  // ...
})
export class SearchResultComponent {
  @Input({ required: true }) search!: ActiveSearch;

  private colDefService = inject(ColumnDefinitionService);
  private viewDefService = inject(ViewDefinitionService);
  // ... other injections

  // --- State Signals ---
  public selectedViewId: WritableSignal<string> = signal('');
  public streamingVisibleColumns: WritableSignal<ColumnDefinition[]> = signal([]);

  // --- Computed signals to get data from services ---
  public allColumnsForViewType = computed(() => /* ... as before ... */);
  public availableViews = computed(() => /* ... as before ... */);

  // ✨ THIS IS THE KEY: A single computed signal that determines which columns to display ✨
  // It intelligently switches based on the search type.
  public finalVisibleColumns: Signal<ColumnDefinition[]> = computed(() => {
    // If it's a transaction search, filter the columns by the selected view.
    if (this.search.type === 'transaction') {
      const selectedViewId = this.selectedViewId();
      if (!selectedViewId) return []; // Or return a default set
      
      return this.allColumnsForViewType().filter(col => {
        if (!col.views) return true; // Universal column
        return col.views.split(',').map(v => v.trim()).includes(selectedViewId);
      });
    }
    
    // Otherwise (for browse/error), return the state from our multiselect.
    return this.streamingVisibleColumns();
  });

  constructor() {
    // This effect sets the initial state when the component loads.
    effect(() => {
      // It depends on the full column list being ready.
      const allColumns = this.allColumnsForViewType();
      if (allColumns.length > 0) {
        // For streaming views, set the default visible columns for the multiselect.
        if (this.search.type === 'browse' || this.search.type === 'error') {
          this.resetStreamingColumns();
        }
        
        // For transaction views, set the default view ID.
        if (this.search.type === 'transaction') {
          const available = this.availableViews();
          const defaultView = available.find(v => v.default) ?? available[0];
          if (defaultView) this.selectedViewId.set(defaultView.viewId);
        }
      }
    });
  }

  /**
   * Resets the columns for the streaming view to the API default.
   */
  resetStreamingColumns(): void {
    const defaultVisible = this.allColumnsForViewType().filter(c => c.visible);
    this.streamingVisibleColumns.set(defaultVisible);
  }

  /**
   * ✨ This new method handles changes from the StreamingToolbar's multiselect
   * and preserves the original column order.
   */
  onStreamingColumnsChange(selectedColumns: ColumnDefinition[]): void {
    const masterList = this.allColumnsForViewType();
    const selectedIds = new Set(selectedColumns.map(c => c.id));
    const orderedSelection = masterList.filter(col => selectedIds.has(col.id));
    this.streamingVisibleColumns.set(orderedSelection);
  }
  
  // ... other methods (onDrilldown, closePanel, etc.)
}
Use code with caution.
TypeScript
search-result.component.html
The template now correctly binds properties for each toolbar scenario.
Generated html
<p-accordion-panel>
  <p-accordion-header> ... </p-accordion-header>
  <p-accordion-content>
    @if(search.type === 'transaction') {
      <app-transaction-toolbar 
        [availableViews]="availableViews()" 
        [selectedViewId]="selectedViewId()"
        (viewChange)="selectedViewId.set($event)">
      </app-transaction-toolbar>
    } @else {
      <app-streaming-toolbar
        [allAvailableColumns]="allColumnsForViewType()"
        [currentlyVisibleColumns]="streamingVisibleColumns()"
        (visibleColumnsChange)="onStreamingColumnsChange($event)"
        (reset)="resetStreamingColumns()">
      </app-streaming-toolbar>
    }
    
    <div class="result-content-wrapper">
      @if (/* ... loading/error ... */) {
        <!-- ... -->
      } @else {
        <app-log-viewer #logViewer
          [searchInstance]="search"
          <!-- ✨ The LogViewer always gets its columns from the final computed signal ✨ -->
          [visibleColumns]="finalVisibleColumns()"
          (rowDrilldown)="onDrilldown($event)">
        </app-log-viewer>
      }
    </div>
  </p-accordion-content>
</p-accordion-panel>
Use code with caution.
Html
Part 4: LogViewerComponent (Simplified)
This component is now much "dumber" and cleaner. It has no knowledge of views or column visibility logic. It just receives a list of columns to render.
log-viewer.component.ts
Generated typescript
@Component({
  selector: 'app-log-viewer',
  // ...
})
export class LogViewerComponent {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  // ✨ It just receives the final, ordered list of columns to display. ✨
  @Input({ required: true }) visibleColumns: ColumnDefinition[] = [];
  @Output() rowDrilldown = new EventEmitter<any>();

  // This component NO LONGER needs `allColumnsForViewType` or `viewId`.
  // It NO LONGER needs `visibleColumns` to be a WritableSignal.
  // It NO LONGER needs `availableColumnsForView`, `resetColumnsToDefault`, or `ngOnChanges`.

  // The `tableData` computed signal and event handlers remain the same.
  public tableData: Signal<any[]> = computed(() => {
    const columns = this.visibleColumns; // Use the simple input array directly
    // ...
  });
}
Use code with cautio