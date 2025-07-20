// Clean search-result.component.ts - Remove skeleton/showSkeleton references

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

// Child Components & Modules
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';

// Toolbars
import { TransactionToolbarComponent } from '../transaction-toolbar/transaction-toolbar.component';
import { StreamingToolbarComponent } from '../streaming-toolbar/streaming-toolbar.component';
import { BatchToolbarComponent } from '../batch-toolbar/batch-toolbar.component';
import { JiraToolbarComponent } from '../jira-toolbar/jira-toolbar.component';

// Viewers
import { LogViewerComponent } from '../log-viewer/log-viewer.component';
import { BatchViewerComponent } from '../batch-viewer/batch-viewer.component';
import { JiraViewerComponent } from '../jira-viewer/jira-viewer.component';
import { TransactionTimelineComponent } from '../transaction-timeline/transaction-timeline.component';
import { TableSkeletonComponent } from 'src/app/shared/components/table-skeleton/table-skeleton.component';
import { accordionAnimations } from '../animations/accordion.animations';

@Component({
  selector: 'app-search-result',
  standalone: true,
  animations: [
    accordionAnimations.slideToggle,
    accordionAnimations.iconRotate,
    accordionAnimations.fadeInContent
  ],
  imports: [
    CommonModule, AccordionModule, ButtonModule, TooltipModule, BadgeModule, 
    ProgressBarModule, ChipModule, TagModule,
    TransactionToolbarComponent, StreamingToolbarComponent, BatchToolbarComponent, JiraToolbarComponent,
    LogViewerComponent, BatchViewerComponent, JiraViewerComponent, TransactionTimelineComponent, 
    TableSkeletonComponent
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
  private internalIsExpanded = signal<boolean>(false);
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

  // Computed signals for transaction details
  public hasTransactionDetails = computed(() => {
    return this.search.type === 'transaction' && 
           this.search.transactionDetails && 
           this.search.transactionDetails.TRANSACTION_TIMELINE?.length > 0;
  });

  // Derived Signals
  public allColumnsForViewType: Signal<ColumnDefinition[]> = computed(() => {
    const activeSearchs = this.orchestrator.activeSearches()
    if(!this.search) return [];
    const app = this.search.appName;
    const viewType = this.getViewType();
    return this.colDefService.getColumnsFor(app, viewType);
  });
  
  public availableViews: Signal<ViewDefinition[]> = computed(() => {
    const activeSearchs = this.orchestrator.activeSearches()
    if(!this.search) return [];
    return this.viewDefService.getViewsForApp(this.search.appName);
  });

  public accordionActiveIndex = computed(() => {
    const activeSearchs = this.orchestrator.activeSearches()
    if(!this.search) return [];
    const expanded = this.search?.isExpanded ?? false;
    return expanded ? [0] : [];
  });

  public finalVisibleColumns: Signal<ColumnDefinition[]> = computed(() => {
  if (this.search.type === 'transaction' || this.search.type === 'jira') {
    const available = this.availableViews();
    const selected = this.selectedViewId();
    
    // If no view is selected, or selected view doesn't exist, use first available
    let viewIdToUse = selected;
    if (!viewIdToUse || !available.find(v => v.viewId === viewIdToUse)) {
      viewIdToUse = available.length > 0 ? available[0].viewId : '';
    }
    
    if (!viewIdToUse) return [];
    
    return this.allColumnsForViewType().filter(col => {
      if (!col.views) return true;
      return col.views.split(',').map(v => v.trim()).includes(viewIdToUse);
    });
  }
    return this.streamingVisibleColumns();
  });

  public filteredCount = 0;
  public totalLoadedCount = 0;

  public updateFilteredCount(count: number): void {
    console.log('🔥 updateFilteredCount:', count);
    this.filteredCount = count;
    this.updateRecordsSummary(); // Force update
  }

  // 🔥 SIMPLE: Regular method that updates when needed
  public updateRecordsSummary(): void {
    if (!this.search) {
      this.recordsSummaryText = '';
      return;
    }

    this.totalLoadedCount = this.search.data.length;
    const totalRecords = this.search.totalRecords;
    
    console.log('🔥 updateRecordsSummary:', {
      totalLoaded: this.totalLoadedCount,
      filteredCount: this.filteredCount
    });
    
    if (this.search.isStreaming) {
      let summary = `Loaded: ${this.totalLoadedCount.toLocaleString()}`;
      if (totalRecords > this.totalLoadedCount) {
        summary += ` of ${totalRecords.toLocaleString()}`;
      }
      if (this.filteredCount < this.totalLoadedCount && this.filteredCount > 0) {
        summary += ` (Filtered: ${this.filteredCount.toLocaleString()})`;
      }
      this.recordsSummaryText = `(${summary})`;
    } else {
      let summary = `${this.totalLoadedCount.toLocaleString()} record${this.totalLoadedCount !== 1 ? 's' : ''}`;
      if (this.filteredCount < this.totalLoadedCount && this.filteredCount > 0) {
        summary += ` (${this.filteredCount.toLocaleString()} visible)`;
      }
      this.recordsSummaryText = `(${summary})`;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['search']) {
      this.updateRecordsSummary();
    }
  }

  ngOnInit(): void {
    this.updateRecordsSummary();
  }

  // 🔥 SIMPLE: Just a string property
  public recordsSummaryText = '';

  constructor() {
    effect(() => {
      const allColumns = this.allColumnsForViewType();
      if (allColumns.length > 0) {
        this.resetStreamingColumns();
      }

      // For transaction/jira searches, always default to first available view
    if (this.search.type === 'transaction' || this.search.type === 'jira') {
      const available = this.availableViews();
      if (available.length > 0) {
        const currentSelected = this.selectedViewId();
        
        // If nothing selected or selected view doesn't exist, pick first one
        if (!currentSelected || !available.find(v => v.viewId === currentSelected)) {
          console.log('[SearchResult] Auto-selecting first view:', available[0].viewId);
          this.selectedViewId.set(available[0].viewId);
        }
      }
    }
    });

    effect(() => {
      const searchExpanded = this.search?.isExpanded ?? false;
      const internalExpanded = this.internalIsExpanded();
      
      // Only update if there's a mismatch
      if (searchExpanded !== internalExpanded) {
        this.internalIsExpanded.set(searchExpanded);
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
  
  // Event Handlers
  resetStreamingColumns(): void {
    const allColumns = this.allColumnsForViewType();
    const defaultVisible = allColumns.filter(c => c.visible === true);
    this.streamingVisibleColumns.set(defaultVisible);
    this.cdr.markForCheck();
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

  // Transaction view change handler
  onViewChange(viewId: string): void {
    this.selectedViewId.set(viewId);
    console.log('[SearchResult] Transaction view changed to:', viewId);
  }

  // Control handlers
  stopStreaming(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.orchestrator.stopSearch(this.search.id);
    this.search.isStreaming = false;
    this.cdr.markForCheck();
  }

  closePanel(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.orchestrator.removeSearch(this.search.id);
  }

  retrySearch(): void {
    this.orchestrator.retrySearch(this.search.id);
  }
  

  public forceExpand(): void {
    this.internalIsExpanded.set(true);
    this.orchestrator.expandSearch(this.search.id);
  }
  
  // Add this method to programmatically collapse accordion if needed
  public forceCollapse(): void {
    this.internalIsExpanded.set(false);
    this.orchestrator.collapseSearch(this.search.id);
  }

// Updated drilldown handler to ensure proper accordion management
onDrilldown(query: any): void {
  console.log('[SearchResult] Drilldown triggered for:', query);
  
    // Perform the transaction search - orchestrator will handle accordion collapse
    this.orchestrator.performSearch({
      type: 'transaction',
      query: query.query || query,
      title: `Transaction Details: ${query.query || query}`,
      appName: this.search.appName
    });
  }

  // Utility methods for different search types
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
}