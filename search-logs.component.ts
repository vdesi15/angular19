// Clean search-result.component.ts - Remove favorites-related code

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
// REMOVED: SearchHistoryService, FiltersService imports for favorites

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

@Component({
  selector: 'app-search-result',
  standalone: true,
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

  // Computed signal to determine if we should show skeleton
  public showSkeleton = computed(() => {
    return this.search.isLoading && this.search.data.length === 0;
  });

  // Computed signal to determine if we should show the content
  public showContent = computed(() => {
    return !this.showSkeleton() && !this.search.error;
  });

  // Records summary for display
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

  onDrilldown(query: any): void {
    this.orchestrator.performSearch(query);
  }

  // Transaction view change handler
  onViewChange(viewId: string): void {
    this.selectedViewId.set(viewId);
    console.log('[SearchResult] Transaction view changed to:', viewId);
  }

  // Accordion event handlers
  onAccordionOpen(event: any): void {
    this.orchestrator.expandSearch(this.search.id);
  }

  onAccordionClose(event: any): void {
    this.orchestrator.collapseSearch(this.search.id);
  }

  // Control handlers
  stopStreaming(event: Event): void {
    event.stopPropagation();
    this.orchestrator.stopSearch(this.search.id);
  }

  closePanel(event: Event): void {
    event.stopPropagation();
    this.orchestrator.removeSearch(this.search.id);
  }

  retrySearch(): void {
    this.orchestrator.retrySearch(this.search.id);
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
}