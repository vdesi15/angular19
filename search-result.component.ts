import { Component, Input, computed, inject, WritableSignal, signal, Signal, effect, ViewChild, ChangeDetectorRef } from '@angular/core';
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
import { SearchHistoryService } from 'src/app/core/services/search-history.service';
import { FiltersService } from 'src/app/core/services/filters.service';

// Child Components & Modules
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChipModule } from 'primeng/chip';

// Toolbars
import { TransactionToolbarComponent } from '../transaction-toolbar/transaction-toolbar.component';
import { StreamingToolbarComponent } from '../streaming-toolbar/streaming-toolbar.component';
import { BatchToolbarComponent } from '../batch-toolbar/batch-toolbar.component';
import { JiraToolbarComponent } from '../jira-toolbar/jira-toolbar.component';

// Viewers
import { LogViewerComponent } from '../log-viewer/log-viewer.component';
import { BatchViewerComponent } from '../batch-viewer/batch-viewer.component';
import { JiraViewerComponent } from '../jira-viewer/jira-viewer.component';
import { TableSkeletonComponent } from 'src/app/shared/components/table-skeleton/table-skeleton.component';

@Component({
  selector: 'app-search-result',
  standalone: true,
  imports: [
    CommonModule, AccordionModule, ButtonModule, TooltipModule, BadgeModule, 
    ProgressBarModule, ChipModule,
    TransactionToolbarComponent, StreamingToolbarComponent, BatchToolbarComponent, JiraToolbarComponent,
    LogViewerComponent, BatchViewerComponent, JiraViewerComponent, TableSkeletonComponent
  ],
  templateUrl: './search-result.component.html',
  styleUrls: ['./search-result.component.scss']
})
export class SearchResultComponent {
  @Input({ required: true }) search!: ActiveSearch;

  @ViewChild(LogViewerComponent) public logViewer?: LogViewerComponent;
  @ViewChild(BatchViewerComponent) public batchViewer?: BatchViewerComponent;
  @ViewChild(JiraViewerComponent) public jiraViewer?: JiraViewerComponent;

  // State signals
  public isStopButtonHovered = signal(false);
  public totalLoadedCount = 0;
  public filteredCount = 0;

  // Injected Services
  public orchestrator = inject(SearchOrchestratorService);
  private colDefService = inject(ColumnDefinitionService);
  private viewDefService = inject(ViewDefinitionService);
  private searchHistoryService = inject(SearchHistoryService);
  private filtersService = inject(FiltersService);
  private cdr = inject(ChangeDetectorRef);

  // State Signals
  public selectedViewId: WritableSignal<string> = signal('');
  public streamingVisibleColumns: WritableSignal<ColumnDefinition[]> = signal([]);
  public streamFilters: WritableSignal<StreamFilter[]> = signal([]);

  // Derived Signals
  public allColumnsForViewType: Signal<ColumnDefinition[]> = computed(() => {
    const app = this.search.appName;
    const viewType = this.getViewType();
    return this.colDefService.getColumnsFor(app, viewType);
  });
  
  public availableViews: Signal<ViewDefinition[]> = computed(() => {
    return this.viewDefService.getViewsForApp(this.search.appName);
  });

  public finalVisibleColumns: Signal<ColumnDefinition[]> = computed(() => {
    if (this.search.type === 'transaction' || this.search.type === 'jira') {
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

    const searchSignature = this.createSearchSignature();
    return this.searchHistoryService.isFavorite(searchSignature);
  });

  // Computed signal to determine if we should show skeleton
  public showSkeleton = computed(() => {
    return this.search.isLoading && this.search.data.length === 0;
  });

  // Computed signal to determine if we should show the content
  public showContent = computed(() => {
    return !this.showSkeleton() && !this.search.error;
  });

  // Search type-specific computed properties
  public searchTypeIcon = computed(() => {
    switch (this.search.type) {
      case 'transaction': return 'pi pi-sitemap';
      case 'jira': return 'pi pi-ticket';
      case 'batch': return 'pi pi-clone';
      case 'browse': return 'pi pi-list';
      case 'error': return 'pi pi-exclamation-triangle';
      case 'natural': return 'pi pi-comment';
      default: return 'pi pi-search';
    }
  });

  public searchTypeBadge = computed(() => {
    switch (this.search.type) {
      case 'transaction': return { label: 'TXN', severity: 'info' as const };
      case 'jira': return { label: 'JIRA', severity: 'warning' as const };
      case 'batch': return { label: 'BATCH', severity: 'success' as const };
      case 'browse': return { label: 'LIVE', severity: 'info' as const };
      case 'error': return { label: 'ERROR', severity: 'danger' as const };
      case 'natural': return { label: 'AI', severity: 'secondary' as const };
      default: return { label: 'SEARCH', severity: 'secondary' as const };
    }
  });

  public recordsSummary = computed(() => {
    const totalLoaded = this.search.data.length;
    const totalRecords = this.search.totalRecords;
    const filteredCount = this.filteredCount;
    
    if (this.search.isStreaming) {
      let summary = `Loaded: ${totalLoaded.toLocaleString()}`;
      if (totalRecords > totalLoaded) {
        summary += ` of ${totalRecords.toLocaleString()}`;
      }
      if (filteredCount < totalLoaded && filteredCount > 0) {
        summary += ` (Filtered: ${filteredCount.toLocaleString()})`;
      }
      return `(${summary})`;
    } else {
      let summary = `${totalLoaded.toLocaleString()} record${totalLoaded !== 1 ? 's' : ''}`;
      if (filteredCount < totalLoaded && filteredCount > 0) {
        summary += ` (${filteredCount.toLocaleString()} visible)`;
      }
      return `(${summary})`;
    }
  });

  public searchConfidence = computed(() => {
    return this.search.searchMetadata?.confidence || null;
  });

  public searchStrategy = computed(() => {
    return this.search.searchMetadata?.searchStrategy || null;
  });

  public isTransactionSearch = computed(() => {
    return this.search.type === 'transaction';
  });

  public isSSESearch = computed(() => {
    return this.search.type === 'browse' || this.search.type === 'error';
  });

  constructor() {
    effect(() => {
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

  // Helper Methods
  private getViewType(): 'browse' | 'error' {
    switch (this.search.type) {
      case 'transaction':
      case 'jira':
      case 'batch':
      case 'natural':
        return 'browse'; // Use browse columns for these types
      case 'error':
        return 'error';
      case 'browse':
      default:
        return 'browse';
    }
  }

  public updateFilteredCount(count: number): void {
    setTimeout(() => {
      this.filteredCount = count;
      this.cdr.detectChanges();
    }, 0);
  }

  // Event Handlers
  resetStreamingColumns(): void {
    console.log('[SearchResult] resetStreamingColumns called');
    
    const allColumns = this.allColumnsForViewType();
    console.log('[SearchResult] All columns available:', allColumns.length);
    
    const defaultVisible = allColumns.filter(c => c.visible === true);
    console.log('[SearchResult] Default visible columns:', defaultVisible.length);
    
    this.streamingVisibleColumns.set(defaultVisible);
    this.cdr.markForCheck();
    
    console.log('[SearchResult] Columns reset to:', defaultVisible.map(c => c.displayName));
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

  // Search signature for favorites
  private createSearchSignature(): string {
    const globalFilters = this.filtersService.filters();
    if (!globalFilters) return '';

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

    const signatureString = JSON.stringify(signature);
    let hash = 0;
    for (let i = 0; i < signatureString.length; i++) {
      const char = signatureString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  }

  // Utility methods for different search types
  public shouldShowToolbar(): boolean {
    return !this.search.error && !this.showSkeleton();
  }

  public shouldShowStreamingToolbar(): boolean {
    return this.search.type === 'browse' || this.search.type === 'error';
  }

  public shouldShowTransactionToolbar(): boolean {
    return this.search.type === 'transaction' || this.search.type === 'natural';
  }

  public shouldShowJiraToolbar(): boolean {
    return this.search.type === 'jira';
  }

  public shouldShowBatchToolbar(): boolean {
    return this.search.type === 'batch';
  }

  public shouldShowLogViewer(): boolean {
    return this.search.type === 'browse' || 
           this.search.type === 'error' || 
           this.search.type === 'transaction' || 
           this.search.type === 'natural';
  }

  public shouldShowBatchViewer(): boolean {
    return this.search.type === 'batch';
  }

  public shouldShowJiraViewer(): boolean {
    return this.search.type === 'jira';
  }

  public getSearchTypeDescription(): string {
    const confidence = this.searchConfidence();
    const strategy = this.searchStrategy();
    
    switch (this.search.type) {
      case 'transaction':
        return confidence ? `Transaction Search (${Math.round(confidence * 100)}% confidence)` : 'Transaction Search';
      case 'jira':
        return confidence ? `JIRA Ticket Search (${Math.round(confidence * 100)}% confidence)` : 'JIRA Ticket Search';
      case 'batch':
        return confidence ? `Batch Processing (${Math.round(confidence * 100)}% confidence)` : 'Batch Processing';
      case 'browse':
        return 'Live Log Stream';
      case 'error':
        return 'Error Log Stream';
      case 'natural':
        return confidence ? `AI Search (${Math.round(confidence * 100)}% confidence)` : 'AI-Powered Search';
      default:
        return 'Search Results';
    }
  }

  public getProgressValue(): number {
    if (this.search.type === 'batch' && this.search.data.length > 0) {
      // For batch searches, calculate progress from batch details
      const batchData = this.search.data[0]?._source;
      if (batchData?.processedRecords && batchData?.totalRecords) {
        return Math.round((batchData.processedRecords / batchData.totalRecords) * 100);
      }
    }
    
    if (this.search.isStreaming && this.search.totalRecords > 0) {
      return Math.round((this.search.data.length / this.search.totalRecords) * 100);
    }
    
    return this.search.isLoading ? null : 100;
  }

  public getStatusSeverity(): string {
    if (this.search.error) return 'danger';
    if (this.search.isLoading) return 'info';
    if (this.search.isStreaming) return 'success';
    return 'success';
  }

  public getStatusLabel(): string {
    if (this.search.error) return 'Error';
    if (this.search.isLoading) return 'Loading';
    if (this.search.isStreaming) return 'Streaming';
    return 'Completed';
  }

  // Auto-refresh for batch searches
  public toggleAutoRefresh(): void {
    if (this.search.type === 'batch') {
      // Implementation for auto-refresh toggle
      console.log('[SearchResult] Toggle auto-refresh for batch search');
    }
  }

  public setRefreshInterval(interval: number): void {
    if (this.search.type === 'batch') {
      this.orchestrator.updateSearchState(this.search.id, { 
        refreshInterval: interval 
      });
    }
  }
}