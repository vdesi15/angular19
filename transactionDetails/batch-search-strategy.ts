@Injectable({ providedIn: 'root' })
export class BatchSearchStrategy implements SearchStrategy {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  canHandle(query: any, context?: QueryDetectionResult): boolean {
    return context?.type === 'batch' || this.isBatchFormat(query);
  }

  getStrategyName(): string {
    return 'BatchSearch';
  }

  private isBatchFormat(query: string): boolean {
    return /^[a-zA-Z0-9]{5,8}$/.test(query);
  }

  execute(
    batchId: string, 
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[] = [],
    preFilter?: string
  ): Observable<BatchSearchResponse> {
    const apiEndpoints = this.configService.get('api');
    const url = apiEndpoints.batchSearch || '/api/search/batch';

    const params = {
      batchId: batchId.toUpperCase(),
      applications: globalFilters.application?.join(',') || '',
      environment: globalFilters.environment || '',
      location: globalFilters.location || '',
      startDate: globalFilters.dateRange?.startDate?.toISOString() || '',
      endDate: globalFilters.dateRange?.endDate?.toISOString() || '',
      preFilter: preFilter || '',
      streamFilters: this.serializeStreamFilters(streamFilters)
    };

    console.log(`[BatchSearchStrategy] Executing search for batch: ${batchId}`);
    
    return this.http.get<BatchSearchResponse>(url, { params });
  }

  private serializeStreamFilters(filters: StreamFilter[]): string {
    return filters.map(f => `${f.field}:${f.values.join('|')}`).join(',');
  }
}