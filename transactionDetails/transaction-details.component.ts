// Simplified transaction-details.component.ts
import { 
  Component, 
  Input, 
  ViewChild, 
  ChangeDetectionStrategy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActiveSearch, TransactionDetailsData, TransactionTimelineItem } from '../models/search.model';
import { SearchOrchestratorService } from '../services/search-orchestrator.service';
import { ColumnDefinitionService } from '../services/column-definition.service';
import { ViewDefinitionService } from '../services/view-definition.service';

@Component({
  selector: 'app-transaction-details',
  standalone: true,
  imports: [CommonModule /* add your PrimeNG imports */],
  templateUrl: './transaction-details.component.html',
  styleUrls: ['./transaction-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionDetailsComponent {
  @Input({ required: true }) search!: ActiveSearch;

  // Injected Services
  private readonly orchestrator = inject(SearchOrchestratorService);
  private readonly colDefService = inject(ColumnDefinitionService);
  private readonly viewDefService = inject(ViewDefinitionService);

  // Simple component signals
  public readonly selectedViewId = signal('');

  // Computed signals that read from your ActiveSearch
  public readonly transactionData = computed(() => {
    return this.search.data || [];
  });

  public readonly transactionDetails = computed((): TransactionDetailsData | null => {
    return this.search.transactionDetails || null;
  });

  public readonly timelineData = computed((): TransactionTimelineItem[] => {
    const details = this.transactionDetails();
    return details?.transactionTimeline || [];
  });

  public readonly formattedPayloads = computed(() => {
    const details = this.transactionDetails();
    return details?.formattedPayloads || [];
  });

  public readonly hasOverflow = computed(() => {
    const details = this.transactionDetails();
    return details?.overflow || false;
  });

  public readonly callCount = computed(() => {
    const details = this.transactionDetails();
    return details?.call_count || 0;
  });

  // Your existing computed signals for columns/views
  public readonly allColumnsForViewType = computed(() => {
    const app = this.search.appName;
    return this.colDefService.getColumnsFor(app, 'TransactionDetailsCols');
  });
  
  public readonly availableViews = computed(() => {
    return this.viewDefService.getViewsForApp(this.search.appName);
  });

  public readonly finalVisibleColumns = computed(() => {
    const selectedViewId = this.selectedViewId();
    if (!selectedViewId) return this.allColumnsForViewType();
    
    return this.allColumnsForViewType().filter(col => {
      if (!col.views) return true;
      return col.views.split(',').map(v => v.trim()).includes(selectedViewId);
    });
  });

  public readonly showSkeleton = computed(() => {
    return this.search.isLoading && this.search.data.length === 0;
  });

  // Transaction-specific computed properties
  public readonly transactionSummary = computed(() => {
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

  // Simple event handlers
  onViewChange(viewId: string): void {
    this.selectedViewId.set(viewId);
  }

  refreshTransactionDetails(): void {
    this.orchestrator.refreshSearch(this.search.id);
  }

  // Keep all your existing utility methods unchanged
}