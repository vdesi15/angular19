import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import JSZip from 'jszip';

export interface JiraAttachmentResponse {
  id: string;
  filename: string;
  author: {
    accountId: string;
    displayName: string;
  };
  created: string;
  size: number;
  mimeType: string;
}

export interface JiraIssueResponse {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
  };
}

export interface JiraConfig {
  baseUrl: string;
  username?: string;
  apiToken?: string;
  authHeader?: string;
}

@Injectable({
  providedIn: 'root'
})
export class JiraAttachmentService {
  private http = inject(HttpClient);
  private messageService = inject(MessageService);

  // Configuration - you can set this from environment or config service
  private jiraConfig: JiraConfig = {
    baseUrl: '/api/jira', // Your backend proxy endpoint
    // For direct JIRA API (if not using backend proxy):
    // baseUrl: 'https://your-domain.atlassian.net',
    // username: 'your-email@company.com',
    // apiToken: 'your-api-token'
  };

  /**
   * Attach transaction data to JIRA ticket
   */
  public async attachTransactionToJira(jiraId: string, data: any[]): Promise<JiraAttachmentResponse> {
    if (!jiraId?.trim()) {
      throw new Error('JIRA ID is required');
    }

    if (!data?.length) {
      throw new Error('No transaction data to attach');
    }

    try {
      // Step 1: Validate JIRA ticket exists
      await this.validateJiraTicket(jiraId);

      // Step 2: Create attachment file
      const attachmentBlob = await this.createJiraAttachment(data);
      
      // Step 3: Upload to JIRA
      const response = await this.uploadToJiraAPI(jiraId, attachmentBlob);
      
      this.showSuccessMessage(`Transaction data attached to JIRA ticket: ${jiraId}`);
      return response;
      
    } catch (error) {
      this.handleError('Failed to attach to JIRA', error);
      throw error;
    }
  }

  /**
   * Validate that JIRA ticket exists and is accessible
   */
  public async validateJiraTicket(jiraId: string): Promise<JiraIssueResponse> {
    try {
      const headers = this.getAuthHeaders();
      const url = `${this.jiraConfig.baseUrl}/rest/api/3/issue/${jiraId}`;
      
      const response = await firstValueFrom(
        this.http.get<JiraIssueResponse>(url, { headers })
      );
      
      console.log(`[JiraService] Ticket ${jiraId} validated:`, response.fields.summary);
      return response;
      
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 404) {
          throw new Error(`JIRA ticket ${jiraId} not found`);
        } else if (error.status === 401 || error.status === 403) {
          throw new Error('Authentication failed - check JIRA credentials');
        }
      }
      throw new Error(`Failed to validate JIRA ticket: ${error}`);
    }
  }

  /**
   * Create JIRA attachment file from transaction data
   */
  private async createJiraAttachment(data: any[]): Promise<Blob> {
    const zip = new JSZip();
    let fileCount = 0;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    // Process each transaction row
    for (const [index, row] of data.entries()) {
      const messageBody = this.getNestedValue(row, '_source.message.body');
      const actionXml = this.getNestedValue(row, '_source.message.action.xml');
      const transactionId = this.getNestedValue(row, '_source.transactionId') || 
                           this.getNestedValue(row, '_source.id') || 
                           `transaction_${index + 1}`;
      
      if (messageBody || actionXml) {
        fileCount++;
        const fileName = `${transactionId}_${fileCount}.txt`;
        const content = this.combineMessageContent(messageBody, actionXml, row);
        zip.file(fileName, content);
      }
    }

    // Add summary file
    const summary = this.createSummaryFile(data, fileCount);
    zip.file('transaction_summary.txt', summary);

    if (fileCount === 0) {
      throw new Error('No message content found for JIRA attachment');
    }

    console.log(`[JiraService] Created attachment with ${fileCount} transaction files`);
    return await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }

  /**
   * Upload attachment to JIRA API
   */
  private async uploadToJiraAPI(jiraId: string, attachmentBlob: Blob): Promise<JiraAttachmentResponse> {
    const formData = new FormData();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `transaction_data_${timestamp}.zip`;
    
    formData.append('file', attachmentBlob, filename);

    // JIRA API requires specific headers for file upload
    const headers = new HttpHeaders({
      'X-Atlassian-Token': 'no-check', // Required by JIRA to prevent CSRF
      ...this.getAuthHeaders(false) // Don't include Content-Type for FormData
    });

    const url = `${this.jiraConfig.baseUrl}/rest/api/3/issue/${jiraId}/attachments`;

    try {
      const response = await firstValueFrom(
        this.http.post<JiraAttachmentResponse[]>(url, formData, { headers })
      );
      
      if (response && response.length > 0) {
        console.log(`[JiraService] Successfully uploaded ${filename} to ${jiraId}`);
        return response[0]; // JIRA returns array of attachments
      } else {
        throw new Error('No attachment response received from JIRA');
      }
      
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        console.error('[JiraService] Upload failed:', error.error);
        
        if (error.status === 413) {
          throw new Error('Attachment too large - reduce transaction data size');
        } else if (error.status === 403) {
          throw new Error('Permission denied - check JIRA attachment permissions');
        }
      }
      throw new Error(`JIRA upload failed: ${error}`);
    }
  }

  /**
   * Combine message body, action XML, and metadata
   */
  private combineMessageContent(messageBody: any, actionXml: any, row: any): string {
    let content = '';
    const timestamp = new Date().toISOString();
    
    // Header with metadata
    content += '=' .repeat(80) + '\n';
    content += `TRANSACTION DATA EXPORT\n`;
    content += `Generated: ${timestamp}\n`;
    content += `Transaction ID: ${this.getNestedValue(row, '_source.transactionId') || 'N/A'}\n`;
    content += `Timestamp: ${this.getNestedValue(row, '_source.timestamp') || 'N/A'}\n`;
    content += `Application: ${this.getNestedValue(row, '_source.application') || 'N/A'}\n`;
    content += `Environment: ${this.getNestedValue(row, '_source.environment') || 'N/A'}\n`;
    content += '=' .repeat(80) + '\n\n';
    
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
      '_source.status',
      '_source.duration',
      '_source.user',
      '_source.endpoint',
      '_source.correlationId'
    ];

    for (const field of additionalFields) {
      const value = this.getNestedValue(row, field);
      if (value !== null && value !== undefined) {
        const fieldName = field.split('.').pop()?.toUpperCase();
        content += `${fieldName}: ${value}\n`;
      }
    }
    
    return content || 'No content available';
  }

  /**
   * Create summary file with transaction statistics
   */
  private createSummaryFile(data: any[], fileCount: number): string {
    const timestamp = new Date().toISOString();
    let summary = '';
    
    summary += '=' .repeat(80) + '\n';
    summary += `TRANSACTION DATA SUMMARY\n`;
    summary += `Generated: ${timestamp}\n`;
    summary += '=' .repeat(80) + '\n\n';
    
    summary += `Total Transactions: ${data.length}\n`;
    summary += `Files with Content: ${fileCount}\n`;
    summary += `Export Date: ${new Date().toLocaleDateString()}\n\n`;
    
    // Application breakdown
    const apps = new Map<string, number>();
    const envs = new Map<string, number>();
    
    for (const row of data) {
      const app = this.getNestedValue(row, '_source.application') || 'Unknown';
      const env = this.getNestedValue(row, '_source.environment') || 'Unknown';
      
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

  /**
   * Get authentication headers for JIRA API
   */
  private getAuthHeaders(includeContentType: boolean = true): { [key: string]: string } {
    const headers: { [key: string]: string } = {};
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Option 1: Use custom auth header (if provided by backend)
    if (this.jiraConfig.authHeader) {
      headers['Authorization'] = this.jiraConfig.authHeader;
    } 
    // Option 2: Basic auth with username/token
    else if (this.jiraConfig.username && this.jiraConfig.apiToken) {
      const auth = btoa(`${this.jiraConfig.username}:${this.jiraConfig.apiToken}`);
      headers['Authorization'] = `Basic ${auth}`;
    }
    
    return headers;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return null;

    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Show success message
   */
  private showSuccessMessage(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'JIRA Upload Successful',
      detail: message,
      life: 5000
    });
  }

  /**
   * Handle and display errors
   */
  private handleError(summary: string, error: any): void {
    console.error(`[JiraService] ${summary}:`, error);
    
    let detail = 'Please try again or contact support.';
    if (error instanceof Error) {
      detail = error.message;
    } else if (typeof error === 'string') {
      detail = error;
    }
    
    this.messageService.add({
      severity: 'error',
      summary,
      detail,
      life: 7000
    });
  }

  /**
   * Update JIRA configuration
   */
  public updateConfig(config: Partial<JiraConfig>): void {
    this.jiraConfig = { ...this.jiraConfig, ...config };
  }

  /**
   * Test JIRA connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const headers = this.getAuthHeaders();
      const url = `${this.jiraConfig.baseUrl}/rest/api/3/myself`;
      
      await firstValueFrom(this.http.get(url, { headers }));
      
      this.showSuccessMessage('JIRA connection test successful');
      return true;
      
    } catch (error) {
      this.handleError('JIRA connection test failed', error);
      return false;
    }
  }
}