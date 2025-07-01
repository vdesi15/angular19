import { Injectable } from '@angular/core';
import JSZip from 'jszip';

@Injectable({
  providedIn: 'root'
})
export class JiraAttachmentService {

  /**
   * Attach transaction data to JIRA ticket
   */
  public async attachTransactionToJira(jiraId: string, data: any[]): Promise<void> {
    if (!jiraId?.trim()) {
      throw new Error('JIRA ID is required');
    }

    if (!data?.length) {
      throw new Error('No transaction data to attach');
    }

    try {
      // Create attachment file
      const attachmentBlob = await this.createJiraAttachment(data);
      
      // Upload to JIRA (implement your JIRA API logic here)
      await this.uploadToJiraAPI(jiraId, attachmentBlob);
      
      console.log(`Transaction data attached to JIRA ticket: ${jiraId}`);
    } catch (error) {
      throw new Error(`Failed to attach to JIRA: ${error}`);
    }
  }

  /**
   * Create JIRA attachment file
   */
  private async createJiraAttachment(data: any[]): Promise<Blob> {
    const zip = new JSZip();
    let fileCount = 0;

    for (const row of data) {
      const messageBody = this.getNestedValue(row, '_source.message.body');
      const actionXml = this.getNestedValue(row, '_source.message.action.xml');
      
      if (messageBody || actionXml) {
        fileCount++;
        const fileName = `jira_transaction_${fileCount}.txt`;
        const content = this.combineMessageContent(messageBody, actionXml);
        zip.file(fileName, content);
      }
    }

    if (fileCount === 0) {
      throw new Error('No message content found for JIRA attachment');
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Upload to JIRA API (implement your JIRA integration)
   */
  private async uploadToJiraAPI(jiraId: string, attachmentBlob: Blob): Promise<void> {
    // TODO: Implement your JIRA API integration here
    // This is a placeholder for your JIRA upload logic
    
    const formData = new FormData();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    formData.append('file', attachmentBlob, `transaction_data_${timestamp}.zip`);
    
    // Example JIRA API call (adjust to your JIRA setup):
    // const response = await fetch(`/api/jira/issue/${jiraId}/attachments`, {
    //   method: 'POST',
    //   body: formData,
    //   headers: {
    //     'Authorization': 'Bearer YOUR_JIRA_TOKEN'
    //   }
    // });
    
    // For now, simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`Simulated JIRA upload for ticket: ${jiraId}`);
  }

  /**
   * Combine message body and action XML
   */
  private combineMessageContent(messageBody: any, actionXml: any): string {
    let content = '';
    
    if (messageBody) {
      content += '=== Message Body ===\n';
      content += typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody, null, 2);
      content += '\n\n';
    }
    
    if (actionXml) {
      content += '=== Action XML ===\n';
      content += typeof actionXml === 'string' ? actionXml : JSON.stringify(actionXml, null, 2);
    }
    
    return content || 'No content available';
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