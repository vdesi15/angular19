// components/transaction-details/transaction-details.component.ts
import { Component, Input, inject, signal, computed, WritableSignal, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

// Models
import { ActiveSearch } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';

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
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TabViewModule } from 'primeng/tabview';

// Components
import { TransactionToolbarComponent } from '../transaction-toolbar/transaction-toolbar.component';
import { LogViewerComponent } from '../log-viewer/log-viewer.component';
import { TableSkeletonComponent } from 'src/app/shared/components/table-skeleton/table-skeleton.component';

@Component({
  selector: 'app-transaction-details',
  standalone: true,
  imports: [
    CommonModule, AccordionModule, ButtonModule, TooltipModule, BadgeModule, 
    ProgressBarModule, CardModule, DividerModule, TabViewModule,
    TransactionToolbarComponent, LogViewerComponent, TableSkeletonComponent
  ]
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

  // Computed signals
  public allColumnsForViewType = computed(() => {
    const app = this.search.appName;
    return this.colDefService.getColumnsFor(app, 'browse'); // Use browse columns for transactions
  });
  
  public availableViews = computed(() => {
    return this.viewDefService.getViewsForApp(this.search.appName);
  });

  public finalVisibleColumns = computed(() => {
    const selectedViewId = this.selectedViewId();
    if (!selectedViewId) return [];
    
    return this.allColumnsForViewType().filter(col => {
      if (!col.views) return true;
      return col.views.split(',').map(v => v.trim()).includes(selectedViewId);
    });
  });

  public isFavorite = computed(() => {
    const currentGlobalFilters = this.filtersService.filters();
    if (!currentGlobalFilters) return false;
    const searchSignature = this.createSearchSignature();
    return this.searchHistoryService.isFavorite(searchSignature);
  });

  public showSkeleton = computed(() => {
    return this.search.isLoading && this.search.data.length === 0;
  });

  constructor() {
    // Initialize view selection
    effect(() => {
      const available = this.availableViews();
      if (available.length > 0) {
        const defaultView = available.find(v => v.default) ?? available[0];
        if (defaultView) {
          this.selectedViewId.set(defaultView.viewId);
        }
      }
    });
  }

  // Header methods
  public getTransactionIcon(): string {
    const type = this.search.searchMetadata?.detectionResult?.type;
    switch (type) {
      case 'transaction': return 'pi pi-sitemap';
      case 'jira': return 'pi pi-ticket';
      case 'batch': return 'pi pi-clone';
      default: return 'pi pi-sitemap';
    }
  }

  public getTransactionTypeBadge(): { label: string; severity: string } {
    const type = this.search.searchMetadata?.detectionResult?.type;
    switch (type) {
      case 'transaction': return { label: 'TXN', severity: 'info' };
      case 'jira': return { label: 'JIRA', severity: 'warning' };
      case 'batch': return { label: 'BATCH', severity: 'success' };
      default: return { label: 'TXN', severity: 'info' };
    }
  }

  public getTransactionDescription(): string {
    const confidence = this.getConfidence();
    const type = this.search.searchMetadata?.detectionResult?.type || 'transaction';
    
    if (confidence) {
      return `${type.charAt(0).toUpperCase() + type.slice(1)} Details (${Math.round(confidence * 100)}% confidence)`;
    }
    return `${type.charAt(0).toUpperCase() + type.slice(1)} Details`;
  }

  public getTransactionSummary(): string {
    const totalRecords = this.search.data.length;
    if (totalRecords === 0) return '';
    
    return `${totalRecords} record${totalRecords !== 1 ? 's' : ''} found`;
  }

  public getConfidence(): number | null {
    return this.search.searchMetadata?.confidence || null;
  }

  // Transaction data extraction
  public getTransactionDetails(): any {
    if (this.search.data.length === 0) return null;
    
    const firstRecord = this.search.data[0]._source;
    return {
      transactionId: firstRecord.transactionId || firstRecord.trace?.id || this.search.query,
      status: firstRecord.status || firstRecord.transaction?.result,
      duration: firstRecord.duration || firstRecord.transaction?.duration?.us,
      startTime: firstRecord.timestamp || firstRecord['@timestamp'],
      endTime: firstRecord.endTime,
      spans: firstRecord.spans || [],
      tags: firstRecord.tags || firstRecord.labels
    };
  }

  public getSpansData(): any[] {
    const details = this.getTransactionDetails();
    return details?.spans || [];
  }

  public getSpanTags(tags: any): Array<{key: string; value: any}> {
    if (!tags) return [];
    return Object.entries(tags).map(([key, value]) => ({ key, value }));
  }

  public getRelatedTransactions(): any[] {
    // Extract related transactions from data
    return this.search.data
      .filter(item => item._source.transactionId !== this.search.query)
      .map(item => ({
        id: item._source.transactionId || item._source.trace?.id,
        type: item._source.type || 'Transaction',
        timestamp: item._source.timestamp || item._source['@timestamp']
      }))
      .filter(item => item.id)
      .slice(0, 10); // Limit to 10 related transactions
  }

  public getStatusSeverity(status: string): string {
    if (!status) return 'secondary';
    const s = status.toLowerCase();
    if (s.includes('success') || s.includes('ok') || s.includes('completed')) return 'success';
    if (s.includes('error') || s.includes('failed') || s.includes('failure')) return 'danger';
    if (s.includes('warning') || s.includes('timeout')) return 'warning';
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

  public toggleFavorite(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const searchSignature = this.createSearchSignature();
    this.searchHistoryService.toggleFavorite(searchSignature);
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

  // Utility methods
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
}