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

  // Direct access to transaction details
  public readonly transactionDetails = computed(() => {
    return this.search.transactionDetails || null;
  });

  public readonly timelineData = computed(() => {
    const details = this.transactionDetails();
    return details?.TRANSACTION_TIMELINE || [];
  });

  public readonly formattedPayloads = computed(() => {
    const details = this.transactionDetails();
    return details?.FORMATTED_PAYLOADS || [];
  });

  public readonly hasOverflow = computed(() => {
    const details = this.transactionDetails();
    return details?.overflow || false;
  });

  public readonly callCount = computed(() => {
    const details = this.transactionDetails();
    return details?.call_count || 0;
  });

  // Your table data comes from search.data as usual
  public readonly transactionData = computed(() => {
    return this.search.data || [];
  });
}