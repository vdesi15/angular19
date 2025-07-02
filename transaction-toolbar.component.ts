import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';
// Donut chart popover would be its own component
// import { TransactionMetricsComponent } from './transaction-metrics.component';

@Component({
  selector: 'app-transaction-toolbar',
  standalone: true,
  imports: [CommonModule,
    FormsModule,
    ToolbarModule,
    ButtonModule,
    TooltipModule,
    SelectModule,
    MenuModule,
    OverlayPanelModule,
    DialogModule,
    InputTextModule,
    ChartModule]
})
export class TransactionToolbarComponent {
  @Input({ required: true }) data: TransactionDetailsResponse | undefined = undefined;
  @Input() searchType: string = '';
  @Input() appName: string = '';
  @Input() currentFilters: any = {};
  @Input() views: ViewDefinition[] = [];
  @Input() selectedView: string = '';

  @Output() exportTriggered = new EventEmitter<any>();
  @Output() viewModeChanged = new EventEmitter<string>();
  @Output() filterChanged = new EventEmitter<any>();

  // Injected services
  private downloadService = inject(TransactionDownloadService);
  private shareService = inject(TransactionShareService);
  private metricsService = inject(TransactionMetricsService);

  // ================================
  // STATE SIGNALS
  // ================================

  private _showJiraDialog: WritableSignal<boolean> = signal(false);

  // Public computed signals
  public readonly showJiraDialog = this._showJiraDialog.asReadonly();

  public readonly metricsData = computed(() => {
    const transactionHits = this.data?.hits?.hits || [];
    return this.metricsService.calculateMetrics(transactionHits);
  });

  public readonly hasMetrics = computed(() => {
    const metrics = this.metricsData();
    return metrics && metrics.chartData.datasets[0].data.length > 0;
  });

  public readonly hasTransactionData = computed(() => {
    return this.data?.hits?.hits && this.data.hits.hits.length > 0;
  });

  // ================================
  // MENU ITEMS (REACTIVE)
  // ================================

  public readonly shareMenuItems = computed((): MenuItem[] => [
    {
      label: 'Copy Transaction ID',
      icon: 'pi pi-copy',
      command: () => this.copyTransactionId(),
      disabled: !this.hasTransactionData()
    },
    {
      label: 'Copy Transaction Link',
      icon: 'pi pi-link',
      command: () => this.copyTransactionLink(),
      disabled: !this.hasTransactionData()
    }
  ]);

  public readonly jiraMenuItems = computed((): MenuItem[] => [
    {
      label: 'Upload to JIRA',
      icon: 'pi pi-upload',
      command: () => this.showJiraUploadDialog(),
      disabled: !this.hasTransactionData()
    }
  ]);

  // ================================
  // PUBLIC METHODS
  // ================================

  /**
   * Download transaction data as ZIP
   */
  public async downloadTransactionData(): Promise<void> {
    if (!this.hasTransactionData()) {
      console.warn('[TransactionToolbar] No transaction data to download');
      return;
    }

    try {
      // Convert TransactionDetailsResponse to the format expected by download service
      const transactionHits = this.data?.hits?.hits?.map(hit => hit._source) || [];
      await this.downloadService.downloadTransactionMessages(transactionHits);
    } catch (error) {
      console.error('[TransactionToolbar] Download failed:', error);
    }
  }

  /**
   * Copy transaction ID to clipboard
   */
  public async copyTransactionId(): Promise<void> {
    try {
      const transactionId = this.extractTransactionId();
      if (transactionId) {
        await this.shareService.copyTransactionId(transactionId);
      } else {
        console.warn('[TransactionToolbar] No transaction ID found');
      }
    } catch (error) {
      console.error('[TransactionToolbar] Copy transaction ID failed:', error);
    }
  }

  /**
   * Copy transaction link to clipboard
   */
  public async copyTransactionLink(): Promise<void> {
    try {
      const transactionId = this.extractTransactionId();
      if (transactionId) {
        await this.shareService.copyTransactionLink(transactionId, this.currentFilters);
      } else {
        console.warn('[TransactionToolbar] No transaction ID found');
      }
    } catch (error) {
      console.error('[TransactionToolbar] Copy transaction link failed:', error);
    }
  }

  /**
   * Show JIRA upload dialog
   */
  public showJiraUploadDialog(): void {
    if (!this.hasTransactionData()) {
      console.warn('[TransactionToolbar] No transaction data for JIRA upload');
      return;
    }
    
    this._showJiraDialog.set(true);
  }

  /**
   * Hide JIRA upload dialog
   */
  public hideJiraDialog(): void {
    this._showJiraDialog.set(false);
  }

  /**
   * Handle JIRA dialog visibility change
   */
  public onJiraDialogVisibilityChange(visible: boolean): void {
    this._showJiraDialog.set(visible);
  }

  // ================================
  // PRIVATE HELPER METHODS
  // ================================

  /**
   * Extract transaction ID from data
   */
  private extractTransactionId(): string | null {
    if (!this.data?.hits?.hits?.length) return null;

    const firstHit = this.data.hits.hits[0];
    const firstRow = firstHit._source;
    const identifierFields = [
      '_source.transactionId',
      '_source.id',
      '_source.traceId',
      'transactionId',
      'id'
    ];

    for (const field of identifierFields) {
      const value = this.getNestedValue(firstRow, field);
      if (value) {
        return String(value);
      }
    }

    return null;
  }this.data?.length) return null;

    const firstRow = this.data[0];
    const identifierFields = [
      '_source.transactionId',
      '_source.id',
      '_source.traceId',
      'transactionId',
      'id'
    ];

    for (const field of identifierFields) {
      const value = this.getNestedValue(firstRow, field);
      if (value) {
        return String(value);
      }
    }

    return null;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : null, obj
    );
  }
}