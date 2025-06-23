@Injectable({ providedIn: 'root' })
export class NaturalLanguageSearchStrategy implements SearchStrategy {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  canHandle(query: any, context?: QueryDetectionResult): boolean {
    return context?.type === 'natural' || this.isNaturalLanguage(query);
  }

  getStrategyName(): string {
    return 'NaturalLanguageSearch';
  }

  private isNaturalLanguage(query: string): boolean {
    return query.includes(' ') && query.split(' ').length >= 3;
  }

  execute(
    naturalQuery: string, 
    globalFilters: SearchFilterModel,
    streamFilters: StreamFilter[] = [],
    preFilter?: string
  ): Observable<SearchDataResponse> {
    // For now, return a placeholder response
    console.log(`[NaturalLanguageSearchStrategy] AI search requested: "${naturalQuery}"`);
    
    // TODO: Integrate with AI service (OpenAI, Claude, etc.)
    const placeholderResponse: SearchDataResponse = {
      hits: [],
      total: 0,
      aggregations: {
        aiResponse: {
          message: "AI search integration coming soon! This feature will allow natural language queries like 'show me errors from the last hour' or 'find transactions for user john.doe'.",
          suggestedQueries: [
            "Try a transaction ID (UUID format)",
            "Try a JIRA ticket (PROJ-123 format)", 
            "Try a batch ID (5-8 alphanumeric characters)"
          ]
        }
      }
    };

    return of(placeholderResponse);
  }
}