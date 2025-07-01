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
  @Input() data: any[] = [];
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
  private jiraService = inject(JiraAttachmentService);
  private metricsService = inject(TransactionMetricsService);

  // State signals
  private _showJiraDialog: WritableSignal<boolean> = signal(false);
  private _isUploading: WritableSignal<boolean> = signal(false);
  public jiraTicketId: string = '';

  // Public computed signals
  public readonly showJiraDialog = this._showJiraDialog.asReadonly();
  public readonly isUploading = this._isUploading.asReadonly();

  public readonly metricsData = computed(() => {
    return this.metricsService.calculateMetrics(this.data);
  });

  public readonly hasMetrics = computed(() => {
    const metrics = this.metricsData();
    return metrics && metrics.chartData.datasets[0].data.length > 0;
  });

  // Menu items
  public readonly shareMenuItems: MenuItem[] = [
    {
      label: 'Copy Transaction ID',
      icon: 'pi pi-copy',
      command: () => this.copyTransactionId()
    },
    {
      label: 'Copy Transaction Link',
      icon: 'pi pi-link',
      command: () => this.copyTransactionLink()
    }
  ];

  public readonly jiraMenuItems: MenuItem[] = [
    {
      label: 'Upload to JIRA',
      icon: 'pi pi-upload',
      command: () => this.showJiraUploadDialog()
    }
  ];

  /**
   * Download transaction data as ZIP
   */
  public async downloadTransactionData(): Promise<void> {
    try {
      await this.downloadService.downloadTransactionMessages(this.data);
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
      }
    } catch (error) {
      console.error('[TransactionToolbar] Copy transaction link failed:', error);
    }
  }

  /**
   * Show JIRA upload dialog
   */
  public showJiraUploadDialog(): void {
    this.jiraTicketId = '';
    this._showJiraDialog.set(true);
  }

  /**
   * Hide JIRA upload dialog
   */
  public hideJiraDialog(): void {
    this._showJiraDialog.set(false);
    this.jiraTicketId = '';
  }

  /**
   * Upload transaction data to JIRA
   */
  public async uploadToJira(): Promise<void> {
    if (!this.jiraTicketId?.trim()) return;

    this._isUploading.set(true);
    
    try {
      await this.jiraService.attachTransactionToJira(this.jiraTicketId.trim(), this.data);
      this.hideJiraDialog();
    } catch (error) {
      console.error('[TransactionToolbar] JIRA upload failed:', error);
    } finally {
      this._isUploading.set(false);
    }
  }

  /**
   * Extract transaction ID from data
   */
  private extractTransactionId(): string | null {
    if (!this.data?.length) return null;

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