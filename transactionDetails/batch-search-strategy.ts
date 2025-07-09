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
}