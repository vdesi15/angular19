import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';


@Injectable({
  providedIn: 'root'
})
export class TransactionShareService {

    private messageService = inject(MessageService);

  /**
   * Copy transaction ID to clipboard
   */
  public async copyTransactionId(transactionId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(transactionId);
      console.log('Transaction ID copied to clipboard:', transactionId);
    } catch (error) {
      throw new Error(`Failed to copy transaction ID: ${error}`);
    }
  }

  /**
   * Copy transaction link to clipboard
   */
  public async copyTransactionLink(transactionId: string, filters: any): Promise<void> {
    try {
      const link = this.buildTransactionLink(transactionId, filters);
      await navigator.clipboard.writeText(link);
      console.log('Transaction link copied to clipboard:', link);
    } catch (error) {
        // Check specific error types
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          this.showErrorMessage('Clipboard access denied. Please click in the page area and try again.');
        } else if (error.name === 'NotFoundError') {
          this.showErrorMessage('Clipboard not available. Please copy manually: ' + transactionId);
        } else {
          this.showErrorMessage('Copy failed. Please ensure the page is active and try again.');
        }
      } else {
        this.showErrorMessage('Failed to copy transaction ID');
      }
      throw new Error(`Failed to copy transaction link: ${error}`);
    }
  }

  /**
   * Show success message
   */
  private showSuccessMessage(detail: string, summary: string = 'Success'): void {
    this.messageService.add({
      severity: 'success',
      summary,
      detail,
      life: 3000
    });
  }

  /**
   * Show error message
   */
  private showErrorMessage(detail: string, summary: string = 'Copy Failed'): void {
    this.messageService.add({
      severity: 'error',
      summary,
      detail,
      life: 5000
    });
  }

  /**
   * Build transaction link URL
   */
  private buildTransactionLink(transactionId: string, filters: any): string {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    
    // Add filter parameters
    if (filters.applications?.length) {
      params.set('applications', filters.applications.join(','));
    }
    
    if (filters.environment) {
      params.set('env', filters.environment);
    }
    
    if (filters.location) {
      params.set('location', filters.location);
    }
    
    // Encode transaction ID with btoa
    const encodedTxnId = btoa(transactionId);
    params.set('searchText', encodedTxnId);
    
    return `${baseUrl}/logs/search?${params.toString()}`;
  }
}