// src/app/features/search-logs/components/jira-upload-dialog/jira-upload-dialog.component.ts
import { Component, Input, Output, EventEmitter, inject, signal, computed, WritableSignal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Modules
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';

// Services & Models
import { EnhancedJiraService, JiraIdDetectionResult, TestCycleExecution } from '../../services/enhanced-jira.service';
import { TransactionDetailsResponse } from '../../models/transactionDetails/transaction-details.model';

export type JiraDialogMode = 'upload' | 'search';

@Component({
  selector: 'app-jira-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    CheckboxModule,
    ProgressBarModule,
    MessageModule,
    TooltipModule,
    BadgeModule
  ],
  templateUrl: './jira-upload-dialog.component.html',
  styleUrls: ['./jira-upload-dialog.component.scss']
})
export class JiraUploadDialogComponent {
  @Input({ required: true }) visible = false;
  @Input({ required: true }) transactionData: TransactionDetailsResponse | undefined = undefined;
  @Input() mode: JiraDialogMode = 'upload';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() searchRequested = new EventEmitter<{ query: string; type: 'cycle' | 'execution' }>();
  
  

  private jiraService = inject(EnhancedJiraService);

  // ================================
  // STATE SIGNALS
  // ================================

  public jiraInput: WritableSignal<string> = signal('');
  public selectedRows: WritableSignal<TestCycleExecution[]> = signal([]);

  // ================================
  // COMPUTED SIGNALS
  // ================================

  public readonly detectionResult = computed(() => {
    const input = this.jiraInput();
    if (!input.trim()) return null;
    return this.jiraService.detectJiraId(input);
  });

  public readonly isValidInput = computed(() => {
    const result = this.detectionResult();
    return result?.isValid ?? false;
  });

  public readonly dialogTitle = computed(() => {
    return this.mode === 'upload' 
      ? 'Upload Transaction Data to JIRA'
      : 'JIRA Search';
  });

  public readonly inputErrorMessage = computed(() => {
    const result = this.detectionResult();
    return result?.errorMessage || '';
  });

  public readonly jiraTypeDisplay = computed(() => {
    const result = this.detectionResult();
    if (!result) return '';
    
    switch (result.type) {
      case 'jira-id': return 'JIRA Ticket';
      case 'test-case': return 'Test Case';
      case 'test-cycle': return 'Test Cycle';
      case 'execution': return 'Execution (Not Supported)';
      default: return 'Invalid Format';
    }
  });

  public readonly actionButtonText = computed(() => {
    if (this.mode === 'upload') {
      const result = this.detectionResult();
      if (!result) return 'Upload';
      
      switch (result.type) {
        case 'test-cycle': return `Upload to ${result.id}`;
        case 'test-case': return `Upload to ${result.id}`;
        case 'jira-id': return `Upload to ${result.id}`;
        default: return 'Upload';
      }
    } else {
      // Search mode
      const selectedExecution = this.selectedRows()[0];
      return selectedExecution 
        ? `Search ${selectedExecution.key}`
        : `Search ${this.jiraInput()}`;
    }
  });

  public readonly inputPlaceholder = computed(() => {
    return 'Enter JIRA ID (e.g., APP-123, APP-C123, APP-T123) or paste JIRA URL';
  });

  // Service state
  public readonly uploadState = this.jiraService.uploadState;
  public readonly testCycleExecutions = this.jiraService.testCycleExecutions;
  public readonly hasSelectedExecutions = this.jiraService.hasSelectedExecutions;

  // ================================
  // EFFECTS
  // ================================

  constructor() {
    // Reset state when dialog is opened/closed
    effect(() => {
      if (!this.visible) {
        this.jiraService.resetState();
        this.jiraInput.set('');
        this.selectedRows.set([]);
      }
    });

    // Update selected rows when service selection changes
    effect(() => {
      const executions = this.testCycleExecutions();
      const selectedIds = this.uploadState().selectedExecutions;
      const selected = executions.filter(exec => selectedIds.includes(exec.id));
      this.selectedRows.set(selected);
    });

    effect(() => {
      const input = this.jiraInput();
      const result = this.detectionResult();
      
      if (this.mode === 'search' && 
          this.visible && 
          result?.isValid && 
          result.type === 'test-cycle') {
        this.autoLoadExecutions(result.id);
      }
    });
  }

  // ================================
  // EVENT HANDLERS
  // ================================

  /**
   * Handle dialog close (both X button and programmatic close)
   */
  public onDialogHide(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Get associated executions for test cycle
   */
  public async getAssociatedExecutions(): Promise<void> {
    const result = this.detectionResult();
    if (!result || result.type !== 'test-cycle') return;

    try {
      await this.jiraService.getTestCycleExecutions(result.id);
    } catch (error) {
      console.error('[JiraUploadDialog] Failed to get executions:', error);
    }
  }

  /**
   * Load executions automatically for search mode from search bar
   */
  private async autoLoadExecutions(testCycleId: string): Promise<void> {
    try {
      console.log(`[JiraUploadDialog] Auto-loading executions for search mode: ${testCycleId}`);
      await this.jiraService.getTestCycleExecutions(testCycleId);
    } catch (error) {
      console.error('[JiraUploadDialog] Auto-load executions failed:', error);
    }
  }

  /**
   * Handle primary action (upload OR search)
   */
  public async performAction(): Promise<void> {
    if (this.mode === 'upload') {
      return this.performUpload();
    } else {
      return this.performSearch();
    }
  }

  /**
   * Keep existing upload logic
   */
  private async performUpload(): Promise<void> {
    const result = this.detectionResult();
    if (!result?.isValid) {
      console.error('[JiraUploadDialog] Invalid JIRA input for upload');
      return;
    }

    try {
      if (result.type === 'test-cycle') {
        await this.jiraService.uploadToTestCycleExecutions(result.id, this.transactionData);
      } else {
        await this.jiraService.uploadToJira(result.id, this.transactionData);
      }
    } catch (error) {
      console.error('[JiraUploadDialog] Upload failed:', error);
    }
  }

  /**
   * ADD: Handle search action
   */
  private async performSearch(): Promise<void> {
    const result = this.detectionResult();
    if (!result?.isValid) {
      console.error('[JiraUploadDialog] Invalid JIRA input for search');
      return;
    }

    const selectedExecution = this.selectedRows()[0];
    
    if (result.type === 'test-cycle' && selectedExecution) {
      // Search specific execution
      console.log(`[JiraUploadDialog] Searching execution: ${selectedExecution.key}`);
      this.searchRequested.emit({
        query: selectedExecution.key,
        type: 'execution'
      });
    } else {
      // Search the cycle/ticket itself
      console.log(`[JiraUploadDialog] Searching cycle/ticket: ${result.id}`);
      this.searchRequested.emit({
        query: result.id,
        type: 'cycle'
      });
    }

    this.visibleChange.emit(false);
  }

  /**
   * Handle execution row selection
   */
  public onExecutionSelectionChange(execution: TestCycleExecution, checked: boolean): void {
    if (checked) {
      this.jiraService.toggleExecutionSelection(execution.id);
    } else {
      this.jiraService.toggleExecutionSelection(execution.id);
    }
  }

  /**
   * Check if execution is selected
   */
  public isExecutionSelected(execution: TestCycleExecution): boolean {
    return this.uploadState().selectedExecutions.includes(execution.id);
  }

  /**
   * Upload to regular JIRA (ticket, test case, or test cycle)
   */
  public async uploadToJira(): Promise<void> {
    const result = this.detectionResult();
    if (!result || !result.isValid) return;

    try {
      switch (result.type) {
        case 'jira-id':
          await this.jiraService.uploadToJiraId(result.id, this.transactionData);
          break;
        case 'test-case':
          await this.jiraService.uploadToTestCase(result.id, this.transactionData);
          break;
        case 'test-cycle':
          await this.jiraService.uploadToTestCycle(result.id, this.transactionData);
          break;
      }

      // Close dialog after successful upload
      setTimeout(() => {
        this.onDialogHide();
      }, 2000);

    } catch (error) {
      console.error('[JiraUploadDialog] Upload failed:', error);
    }
  }

  /**
   * Upload to selected executions
   */
  public async uploadToSelectedExecutions(): Promise<void> {
    const result = this.detectionResult();
    if (!result || result.type !== 'test-cycle') return;

    try {
      await this.jiraService.uploadToSelectedExecutions(result.id, this.transactionData);
      
      // Close dialog after successful upload
      setTimeout(() => {
        this.onDialogHide();
      }, 2000);

    } catch (error) {
      console.error('[JiraUploadDialog] Upload to executions failed:', error);
    }
  }

  /**
   * Clear messages
   */
  public clearMessages(): void {
    this.jiraService.clearMessages();
  }

  /**
   * Get status severity for PrimeNG badge component (v19 compatible)
   */
  public getStatusSeverity(status: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast"  {
    switch (status?.toLowerCase()) {
      case 'pass':
      case 'passed':
        return 'success';
      case 'fail':
      case 'failed':
        return 'danger';
      case 'blocked':
        return 'warn';
      case 'pending':
      case 'running':
        return 'info';
      default:
        return 'secondary';
    }
  }

  /**
   * Alternative: Computed severity for better performance (if needed)
   */
  public getExecutionSeverity = computed(() => {
    return (status: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" => {
      return this.getStatusSeverity(status);
    };
  });

  /**
   * Create JIRA URL for external links
   */
  public createJiraUrl(url: string | undefined): string {
    return url || '#';
  }
}