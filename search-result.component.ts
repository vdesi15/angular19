import { Component, Input, computed, inject, WritableSignal, signal, Signal, effect, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

// --- Models ---
import { ActiveSearch } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';

// --- Services ---
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';

// --- Child Components & Modules ---
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TransactionToolbarComponent } from '../transaction-toolbar/transaction-toolbar.component';
import { StreamingToolbarComponent } from '../streaming-toolbar/streaming-toolbar.component';
import { LogViewerComponent } from '../log-viewer/log-viewer.component';
import { TableSkeletonComponent } from 'src/app/shared/components/table-skeleton/table-skeleton.component';

@Component({
  selector: 'app-search-result',
  standalone: true,
  imports: [
    CommonModule, AccordionModule, ButtonModule, TooltipModule,
    TransactionToolbarComponent, StreamingToolbarComponent, LogViewerComponent, TableSkeletonComponent
  ],
  templateUrl: './search-result.component.html',
  styleUrls: ['./search-result.component.scss']
})
export class SearchResultComponent {
  @Input({ required: true }) search!: ActiveSearch;

  // Make the orchestrator public so the template can call its methods
  public orchestrator = inject(SearchOrchestratorService);
  private colDefService = inject(ColumnDefinitionService);
  private viewDefService = inject(ViewDefinitionService);
  
  // --- STATE SIGNALS managed by this component ---
  public selectedViewId: WritableSignal<string> = signal('');
  public visibleColumns: WritableSignal<ColumnDefinition[]> = signal([]);

  // --- DERIVED SIGNALS that get data from services ---
  public allColumnsForViewType: Signal<ColumnDefinition[]> = computed(() => {
    const app = this.search.appName;
    const viewType = this.search.type === 'transaction' ? 'browse' : this.search.type;
    return this.colDefService.getColumnsFor(app, viewType);
  });
  
  public availableViews: Signal<ViewDefinition[]> = computed(() => {
    return this.viewDefService.getViewsForApp(this.search.appName);
  });

  // This computed signal generates the dynamic text for the accordion header.
  public recordsSummary = computed(() => {
    const total = this.search.totalRecords;
    if (total === 0 && !this.search.isStreaming) return '';

    // In a real table, you might get a filtered count. For now, we use total.
    const displayedCount = this.search.data.length;

    if (this.search.isStreaming) {
      return `(Loaded: ${displayedCount})`;
    }
    return `(Total Records: ${total})`;
  });

  constructor() {
    // This effect correctly sets the initial state for columns and views.
    // It runs whenever the component is created or when `allColumnsForViewType` changes.
    effect(() => {
      const allColumns = this.allColumnsForViewType();
      if (allColumns.length > 0) {
        // This sets the default columns for the streaming toolbar's multiselect
        this.resetStreamingColumns();
      }

      const available = this.availableViews();
      if (available.length > 0) {
        // This sets the default view for the transaction toolbar's dropdown
        const defaultView = available.find(v => v.default) ?? available[0];
        if (defaultView) {
          this.selectedViewId.set(defaultView.viewId);
        }
      }
    });
  }

  /**
   * This is the single source of truth for resetting column visibility.
   * It's called by the effect above and by the toolbar's reset button.
   */
  resetStreamingColumns(): void {
    const defaultVisible = this.allColumnsForViewType().filter(c => c.visible);
    this.visibleColumns.set(defaultVisible);
  }

  /**
   * This method handles changes from the StreamingToolbar's multiselect
   * and preserves the original column order.
   */
  onStreamingColumnsChange(selectedColumns: ColumnDefinition[]): void {
    const masterList = this.allColumnsForViewType();
    const selectedIds = new Set(selectedColumns.map(c => c.id));
    const orderedSelection = masterList.filter(col => selectedIds.has(col.id));
    this.visibleColumns.set(orderedSelection);
  }

  /**
    * Called when a row is clicked in the LogViewerComponent for drill-down.
    */
  onDrilldown(query: any): void {
    this.orchestrator.performSearch({
      type: 'transaction',
      query: query,
      title: `Transaction: ${query}`,
      appName: this.search.appName
    });
  }

  /**
   * Toggles the expanded/collapsed state of this accordion panel.
   */
  toggleExpansion(): void {
    this.orchestrator.updateSearchState(this.search.id, {
      isExpanded: !this.search.isExpanded
    });
  }
}