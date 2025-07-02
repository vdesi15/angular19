// src/app/features/search-logs/services/enhanced-jira.service.ts
import { Injectable, inject, signal, computed, WritableSignal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import JSZip from 'jszip';
import { get } from 'lodash-es';

// Services
import { SearchFilterService } from 'src/app/core/services/filters.service';
import { TransactionDownloadService } from './transaction-download.service';

// Models
import { TransactionDetailsResponse } from '../models/transactionDetails/transaction-details.model';

// ================================
// INTERFACES & TYPES
// ================================

export interface JiraIdDetectionResult {
  type: 'jira-id' | 'test-case' | 'test-cycle' | 'execution' | 'invalid';
  id: string;
  appName: string;
  number: string;
  isValid: boolean;
  errorMessage?: string;
}

export interface TestCycleExecution {
  id: number;
  testCaseKey: string;
  testcaseUrl: string;
  key: string;
  keyUrl: string;
  status: string;
}

export interface JiraUploadState {
  isUploading: boolean;
  uploadProgress: number;
  successMessage: string;
  errorMessage: string;
  showExecutions: boolean;
  selectedExecutions: number[];
}

export interface JiraConfig {
  baseUrl: string;
  apiEndpoint: string;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedJiraService {
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private searchFilterService = inject(SearchFilterService);
  private downloadService = inject(TransactionDownloadService);

  // Configuration
  private jiraConfig: JiraConfig = {
    baseUrl: '/api', // Your backend API base
    apiEndpoint: '/jira' // JIRA specific endpoints
  };

  // ================================
  // STATE SIGNALS
  // ================================

  private _uploadState: WritableSignal<JiraUploadState> = signal({
    isUploading: false,
    uploadProgress: 0,
    successMessage: '',
    errorMessage: '',
    showExecutions: false,
    selectedExecutions: []
  });

  private _testCycleExecutions: WritableSignal<TestCycleExecution[]> = signal([]);

  // Public readonly signals
  public readonly uploadState = this._uploadState.asReadonly();
  public readonly testCycleExecutions = this._testCycleExecutions.asReadonly();

  // Computed signals
  public readonly hasSelectedExecutions = computed(() => 
    this._uploadState().selectedExecutions.length > 0
  );

  public readonly canUpload = computed(() => 
    !this._uploadState().isUploading
  );

  // ================================
  // JIRA ID DETECTION & PARSING
  // ================================

  /**
   * Detect and parse JIRA ID format from string or URL
   */
  public detectJiraId(input: string): JiraIdDetectionResult {
    if (!input?.trim()) {
      return {
        type: 'invalid',
        id: '',
        appName: '',
        number: '',
        isValid: false,
        errorMessage: 'Please enter a JIRA ID'
      };
    }

    const cleanInput = input.trim();

    // Extract from URL patterns
    const urlResult = this.extractFromUrl(cleanInput);
    if (urlResult) {
      return urlResult;
    }

    // Direct ID patterns
    return this.parseDirectId(cleanInput);
  }

  /**
   * Extract JIRA ID from various URL patterns
   */
  private extractFromUrl(url: string): JiraIdDetectionResult | null {
    // Test cycle URL: http://jira/..../testPlayer/App-C111
    const testCycleMatch = url.match(/\/testPlayer\/([A-Za-z]+)-C(\d+)/i);
    if (testCycleMatch) {
      return {
        type: 'test-cycle',
        id: `${testCycleMatch[1]}-C${testCycleMatch[2]}`,
        appName: testCycleMatch[1],
        number: testCycleMatch[2],
        isValid: true
      };
    }

    // Test case URL: http://jira/..../testcase/App-T111
    const testCaseMatch = url.match(/\/testcase\/([A-Za-z]+)-T(\d+)/i);
    if (testCaseMatch) {
      return {
        type: 'test-case',
        id: `${testCaseMatch[1]}-T${testCaseMatch[2]}`,
        appName: testCaseMatch[1],
        number: testCaseMatch[2],
        isValid: true
      };
    }

    // Regular JIRA URL: http://jira/..../.../App-111
    const jiraMatch = url.match(/\/([A-Za-z]+)-(\d+)(?:\?|$|\/)/i);
    if (jiraMatch) {
      return {
        type: 'jira-id',
        id: `${jiraMatch[1]}-${jiraMatch[2]}`,
        appName: jiraMatch[1],
        number: jiraMatch[2],
        isValid: true
      };
    }

    return null;
  }

  /**
   * Parse direct JIRA ID patterns
   */
  private parseDirectId(id: string): JiraIdDetectionResult {
    // Test cycle: App-C123
    const testCycleMatch = id.match(/^([A-Za-z]+)-C(\d+)$/i);
    if (testCycleMatch) {
      return {
        type: 'test-cycle',
        id: id.toUpperCase(),
        appName: testCycleMatch[1],
        number: testCycleMatch[2],
        isValid: true
      };
    }

    // Test case: App-T123
    const testCaseMatch = id.match(/^([A-Za-z]+)-T(\d+)$/i);
    if (testCaseMatch) {
      return {
        type: 'test-case',
        id: id.toUpperCase(),
        appName: testCaseMatch[1],
        number: testCaseMatch[2],
        isValid: true
      };
    }

    // Execution: App-E123
    const executionMatch = id.match(/^([A-Za-z]+)-E(\d+)$/i);
    if (executionMatch) {
      return {
        type: 'execution',
        id: id.toUpperCase(),
        appName: executionMatch[1],
        number: executionMatch[2],
        isValid: false,
        errorMessage: 'Direct uploads to Executions not supported. Pick a test cycle to upload to execution'
      };
    }

    // Regular JIRA: App-123
    const jiraMatch = id.match(/^([A-Za-z]+)-(\d+)$/i);
    if (jiraMatch) {
      return {
        type: 'jira-id',
        id: id.toUpperCase(),
        appName: jiraMatch[1],
        number: jiraMatch[2],
        isValid: true
      };
    }

    return {
      type: 'invalid',
      id: id,
      appName: '',
      number: '',
      isValid: false,
      errorMessage: 'Invalid JIRA format. Expected formats: APP-123, APP-C123, APP-T123, or valid JIRA URLs'
    };
  }

  // ================================
  // TEST CYCLE OPERATIONS
  // ================================

  /**
   * Get executions for a test cycle
   */
  public async getTestCycleExecutions(testCycleId: string): Promise<TestCycleExecution[]> {
    this._uploadState.update(state => ({
      ...state,
      isUploading: true,
      errorMessage: '',
      successMessage: ''
    }));

    try {
      const url = `${this.jiraConfig.baseUrl}${this.jiraConfig.apiEndpoint}/getTestCycle/getTestCycleExecutions/${testCycleId}`;
      const executions = await firstValueFrom(
        this.http.get<TestCycleExecution[]>(url)
      );

      this._testCycleExecutions.set(executions);
      this._uploadState.update(state => ({
        ...state,
        isUploading: false,
        showExecutions: true
      }));

      return executions;
    } catch (error) {
      this._uploadState.update(state => ({
        ...state,
        isUploading: false,
        errorMessage: `Failed to load test cycle executions: ${error}`
      }));
      throw error;
    }
  }

  /**
   * Toggle execution selection
   */
  public toggleExecutionSelection(executionId: number): void {
    this._uploadState.update(state => {
      const selected = [...state.selectedExecutions];
      const index = selected.indexOf(executionId);
      
      if (index === -1) {
        selected.push(executionId);
      } else {
        selected.splice(index, 1);
      }

      return {
        ...state,
        selectedExecutions: selected
      };
    });
  }

  /**
   * Clear execution selection
   */
  public clearExecutionSelection(): void {
    this._uploadState.update(state => ({
      ...state,
      selectedExecutions: []
    }));
  }

  // ================================
  // UPLOAD OPERATIONS
  // ================================

  /**
   * Upload to JIRA ID (regular ticket)
   */
  public async uploadToJiraId(jiraId: string, transactionData: TransactionDetailsResponse | undefined): Promise<void> {
    await this.performUpload(jiraId, transactionData, `Successfully attached to ${jiraId}`);
  }

  /**
   * Upload to test case
   */
  public async uploadToTestCase(testCaseId: string, transactionData: TransactionDetailsResponse | undefined): Promise<void> {
    await this.performUpload(testCaseId, transactionData, `Successfully attached to test case ${testCaseId}`);
  }

  /**
   * Upload to test cycle
   */
  public async uploadToTestCycle(testCycleId: string, transactionData: TransactionDetailsResponse | undefined): Promise<void> {
    await this.performUpload(testCycleId, transactionData, `Successfully attached to test cycle ${testCycleId}`);
  }

  /**
   * Upload to selected executions
   */
  public async uploadToSelectedExecutions(testCycleId: string, transactionData: TransactionDetailsResponse | undefined): Promise<void> {
    const selectedExecutions = this._uploadState().selectedExecutions;
    if (selectedExecutions.length === 0) {
      throw new Error('No executions selected');
    }

    this._uploadState.update(state => ({
      ...state,
      isUploading: true,
      errorMessage: '',
      successMessage: '',
      uploadProgress: 0
    }));

    try {
      const attachmentBlob = await this.createTransactionZip(transactionData);
      const totalUploads = selectedExecutions.length;
      let completedUploads = 0;

      for (const executionId of selectedExecutions) {
        const uploadId = `${testCycleId}-${executionId}`;
        await this.uploadBlobToJira(uploadId, attachmentBlob);
        
        completedUploads++;
        this._uploadState.update(state => ({
          ...state,
          uploadProgress: Math.round((completedUploads / totalUploads) * 100)
        }));
      }

      this._uploadState.update(state => ({
        ...state,
        isUploading: false,
        successMessage: `Successfully attached to ${completedUploads} executions`,
        uploadProgress: 100
      }));

    } catch (error) {
      this._uploadState.update(state => ({
        ...state,
        isUploading: false,
        errorMessage: `Upload failed: ${error}`
      }));
      throw error;
    }
  }

  /**
   * Generic upload performer
   */
  private async performUpload(jiraId: string, transactionData: TransactionDetailsResponse | undefined, successMessage: string): Promise<void> {
    this._uploadState.update(state => ({
      ...state,
      isUploading: true,
      errorMessage: '',
      successMessage: '',
      uploadProgress: 0
    }));

    try {
      const attachmentBlob = await this.createTransactionZip(transactionData);
      await this.uploadBlobToJira(jiraId, attachmentBlob);

      this._uploadState.update(state => ({
        ...state,
        isUploading: false,
        successMessage,
        uploadProgress: 100
      }));

    } catch (error) {
      this._uploadState.update(state => ({
        ...state,
        isUploading: false,
        errorMessage: `Upload failed: ${error}`
      }));
      throw error;
    }
  }

  /**
   * Upload blob to JIRA API
   */
  private async uploadBlobToJira(jiraId: string, blob: Blob): Promise<void> {
    const formData = new FormData();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `transaction_data_${timestamp}.zip`;
    
    formData.append('file', blob, filename);

    const url = `${this.jiraConfig.baseUrl}${this.jiraConfig.apiEndpoint}/uploadAttachments/${jiraId}`;
    
    await firstValueFrom(
      this.http.post(url, formData)
    );
  }

  /**
   * Create ZIP file from transaction data with custom filename
   */
  private async createTransactionZip(transactionData: TransactionDetailsResponse | undefined): Promise<Blob> {
    if (!transactionData?.hits?.hits?.length) {
      throw new Error('No transaction data found for JIRA attachment');
    }

    // Extract data for filename generation
    const hits = transactionData.hits.hits;
    const firstHit = hits[0];
    const firstRow = firstHit._source;
    
    if (!firstRow) {
      throw new Error('No transaction data found');
    }

    // Generate filename components using get() utility
    const appName = get(firstRow, 'app.name') || 'unknown-app';
    const env = get(firstRow, 'env') || 'unknown-env';
    const eid = get(firstRow, 'e.id') || 'unknown-eid';
    const txnid = get(firstRow, 'id') || 'unknown-txn';
    const action = get(firstRow, 'action.name') || 'unknown-action';
    
    // Get current search filters
    const searchFilters = this.searchFilterService.filters();
    const location = searchFilters?.location || 'unknown-location';
    
    // Generate epoch timestamp
    const epochInSeconds = Math.floor(Date.now() / 1000);
    
    // Create filename: ${appName}_${env}_${location}_${eid}_${epochInSeconds}_${action}_${txnid}.zip
    const filename = `${appName}_${env}_${location}_${eid}_${epochInSeconds}_${action}_${txnid}.zip`;
    
    console.log(`[JiraService] Creating ZIP with filename: ${filename}`);

    // Reuse existing download service logic for ZIP creation
    const zip = new JSZip();
    let fileCount = 0;

    // Process each transaction row using the same logic as download service
    for (const [index, hit] of hits.entries()) {
      const row = hit._source;
      const messageBody = get(row, 'message.body');
      const actionXml = get(row, 'message.action.xml');
      const transactionId = get(row, 'transactionId') || 
                           get(row, 'id') || 
                           `transaction_${index + 1}`;
      
      if (messageBody || actionXml) {
        fileCount++;
        const fileName = `${transactionId}_${fileCount}.txt`;
        const content = this.combineMessageContent(messageBody, actionXml, row);
        zip.file(fileName, content);
      }
    }

    // Add summary file with transaction statistics
    const summary = this.createSummaryFile(hits, fileCount);
    zip.file('transaction_summary.txt', summary);

    if (fileCount === 0) {
      throw new Error('No message content found for JIRA attachment');
    }

    console.log(`[JiraService] Created ZIP with ${fileCount} transaction files`);
    
    return await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }

  /**
   * Combine message content with metadata (reusing download service logic)
   */
  private combineMessageContent(messageBody: any, actionXml: any, row: any): string {
    let content = '';
    const timestamp = new Date().toISOString();
    
    // Header with metadata
    content += '='.repeat(80) + '\n';
    content += `TRANSACTION DATA EXPORT\n`;
    content += `Generated: ${timestamp}\n`;
    content += `Transaction ID: ${get(row, 'transactionId') || 'N/A'}\n`;
    content += `Timestamp: ${get(row, 'timestamp') || 'N/A'}\n`;
    content += `Application: ${get(row, 'application') || 'N/A'}\n`;
    content += `Environment: ${get(row, 'environment') || 'N/A'}\n`;
    content += '='.repeat(80) + '\n\n';
    
    // Message Body Section
    if (messageBody) {
      content += '=== MESSAGE BODY ===\n';
      content += typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody, null, 2);
      content += '\n\n';
    }
    
    // Action XML Section
    if (actionXml) {
      content += '=== ACTION XML ===\n';
      content += typeof actionXml === 'string' ? actionXml : JSON.stringify(actionXml, null, 2);
      content += '\n\n';
    }

    // Additional metadata
    content += '=== ADDITIONAL METADATA ===\n';
    const additionalFields = [
      'status',
      'duration',
      'user',
      'endpoint',
      'correlationId'
    ];

    for (const field of additionalFields) {
      const value = get(row, field);
      if (value !== null && value !== undefined) {
        const fieldName = field.toUpperCase();
        content += `${fieldName}: ${value}\n`;
      }
    }

    return content || 'No content available';
  }

  /**
   * Create summary file with transaction statistics
   */
  private createSummaryFile(hits: any[], fileCount: number): string {
    const timestamp = new Date().toISOString();
    let summary = '';
    
    summary += '='.repeat(80) + '\n';
    summary += `TRANSACTION DATA SUMMARY\n`;
    summary += `Generated: ${timestamp}\n`;
    summary += '='.repeat(80) + '\n\n';
    
    summary += `Total Transactions: ${hits.length}\n`;
    summary += `Files with Content: ${fileCount}\n`;
    summary += `Export Date: ${new Date().toLocaleDateString()}\n\n`;
    
    // Application breakdown
    const apps = new Map<string, number>();
    const envs = new Map<string, number>();
    
    for (const hit of hits) {
      const row = hit._source;
      const app = get(row, 'application') || 'Unknown';
      const env = get(row, 'environment') || 'Unknown';
      
      apps.set(app, (apps.get(app) || 0) + 1);
      envs.set(env, (envs.get(env) || 0) + 1);
    }
    
    summary += 'APPLICATIONS:\n';
    for (const [app, count] of apps.entries()) {
      summary += `  ${app}: ${count}\n`;
    }
    
    summary += '\nENVIRONMENTS:\n';
    for (const [env, count] of envs.entries()) {
      summary += `  ${env}: ${count}\n`;
    }
    
    return summary;
  }

  // ================================
  // STATE MANAGEMENT
  // ================================

  /**
   * Reset state
   */
  public resetState(): void {
    this._uploadState.set({
      isUploading: false,
      uploadProgress: 0,
      successMessage: '',
      errorMessage: '',
      showExecutions: false,
      selectedExecutions: []
    });
    this._testCycleExecutions.set([]);
  }

  /**
   * Clear messages
   */
  public clearMessages(): void {
    this._uploadState.update(state => ({
      ...state,
      successMessage: '',
      errorMessage: ''
    }));
  }
}