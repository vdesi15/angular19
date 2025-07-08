@Injectable()
export abstract class BaseSearchStrategy implements SearchStrategy {
  
  // 🆕 Strategy-specific execution tracking
  private executing = signal(new Set<string>());
  private results = signal(new Map<string, any>());
  private lastExecutionTime = signal(new Map<string, number>());
  
  // Abstract methods that each strategy must implement
  abstract canHandle(query: any, context?: any): boolean;
  abstract getStrategyName(): string;
  abstract execute(query: string, globalFilters: any, streamFilters?: any[], preFilter?: any): Observable<any>;

  // =====================================
  // EXECUTION GATING IMPLEMENTATION
  // =====================================

  public canSearch(searchKey: string): boolean {
    const executing = this.executing();
    const results = this.results();
    const lastTime = this.lastExecutionTime();
    
    // Don't execute if already in progress
    if (executing.has(searchKey)) {
      console.log(`[${this.getStrategyName()}] Search already in progress: ${searchKey}`);
      return false;
    }
    
    // Don't execute if we have recent execution (within 2 seconds)
    const lastExecution = lastTime.get(searchKey) || 0;
    const now = Date.now();
    if (now - lastExecution < 2000) {
      console.log(`[${this.getStrategyName()}] Recent execution (${now - lastExecution}ms ago), skipping: ${searchKey}`);
      return false;
    }
    
    // Don't execute if we already have fresh results (within 30 seconds)
    if (results.has(searchKey)) {
      const resultTime = lastTime.get(searchKey) || 0;
      if (now - resultTime < 30000) {
        console.log(`[${this.getStrategyName()}] Fresh results exist (${now - resultTime}ms ago), skipping: ${searchKey}`);
        return false;
      }
    }
    
    console.log(`[${this.getStrategyName()}] Can execute search: ${searchKey}`);
    return true;
  }

  public markExecuting(searchKey: string): void {
    console.log(`[${this.getStrategyName()}] Marking as executing: ${searchKey}`);
    this.executing.update(set => new Set([...set, searchKey]));
    this.lastExecutionTime.update(map => new Map([...map, [searchKey, Date.now()]]));
  }

  public markCompleted(searchKey: string, result?: any): void {
    console.log(`[${this.getStrategyName()}] Marking as completed: ${searchKey}`);
    
    this.executing.update(set => {
      const newSet = new Set(set);
      newSet.delete(searchKey);
      return newSet;
    });
    
    if (result !== undefined) {
      this.results.update(map => new Map([...map, [searchKey, result]]));
    }
  }

  public generateSearchKey(query: string, filters: any, currentId?: string): string {
    const baseKey = `${query}`;
    const filterKey = filters ? JSON.stringify(filters) : '';
    const currentIdKey = currentId ? `:${currentId}` : '';
    
    // Create a short hash of the filter key to keep search key manageable
    const filterHash = filterKey ? btoa(filterKey).substring(0, 8) : '';
    
    return `${baseKey}:${filterHash}${currentIdKey}`;
  }

  // =====================================
  // UTILITY METHODS
  // =====================================

  /**
   * Clear all execution state (useful for testing or reset)
   */
  public clearExecutionState(): void {
    console.log(`[${this.getStrategyName()}] Clearing execution state`);
    this.executing.set(new Set());
    this.results.set(new Map());
    this.lastExecutionTime.set(new Map());
  }

  /**
   * Get execution statistics
   */
  public getExecutionStats(): {
    executing: number;
    cached: number;
    lastExecution: number | null;
  } {
    const executing = this.executing().size;
    const cached = this.results().size;
    const times = Array.from(this.lastExecutionTime().values());
    const lastExecution = times.length > 0 ? Math.max(...times) : null;
    
    return { executing, cached, lastExecution };
  }
}