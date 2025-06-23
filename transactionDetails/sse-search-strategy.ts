@Injectable({ providedIn: 'root' })
export class SseStrategy implements SearchStrategy {
  private sseService = inject(any); // Will be injected properly

  canHandle(query: any): boolean {
    return query?.type === 'browse' || query?.type === 'error';
  }

  getStrategyName(): string {
    return 'SseStreaming';
  }

  execute(
    query: { type: 'browse' | 'error' }, 
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[],
    preFilter?: string
  ): Observable<SseEvent> {    
    return this.sseService.connect(query.type, globalFilters, streamFilters, preFilter);
  }
}

// Legacy GUID Search Strategy (for backward compatibility)
@Injectable({ providedIn: 'root' })
export class GuidSearchStrategy implements SearchStrategy {
  private transactionStrategy = inject(TransactionSearchStrategy);

  canHandle(query: string): boolean {
    // UUID pattern or long alphanumeric strings
    return /^[0-9a-fA-F-]{36}$/.test(query) || /^[a-zA-Z0-9]{20,}$/.test(query);
  }

  getStrategyName(): string {
    return 'GuidSearch (Legacy)';
  }

  execute(
    guid: string, 
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[] = [],
    preFilter?: string
  ): Observable<TransactionSearchResponse> {
    // Delegate to the new transaction search strategy
    return this.transactionStrategy.execute(guid, globalFilters, streamFilters, preFilter);
  }
}