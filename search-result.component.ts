import { Component, Input, computed, inject, WritableSignal, signal, Signal, effect, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

// Models
import { ActiveSearch } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';

// Services
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';

// Child Components & Modules
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

  @ViewChild(LogViewerComponent) public logViewer?: LogViewerComponent;

  public isStopButtonHovered = signal(false);
   public totalLoadedCount = 0;
  public filteredCount = 0;

  // Injected Services
  public orchestrator = inject(SearchOrchestratorService);
  private colDefService = inject(ColumnDefinitionService);
  private viewDefService = inject(ViewDefinitionService);
  private cdr = inject(ChangeDetectorRef);

  // State Signals
  public selectedViewId: WritableSignal<string> = signal('');
  public streamingVisibleColumns: WritableSignal<ColumnDefinition[]> = signal([]);
  public streamFilters: WritableSignal<StreamFilter[]> = signal([]);


  // Derived Signals
  public allColumnsForViewType: Signal<ColumnDefinition[]> = computed(() => {
    const app = this.search.appName;
    const viewType = this.search.type === 'transaction' ? 'browse' : this.search.type;
    return this.colDefService.getColumnsFor(app, viewType);
  });
  
  public availableViews: Signal<ViewDefinition[]> = computed(() => {
    return this.viewDefService.getViewsForApp(this.search.appName);
  });

  public finalVisibleColumns: Signal<ColumnDefinition[]> = computed(() => {
    if (this.search.type === 'transaction') {
      const selectedViewId = this.selectedViewId();
      if (!selectedViewId) return [];
      
      return this.allColumnsForViewType().filter(col => {
        if (!col.views) return true;
        return col.views.split(',').map(v => v.trim()).includes(selectedViewId);
      });
    }
    return this.streamingVisibleColumns();
  });  

  public isFavorite = computed(() => {
    const currentGlobalFilters = this.filtersService.filters();
    if (!currentGlobalFilters) return false;

    // Create a search signature to check against favorites
    const searchSignature = this.createSearchSignature();
    return this.searchHistoryService.isFavorite(searchSignature);
  });

  // Computed signal to determine if we should show skeleton
  public showSkeleton = computed(() => {
    return this.search.isLoading && this.search.data.length === 0;
  });

  // Computed signal to determine if we should show the table
  public showTable = computed(() => {
    return !this.showSkeleton() && !this.search.error;
  });

  constructor() {
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

  public updateFilteredCount(count: number): void {
    // ✅ Use setTimeout to defer the update until after change detection cycle
    setTimeout(() => {
      this.filteredCount = count;
      this.cdr.detectChanges();
    }, 0);
  }

  // Event Handlers
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
    event.stopPropagation();
    event.preventDefault();
    this.orchestrator.stopSseStream(this.search.id);
  }

  closePanel(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.orchestrator.closeSearch(this.search.id);
  }

  toggleExpansion(): void {
    this.orchestrator.updateSearchState(this.search.id, { 
      isExpanded: !this.search.isExpanded 
    });
  }

  // Event Handlers for Accordion
  onAccordionOpen(event: any): void {
    console.log('[SearchResult] Accordion opened for:', this.search.title);
    this.orchestrator.updateSearchState(this.search.id, { isExpanded: true });
  }

  onAccordionClose(event: any): void {
    console.log('[SearchResult] Accordion closed for:', this.search.title);
    this.orchestrator.updateSearchState(this.search.id, { isExpanded: false });
  }

  retrySearch(): void {
    console.log(`[SearchResult] Retrying search: ${this.search.title}`);
    this.orchestrator.fetchDataFor(this.search);
  }

  toggleFavorite(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const searchSignature = this.createSearchSignature();
    this.searchHistoryService.toggleFavorite(searchSignature);
  }

  private createSearchSignature(): string {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) return '';

    // Create a consistent signature for this search state
    const signature = {
      type: this.search.type,
      appName: this.search.appName,
      query: this.search.query,
      preFilter: this.search.preFilter,
      globalFilters: {
        application: globalFilters.application,
        environment: globalFilters.environment,
        location: globalFilters.location,
        dateRange: globalFilters.dateRange
      },
      streamFilters: this.search.streamFilters || []
    };

    // Simple hash function for consistent IDs
    const signatureString = JSON.stringify(signature);
    let hash = 0;
    for (let i = 0; i < signatureString.length; i++) {
      const char = signatureString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}