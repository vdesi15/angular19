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

TestCycleExecutions{
  id: number;
  testCaseKey: string <-- Test case id
  testcaseUrl: string; <-- test case url
  key: string;  <-- Execution id
  keyUrl: string; <-- execution url
  status: string;
}

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
export class JiraUploadDialogComponent implements OnInit, OnChanges {
@Input({ required: true }) visible = false;
  @Input({ required: true }) transactionData: TransactionDetailsResponse | undefined = undefined;
  @Input() mode: JiraDialogMode = 'upload';
  @Input() initialJiraId: string = '';
  
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() dialogClosed = new EventEmitter<void>();
  @Output() searchRequested = new EventEmitter<{ query: string; type: 'cycle' | 'execution' }>();

  private jiraService = inject(EnhancedJiraService);

  // ================================
  // STATE SIGNALS
  // ================================

  public jiraInput: WritableSignal<string> = signal('');
  public selectedExecution: WritableSignal<TestCycleExecution | null> = signal(null);

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
      : 'JIRA Search & Execution Selection';
  });

  public readonly inputPlaceholder = computed(() => {
    return 'Enter JIRA ID (e.g., APP-123, APP-C123, APP-T123) or paste JIRA URL';
  });

  public readonly jiraTypeDisplay = computed(() => {
    const result = this.detectionResult();
    if (!result) return '';

    switch (result.type) {
      case 'jira-id': return 'JIRA Ticket';
      case 'test-case': return 'Test Case';
      case 'test-cycle': return 'Test Cycle';
      case 'execution': return 'Test Execution';
      default: return 'Invalid Format';
    }
  });

  // SIMPLIFIED BUTTON LOGIC
  public readonly primaryButtonText = computed(() => {
    const selected = this.selectedExecution();
    const result = this.detectionResult();
    
    if (this.mode === 'search') {
      if (selected) {
        return `Search ${selected.key}`; // "Search APP-E11"
      }
      if (result?.isValid) {
        return `Search ${result.id}`; // "Search APP-C1"
      }
    } else {
      // Upload mode
      if (selected) {
        return `Upload to ${selected.key}`;
      }
      if (result?.isValid) {
        return `Upload to ${result.id}`;
      }
    }
    
    return this.mode === 'search' ? 'Search' : 'Upload';
  });

  public readonly showPrimaryButton = computed(() => {
    return this.isValidInput();
  });

  public readonly showExecutionsTable = computed(() => {
    const result = this.detectionResult();
    const executions = this.testCycleExecutions();
    
    return result?.isValid && 
           result.type === 'test-cycle' && 
           executions.length > 0;
  });

  // Service state
  public readonly uploadState = this.jiraService.uploadState;
  public readonly testCycleExecutions = this.jiraService.testCycleExecutions;

  // ================================
  // LIFECYCLE HOOKS
  // ================================

  ngOnInit(): void {
    console.log('[JiraDialog] Component initialized');
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle initial JIRA ID when it changes
    if (changes['initialJiraId'] && changes['initialJiraId'].currentValue) {
      const newJiraId = changes['initialJiraId'].currentValue;
      console.log(`[JiraDialog] Setting initial JIRA ID: ${newJiraId}`);
      this.jiraInput.set(newJiraId);
      
      // Auto-load executions if it's a test cycle
      this.autoLoadExecutionsIfNeeded(newJiraId);
    }
    
    // Handle visibility changes
    if (changes['visible']) {
      const isVisible = changes['visible'].currentValue;
      if (!isVisible) {
        this.resetDialogState();
      }
    }
  }

  // ================================
  // EFFECTS
  // ================================

  constructor() {
    // Handle visible state and initial values
    effect(() => {
      const isVisible = this.visible;
      const initial = this.initialJiraId;
      
      if (isVisible && initial && initial.trim() && !this.jiraInput()) {
        console.log(`[JiraDialog] Effect - Setting initial JIRA ID: ${initial}`);
        this.jiraInput.set(initial);
        this.autoLoadExecutionsIfNeeded(initial);
      }
    });
  }

  // ================================
  // AUTO-LOADING LOGIC
  // ================================

  /**
   * Auto-load executions if the JIRA ID is a test cycle
   */
  private async autoLoadExecutionsIfNeeded(jiraId: string): Promise<void> {
    if (!jiraId.trim()) return;
    
    const detection = this.jiraService.detectJiraId(jiraId);
    
    if (detection.isValid && detection.type === 'test-cycle' && this.mode === 'search') {
      console.log(`[JiraDialog] Auto-loading executions for test cycle: ${detection.id}`);
      
      try {
        await this.jiraService.getTestCycleExecutions(detection.id);
        console.log(`[JiraDialog] Auto-loaded ${this.testCycleExecutions().length} executions`);
      } catch (error) {
        console.error('[JiraDialog] Failed to auto-load executions:', error);
      }
    }
  }

  // ================================
  // EVENT HANDLERS
  // ================================

  /**
   * Handle dialog hide event
   */
  public onDialogHide(): void {
    console.log('[JiraDialog] Dialog hiding');
    this.visibleChange.emit(false);
    this.dialogClosed.emit();
    this.resetDialogState();
  }

  /**
   * Handle manual JIRA input change and auto-load executions
   */
  public onJiraInputChange(): void {
    const input = this.jiraInput();
    console.log(`[JiraDialog] JIRA input changed: ${input}`);
    
    // Clear previous state
    this.jiraService.clearTestCycleExecutions();
    this.selectedExecution.set(null);
    
    // Auto-load if it's a test cycle
    this.autoLoadExecutionsIfNeeded(input);
  }

  /**
   * Handle execution row click for selection (SIMPLIFIED)
   */
  public onExecutionRowSelect(execution: TestCycleExecution): void {
    console.log(`[JiraDialog] Execution row clicked: ${execution.key}`);
    
    const current = this.selectedExecution();
    // Toggle selection
    if (current?.id === execution.id) {
      this.selectedExecution.set(null); // Deselect
    } else {
      this.selectedExecution.set(execution); // Select new one
    }
  }

  /**
   * Check if execution is selected (SIMPLIFIED)
   */
  public isExecutionSelected(execution: TestCycleExecution): boolean {
    const current = this.selectedExecution();
    return current?.id === execution.id;
  }

  // ================================
  // ACTION HANDLERS
  // ================================

  /**
   * Perform primary action (SIMPLIFIED)
   */
  public async performPrimaryAction(): Promise<void> {
    const selected = this.selectedExecution();
    const result = this.detectionResult();
    
    if (!result?.isValid) {
      console.error('[JiraDialog] Cannot perform action - invalid input');
      return;
    }

    if (this.mode === 'search') {
      if (selected) {
        // Search specific execution
        this.searchRequested.emit({
          query: selected.key,
          type: 'execution'
        });
      } else {
        // Search the cycle or other JIRA ID
        this.searchRequested.emit({
          query: result.id,
          type: result.type === 'test-cycle' ? 'cycle' : 'execution'
        });
      }
      this.visibleChange.emit(false);
    } else {
      // Upload mode - use your existing upload logic
      await this.performUpload(result, selected);
    }
  }

  /**
   * Perform upload action (keep your existing logic)
   */
  private async performUpload(result: JiraIdDetectionResult, selectedExecution: TestCycleExecution | null): Promise<void> {
    try {
      if (selectedExecution) {
        // Upload to specific execution - replace with your method
        await this.jiraService.uploadToJira(selectedExecution.key, this.transactionData);
      } else {
        // Upload to JIRA ID, test case, or test cycle - replace with your methods
        switch (result.type) {
          case 'jira-id':
            await this.jiraService.uploadToJira(result.id, this.transactionData);
            break;
          case 'test-case':
            await this.jiraService.uploadToJira(result.id, this.transactionData);
            break;
          case 'test-cycle':
            await this.jiraService.uploadToJira(result.id, this.transactionData);
            break;
        }
      }
      
      console.log('[JiraDialog] Upload completed successfully');
    } catch (error) {
      console.error('[JiraDialog] Upload failed:', error);
    }
  }

  /**
   * Clear messages
   */
  public clearMessages(): void {
    // Add this method to your service if it doesn't exist
    // this.jiraService.clearMessages();
  }

  /**
   * Load executions manually
   */
  public async loadExecutions(): Promise<void> {
    const result = this.detectionResult();
    
    if (!result?.isValid || result.type !== 'test-cycle') {
      console.warn('[JiraDialog] Cannot load executions - not a valid test cycle');
      return;
    }

    try {
      await this.jiraService.getTestCycleExecutions(result.id);
      console.log(`[JiraDialog] Manually loaded ${this.testCycleExecutions().length} executions`);
    } catch (error) {
      console.error('[JiraDialog] Failed to load executions:', error);
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Reset dialog state
   */
  private resetDialogState(): void {
    console.log('[JiraDialog] Resetting dialog state');
    this.selectedExecution.set(null);
    this.jiraService.clearTestCycleExecutions();
  }

  /**
   * Track by function for executions table (FIXED)
   */
  public trackByExecutionId = (index: number, execution: TestCycleExecution): number => {
    return execution.id;
  };

  /**
   * Get badge severity for execution status
   */
  public getStatusSeverity(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pass':
      case 'passed':
        return 'success';
      case 'fail':
      case 'failed':
        return 'danger';
      case 'blocked':
        return 'warning';
      case 'todo':
      case 'not executed':
        return 'secondary';
      default:
        return 'info';
    }
  }
}