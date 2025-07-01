import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

@Injectable({
  providedIn: 'root'
})
export class TransactionDownloadService {

  /**
   * Download transaction messages as ZIP file
   */
  public async downloadTransactionMessages(data: any[]): Promise<void> {
    if (!data?.length) {
      throw new Error('No transaction data to download');
    }

    const zip = new JSZip();
    let fileCount = 0;

    for (const row of data) {
      const messageBody = this.getNestedValue(row, '_source.message.body');
      const actionXml = this.getNestedValue(row, '_source.message.action.xml');
      
      if (messageBody || actionXml) {
        fileCount++;
        const fileName = `transaction_${fileCount}.txt`;
        const content = this.combineMessageContent(messageBody, actionXml);
        zip.file(fileName, content);
      }
    }

    if (fileCount === 0) {
      throw new Error('No message content found to download');
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    saveAs(blob, `transaction_messages_${timestamp}.zip`);
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