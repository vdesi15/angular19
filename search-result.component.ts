import { Component, Input, computed, inject, WritableSignal, signal, Signal, effect, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

// --- Models ---
import { ActiveSearch } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';

// --- Services ---
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';

// --- Child Components & Modules ---
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TransactionToolbarComponent } from './transaction-toolbar/transaction-toolbar.component';
import { StreamingToolbarComponent } from './streaming-toolbar/streaming-toolbar.component';
import { LogViewerComponent } from './log-viewer/log-viewer.component';
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

  // Get a reference to the child LogViewerComponent to access its state if needed
  @ViewChild(LogViewerComponent) public logViewer?: LogViewerComponent;

  public isStopButtonHovered = signal(false);

  // --- Injected Services ---
  public orchestrator = inject(SearchOrchestratorService);
  private colDefService = inject(ColumnDefinitionService);
  private viewDefService = inject(ViewDefinitionService);
  
  // --- STATE SIGNALS managed by this component ---
  public selectedViewId: WritableSignal<string> = signal('');
  public streamingVisibleColumns: WritableSignal<ColumnDefinition[]> = signal([]);
  public streamFilters: WritableSignal<StreamFilter[]> = signal([]);

  // --- DERIVED SIGNALS that get data from services ---
  public allColumnsForViewType: Signal<ColumnDefinition[]> = computed(() => {
    const app = this.search.appName;
    const viewType = this.search.type === 'transaction' ? 'browse' : this.search.type;
    return this.colDefService.getColumnsFor(app, viewType);
  });
  
  public availableViews: Signal<ViewDefinition[]> = computed(() => {
    return this.viewDefService.getViewsForApp(this.search.appName);
  });

  // This computed signal determines the final list of columns to pass to the LogViewer
  public finalVisibleColumns: Signal<ColumnDefinition[]> = computed(() => {
    if (this.search.type === 'transaction') {
      const selectedViewId = this.selectedViewId();
      if (!selectedViewId) return [];
      
      return this.allColumnsForViewType().filter(col => {
        if (!col.views) return true;
        return col.views.split(',').map(v => v.trim()).includes(selectedViewId);
      });
    }
    // For browse/error, use the state managed by the streaming toolbar
    return this.streamingVisibleColumns();
  });

  // This computed signal generates the dynamic text for the accordion header
  public recordsSummary = computed(() => {
    const totalLoaded = this.search.data.length;
    // Check if the LogViewer and its internal table filter state exist
    const filteredCount = this.logViewer?.logTable?.filteredValue?.length ?? totalLoaded;
    
    let summary = '';
    if (this.search.isStreaming) {
      summary = `(Loaded: ${totalLoaded}`;
    } else {
      if (this.search.totalRecords > 0) {
        summary = `(Total: ${this.search.totalRecords}`;
      } else {
        return '';
      }
    }

    if (filteredCount < totalLoaded) {
      summary += ` / Filtered: ${filteredCount}`;
    }

    return summary + ')';
  });

  constructor() {
    // This effect sets the initial state when the component loads
    effect(() => {
      // It depends on the full column list being ready
      const allColumns = this.allColumnsForViewType();
      if (allColumns.length > 0) {
        this.resetStreamingColumns();
      }

      const available = this.availableViews();
      if (available.length > 0) {
        const defaultView = available.find(v => v.default) ?? available[0];
        if (defaultView) {
          this.selectedViewId.set(defaultView.viewId);
        }
      }
    });
  }

  // --- Event Handlers ---

  resetStreamingColumns(): void {
    const defaultVisible = this.allColumnsForViewType().filter(c => c.visible);
    this.streamingVisibleColumns.set(defaultVisible);
  }

  onStreamingColumnsChange(selectedColumns: ColumnDefinition[]): void {
    const masterList = this.allColumnsForViewType();
    const selectedIds = new Set(selectedColumns.map(c => c.id));
    const orderedSelection = masterList.filter(col => selectedIds.has(col.id));
    this.streamingVisibleColumns.set(orderedSelection);
  }
  
  onStreamFiltersChange(filters: StreamFilter[]): void {
    this.streamFilters.set(filters);
    this.orchestrator.applyStreamFilters(this.search.id, filters);
  }

  onDrilldown(query: any): void {
    this.orchestrator.performSearch({
      type: 'transaction',
      query: query,
      title: `Transaction: ${query}`,
      appName: this.search.appName
    });
  }

  stopStreaming(event: MouseEvent): void {
    // Stop the event from propagating to the accordion header, which would toggle it.
    event.stopPropagation();
    this.orchestrator.stopSseStream(this.search.id);
  }

  closePanel(event: MouseEvent): void {
    event.stopPropagation();
    this.orchestrator.closeSearch(this.search.id);
  }
}