// components/transaction-details/transaction-details.component.ts
import { Component, Input, inject, signal, computed, WritableSignal, ViewChild, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

// Models
import { ActiveSearch } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';
import { TransactionTimelineItem } from '../models/transaction-details.model';

// Services
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';
import { SearchHistoryService } from 'src/app/core/services/search-history.service';
import { FiltersService } from 'src/app/core/services/filters.service';

// PrimeNG Modules
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { ProgressBarModule } from 'primeng/progressbar';
import { SplitterModule } from 'primeng/splitter';

// Components
import { TransactionToolbarComponent } from '../transaction-toolbar/transaction-toolbar.component';
import { LogViewerComponent } from '../log-viewer/log-viewer.component';
import { TransactionTimelineComponent } from '../transaction-timeline/transaction-timeline.component';
import { TableSkeletonComponent } from 'src/app/shared/components/table-skeleton/table-skeleton.component';

@Component({
  selector: 'app-transaction-details',
  standalone: true,
  imports: [
    CommonModule, 
    AccordionModule, 
    ButtonModule, 
    TooltipModule, 
    BadgeModule, 
    ProgressBarModule,
    TransactionToolbarComponent, 
    LogViewerComponent, 
    TransactionTimelineComponent,
    TableSkeletonComponent
  ],
  templateUrl: './transaction-details.component.html',
  styleUrls: ['./transaction-details.component.scss']
})
export class TransactionDetailsComponent {
  @Input({ required: true }) search!: ActiveSearch;

  @ViewChild(LogViewerComponent) public logViewer?: LogViewerComponent;

  // Injected Services
  public orchestrator = inject(SearchOrchestratorService);
  private colDefService = inject(ColumnDefinitionService);
  private viewDefService = inject(ViewDefinitionService);
  private searchHistoryService = inject(SearchHistoryService);
  private filtersService = inject(FiltersService);
  private cdr = inject(ChangeDetectorRef);

  // State Signals
  public selectedViewId: WritableSignal<string> = signal('');
  public filteredCount = 0;

  // Computed signals for column definitions - uses TransactionDetailsCols
  public allColumnsForViewType = computed(() => {
    const app = this.search.appName;
    // Use TransactionDetailsCols for transaction details
    return this.colDefService.getColumnsFor(app, 'TransactionDetailsCols');
  });
  
  public availableViews = computed(() => {
    return this.viewDefService.getViewsForApp(this.search.appName);
  });

  public finalVisibleColumns = computed(() => {
    const selectedViewId = this.selectedViewId();
    if (!selectedViewId) return this.allColumnsForViewType();
    
    return this.allColumnsForViewType().filter(col => {
      if (!col.views) return true;
      return col.views.split(',').map(v => v.trim()).includes(selectedViewId);
    });
  });

  public showSkeleton = computed(() => {
    return this.search.isLoading && this.search.data.length === 0;
  });

  // Transaction-specific computed properties
  public transactionData = computed(() => {
    return this.search.data || [];
  });

  public timelineData = computed((): TransactionTimelineItem[] => {
    const data = this.search.data;
    if (!data || !Array.isArray(data)) return [];
    
    // Extract timeline from response
    const response = data[0]?.TRANSACTION_TIMELINE || [];
    return Array.isArray(response) ? response : [];
  });

  public transactionSummary = computed(() => {
    const data = this.transactionData();
    if (data.length === 0) return null;
    
    const firstItem = data[0];
    const source = firstItem?._source;
    
    return {
      transactionId: this.search.query,
      status: source?.['response.status'] || source?.['http.status_code'] || 'Unknown',
      duration: source?.['response.time'] || source?.duration || 0,
      startTime: source?.['@timestamp'] || source?.timestamp,
      service: source?.['service.name'] || 'Unknown Service',
      endpoint: source?.['http.url'] || source?.endpoint || 'Unknown Endpoint'
    };
  });

  constructor() {
    // Initialize view selection
    effect(() => {
      const available = this.availableViews();
      if (available.length > 0 && !this.selectedViewId()) {
        const defaultView = available.find(v => v.default) ?? available[0];
        if (defaultView) {
          this.selectedViewId.set(defaultView.viewId);
        }
      }
    });
  }

  // Helper Methods
  public getTransactionIcon(): string {
    return 'pi pi-sitemap';
  }

  public getTransactionTypeBadge(): { label: string; severity: string } {
    return {
      label: 'Transaction',
      severity: 'info'
    };
  }

  public getTransactionDescription(): string {
    const summary = this.transactionSummary();
    if (!summary) return 'Transaction Details';
    
    return `${summary.service} - ${summary.endpoint}`;
  }

  public getStatusSeverity(status: string): string {
    if (!status) return 'secondary';
    const s = status.toString().toLowerCase();
    
    if (s.includes('200') || s.includes('success') || s.includes('ok') || s.includes('completed')) {
      return 'success';
    }
    if (s.includes('error') || s.includes('failed') || s.includes('failure') || s.includes('500') || s.includes('4')) {
      return 'danger';
    }
    if (s.includes('warning') || s.includes('timeout') || s.includes('3')) {
      return 'warning';
    }
    return 'info';
  }

  // Event handlers
  public updateFilteredCount(count: number): void {
    setTimeout(() => {
      this.filteredCount = count;
      this.cdr.detectChanges();
    }, 0);
  }

  public onRelatedTransactionClick(transactionId: any): void {
    this.orchestrator.performSearch({
      type: 'transaction',
      query: transactionId,
      title: `Transaction: ${transactionId}`,
      appName: this.search.appName
    });
  }

  public refreshTransaction(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.orchestrator.fetchDataFor(this.search);
  }

  public closePanel(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.orchestrator.closeSearch(this.search.id);
  }

  public onAccordionOpen(event: any): void {
    this.orchestrator.updateSearchState(this.search.id, { isExpanded: true });
  }

  public onAccordionClose(event: any): void {
    this.orchestrator.updateSearchState(this.search.id, { isExpanded: false });
  }

  public retrySearch(): void {
    this.orchestrator.fetchDataFor(this.search);
  }

  public onViewChange(viewId: string): void {
    this.selectedViewId.set(viewId);
  }

  // Timeline helpers
  public getTimelineKey(): string {
    const timeline = this.timelineData();
    if (timeline.length > 0) {
      return timeline[0].l || 'Transaction Flow';
    }
    return 'Transaction Flow';
  }
}