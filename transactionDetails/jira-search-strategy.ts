@Injectable({ providedIn: 'root' })
export class JiraSearchStrategy implements SearchStrategy {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  canHandle(query: any, context?: QueryDetectionResult): boolean {
    return context?.type === 'jira' || this.isJiraFormat(query);
  }

  getStrategyName(): string {
    return 'JiraSearch';
  }

  private isJiraFormat(query: string): boolean {
    return /^[A-Z]{2,10}-\d{1,6}$/i.test(query);
  }

  execute(
    jiraId: string, 
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[] = [],
    preFilter?: string
  ): Observable<JiraSearchResponse> {
    const apiEndpoints = this.configService.get('api');
    const url = apiEndpoints.jiraSearch || '/api/search/jira';

    const params = {
      jiraId: jiraId.toUpperCase(),
      applications: globalFilters.application?.join(',') || '',
      environment: globalFilters.environment || '',
      location: globalFilters.location || '',
      startDate: globalFilters.dateRange?.startDate?.toISOString() || '',
      endDate: globalFilters.dateRange?.endDate?.toISOString() || '',
      preFilter: preFilter || '',
      streamFilters: this.serializeStreamFilters(streamFilters)
    };

    console.log(`[JiraSearchStrategy] Executing search for JIRA: ${jiraId}`);
    
    return this.http.get<JiraSearchResponse>(url, { params });
  }

  private serializeStreamFilters(filters: StreamFilter[]): string {
    return filters.map(f => `${f.field}:${f.values.join('|')}`).join(',');
  }
}