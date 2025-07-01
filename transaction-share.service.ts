import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TransactionShareService {

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
      throw new Error(`Failed to copy transaction link: ${error}`);
    }
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