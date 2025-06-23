@Injectable({ providedIn: 'root' })
export class TransactionSearchStrategy implements SearchStrategy {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  canHandle(query: any): boolean {
    return typeof query === 'string' && query.length > 10; // Basic transaction ID check
  }

  getStrategyName(): string {
    return 'TransactionSearch';
  }

  execute(
    transactionId: string, 
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[] = [],
    preFilter?: string
  ): Observable<TransactionSearchResponse> {
    const apiEndpoints = this.configService.get('api');
    const url = apiEndpoints.transactionSearch || '/api/search/transaction';

    const params = {
      transactionId,
      applications: globalFilters.application?.join(',') || '',
      environment: globalFilters.environment || '',
      location: globalFilters.location || '',
      startDate: globalFilters.dateRange?.startDate?.toISOString() || '',
      endDate: globalFilters.dateRange?.endDate?.toISOString() || '',
      preFilter: preFilter || '',
      streamFilters: this.serializeStreamFilters(streamFilters)
    };

    console.log(`[TransactionSearchStrategy] Executing search for transaction: ${transactionId}`);
    
    return this.http.get<TransactionSearchResponse>(url, { params });
  }

  private serializeStreamFilters(filters: StreamFilter[]): string {
    return filters.map(f => `${f.field}:${f.values.join('|')}`).join(',');
  }
}