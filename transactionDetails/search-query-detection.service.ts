import { Injectable } from '@angular/core';

export type QueryType = 'transaction' | 'jira' | 'batch' | 'natural' | 'unknown';

export interface QueryDetectionResult {
  type: QueryType;
  confidence: number;
  extractedValue: string;
  metadata?: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class SearchQueryDetectionService {
  
  /**
   * Analyzes the input query and determines its type
   */
  public detectQueryType(query: string): QueryDetectionResult {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      return { type: 'unknown', confidence: 0, extractedValue: '' };
    }

    // 1. Transaction ID Detection
    const transactionResult = this.detectTransactionId(trimmedQuery);
    if (transactionResult.confidence > 0.8) {
      return transactionResult;
    }

    // 2. JIRA ID Detection
    const jiraResult = this.detectJiraId(trimmedQuery);
    if (jiraResult.confidence > 0.8) {
      return jiraResult;
    }

    // 3. Batch ID Detection
    const batchResult = this.detectBatchId(trimmedQuery);
    if (batchResult.confidence > 0.8) {
      return batchResult;
    }

    // 4. Natural Language Detection (fallback for longer queries)
    const naturalResult = this.detectNaturalLanguage(trimmedQuery);
    if (naturalResult.confidence > 0.5) {
      return naturalResult;
    }

    return { type: 'unknown', confidence: 0, extractedValue: trimmedQuery };
  }

  /**
   * Detects transaction IDs (UUIDs, GUIDs, long alphanumeric strings)
   */
  private detectTransactionId(query: string): QueryDetectionResult {
    // UUID/GUID pattern (8-4-4-4-12 format)
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    // Alternative GUID patterns (without dashes)
    const guidNoHyphensPattern = /^[0-9a-fA-F]{32}$/;
    
    // Long alphanumeric transaction IDs (20+ characters)
    const longAlphaNumericPattern = /^[a-zA-Z0-9]{20,}$/;
    
    // Short alphanumeric with specific prefixes (trace_, txn_, etc.)
    const prefixedTransactionPattern = /^(trace_|txn_|transaction_|tr_)[a-zA-Z0-9]{8,}$/i;

    if (uuidPattern.test(query)) {
      return {
        type: 'transaction',
        confidence: 0.95,
        extractedValue: query.toLowerCase(),
        metadata: { format: 'uuid' }
      };
    }

    if (guidNoHyphensPattern.test(query)) {
      return {
        type: 'transaction',
        confidence: 0.9,
        extractedValue: query.toLowerCase(),
        metadata: { format: 'guid_no_hyphens' }
      };
    }

    if (longAlphaNumericPattern.test(query)) {
      return {
        type: 'transaction',
        confidence: 0.85,
        extractedValue: query,
        metadata: { format: 'long_alphanumeric' }
      };
    }

    if (prefixedTransactionPattern.test(query)) {
      return {
        type: 'transaction',
        confidence: 0.9,
        extractedValue: query,
        metadata: { format: 'prefixed_transaction' }
      };
    }

    return { type: 'unknown', confidence: 0, extractedValue: query };
  }

  /**
   * Detects JIRA ticket IDs (PROJECT-123 format)
   */
  private detectJiraId(query: string): QueryDetectionResult {
    // Standard JIRA pattern: 2-10 uppercase letters, hyphen, 1-6 digits
    const jiraPattern = /^([A-Z]{2,10})-(\d{1,6})$/;
    
    // More flexible pattern for variations
    const flexibleJiraPattern = /^([A-Za-z]{2,10})[-_](\d{1,6})$/;

    const standardMatch = query.match(jiraPattern);
    if (standardMatch) {
      return {
        type: 'jira',
        confidence: 0.95,
        extractedValue: query.toUpperCase(),
        metadata: { 
          project: standardMatch[1],
          ticketNumber: standardMatch[2],
          format: 'standard'
        }
      };
    }

    const flexibleMatch = query.match(flexibleJiraPattern);
    if (flexibleMatch) {
      return {
        type: 'jira',
        confidence: 0.8,
        extractedValue: `${flexibleMatch[1].toUpperCase()}-${flexibleMatch[2]}`,
        metadata: { 
          project: flexibleMatch[1].toUpperCase(),
          ticketNumber: flexibleMatch[2],
          format: 'flexible'
        }
      };
    }

    return { type: 'unknown', confidence: 0, extractedValue: query };
  }

  /**
   * Detects batch IDs (5-8 character alphanumeric)
   */
  private detectBatchId(query: string): QueryDetectionResult {
    // 5-8 character alphanumeric pattern
    const batchPattern = /^[a-zA-Z0-9]{5,8}$/;
    
    // Batch with common prefixes
    const prefixedBatchPattern = /^(batch_|bt_|b_)?([a-zA-Z0-9]{5,8})$/i;

    if (batchPattern.test(query)) {
      return {
        type: 'batch',
        confidence: 0.8,
        extractedValue: query.toUpperCase(),
        metadata: { format: 'standard' }
      };
    }

    const prefixedMatch = query.match(prefixedBatchPattern);
    if (prefixedMatch) {
      return {
        type: 'batch',
        confidence: 0.85,
        extractedValue: prefixedMatch[2].toUpperCase(),
        metadata: { 
          format: 'prefixed',
          prefix: prefixedMatch[1] || ''
        }
      };
    }

    return { type: 'unknown', confidence: 0, extractedValue: query };
  }

  /**
   * Detects natural language queries
   */
  private detectNaturalLanguage(query: string): QueryDetectionResult {
    // Check for natural language indicators
    const naturalLanguageIndicators = [
      'show me', 'find', 'search for', 'get', 'list', 'display',
      'errors', 'transactions', 'logs', 'between', 'from', 'to',
      'where', 'when', 'how many', 'what', 'why', 'which'
    ];

    const hasSpaces = query.includes(' ');
    const wordCount = query.split(/\s+/).length;
    const hasNaturalIndicators = naturalLanguageIndicators.some(indicator => 
      query.toLowerCase().includes(indicator)
    );

    if (hasSpaces && wordCount >= 3) {
      const confidence = hasNaturalIndicators ? 0.8 : 0.6;
      return {
        type: 'natural',
        confidence,
        extractedValue: query,
        metadata: { 
          wordCount,
          hasNaturalIndicators,
          indicators: naturalLanguageIndicators.filter(indicator => 
            query.toLowerCase().includes(indicator)
          )
        }
      };
    }

    return { type: 'unknown', confidence: 0, extractedValue: query };
  }

  /**
   * Get human-readable description of the detected query type
   */
  public getQueryTypeDescription(result: QueryDetectionResult): string {
    switch (result.type) {
      case 'transaction':
        return `Transaction ID (${result.metadata?.format || 'standard'})`;
      case 'jira':
        return `JIRA Ticket (${result.metadata?.project}-${result.metadata?.ticketNumber})`;
      case 'batch':
        return `Batch ID (${result.extractedValue})`;
      case 'natural':
        return 'Natural Language Query';
      default:
        return 'Unknown Query Type';
    }
  }

  /**
   * Validate if a detected query meets minimum confidence threshold
   */
  public isValidDetection(result: QueryDetectionResult, minimumConfidence: number = 0.7): boolean {
    return result.confidence >= minimumConfidence;
  }
}