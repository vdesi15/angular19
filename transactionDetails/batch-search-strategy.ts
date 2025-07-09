@Injectable({ providedIn: 'root' })
export class BatchSearchStrategy implements SearchStrategy {
  private sseService = inject(SseService);

  canHandle(query: any): boolean {
    if (typeof query !== 'string') return false;
    // Check if length is between 5-9 characters
    const trimmed = query.trim();
    return trimmed.length >= 5 && trimmed.length <= 9;
  }

  getStrategyName(): string {
    return 'BatchSSEStreaming';
  }

  execute(
    batchId: string,
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[],
    preFilter?: string
  ): Observable<any> {
    // Override the connect method to use batch-specific endpoint
    return this.sseService.connectBatch(batchId, globalFilters);
  }

  handleUrlParams(params: Record<string, string>): any {
    const searchText = params['searchText'];
    
    if (searchText) {
      const decodedText = this.safeBase64Decode(searchText);
      
      // Check if it looks like a batch ID
      if (decodedText && this.canHandle(decodedText)) {
        return {
          searchQuery: decodedText,
          searchType: 'batch',
          metadata: {
            fromUrl: true,
            originalParam: 'searchText'
          },
          shouldTriggerSearch: true
        };
      }
    }
    
    return null;
  }

  updateUrlForSearch(query: string, currentParams: Record<string, string>): Record<string, string> {
    const updatedParams = { ...currentParams };
    
    // Add encoded batch ID
    updatedParams['searchText'] = btoa(query);
    
    // Remove other search-specific params
    delete updatedParams['jiraId'];
    
    return updatedParams;
  }

  cleanupUrlParams(currentParams: Record<string, string>): Record<string, string> {
    const cleanedParams = { ...currentParams };
    delete cleanedParams['searchText'];
    delete cleanedParams['jiraId'];
    return cleanedParams;
  }

  // Helper method
  private safeBase64Decode(encoded: string): string | null {
    try {
      return atob(encoded);
    } catch (error) {
      console.warn('[BatchSseStrategy] Failed to decode base64:', encoded);
      return null;
    }
  }
}