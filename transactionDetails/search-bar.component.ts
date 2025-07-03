// src/app/features/search-logs/components/search-bar/search-bar.component.ts
import { Component, EventEmitter, Output, inject, signal, computed, WritableSignal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

// PrimeNG Modules
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

// Services
import { SearchQueryDetectionService, QueryDetectionResult } from '../services/search-query-detection.service';
import { SearchOrchestratorService } from '../services/search-orchestrator.service';
import { SearchFilterService } from 'src/app/core/services/filters.service';
import { EnhancedJiraService, TestCycleExecution } from '../services/enhanced-jira.service';

// Components
import { FavoritesPopoverComponent } from 'src/app/core/components/search-favorites/search-favorites.component';
import { JiraUploadDialogComponent } from '../components/jira-upload-dialog/jira-upload-dialog.component';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputGroupModule,
    InputTextModule,
    ButtonModule,
    TooltipModule,
    FavoritesPopoverComponent,
    JiraUploadDialogComponent
  ],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent {
  @Output() search = new EventEmitter<string>();

  private queryDetectionService = inject(SearchQueryDetectionService);
  private searchOrchestrator = inject(SearchOrchestratorService);
  private searchFilterService = inject(SearchFilterService);
  private jiraService = inject(EnhancedJiraService);
  private route = inject(ActivatedRoute);

  // ================================
  // STATE SIGNALS
  // ================================

  public searchQuery: WritableSignal<string> = signal('');
  public isSearching: WritableSignal<boolean> = signal(false);
  public showJiraExecutionDialog: WritableSignal<boolean> = signal(false);
  public testCycleId: WritableSignal<string> = signal('');
  public testCycleExecutions: WritableSignal<TestCycleExecution[]> = signal([]);

  // ================================
  // COMPUTED SIGNALS
  // ================================

  public detectionResult = computed(() => {
    const query = this.searchQuery();
    if (!query.trim()) return null;
    return this.queryDetectionService.detectQueryType(query);
  });

  public isValidQuery = computed(() => {
    const result = this.detectionResult();
    return result ? this.queryDetectionService.isValidDetection(result) : false;
  });

  public searchButtonIcon = computed(() => {
    const result = this.detectionResult();
    if (!result) return 'pi pi-search';
    
    switch (result.type) {
      case 'transaction': return 'pi pi-sitemap';
      case 'jira': return 'pi pi-ticket';
      case 'batch': return 'pi pi-clone';
      case 'natural': return 'pi pi-comment';
      default: return 'pi pi-search';
    }
  });

  public getSearchTooltip = computed(() => {
    const result = this.detectionResult();
    if (!result) return 'Enter a search query';
    
    const confidence = Math.round(result.confidence * 100);
    const type = this.queryDetectionService.getQueryTypeDescription(result);
    
    return `Search ${type} (${confidence}% confidence)`;
  });

  // ================================
  // EFFECTS & INITIALIZATION
  // ================================

  constructor() {
    // Listen for URL parameters to handle JIRA context
    effect(() => {
      this.route.queryParams.subscribe(params => {
        this.handleUrlParameters(params);
      });
    });
  }

  // ================================
  // EVENT HANDLERS
  // ================================

  /**
   * Handle search input changes
   */
  public onInputChange(value: string): void {
    this.searchQuery.set(value);
  }

  /**
   * Execute the search
   */
  public executeSearch(): void {
    const query = this.searchQuery().trim();
    if (!query) return;

    const result = this.detectionResult();
    if (!result) {
      console.warn('[SearchBar] No detection result for query:', query);
      return;
    }

    this.isSearching.set(true);

    try {
      this.handleSearchByType(result, query);
    } catch (error) {
      console.error('[SearchBar] Search execution failed:', error);
      this.isSearching.set(false);
    }
  }

  /**
   * Handle search based on detected type
   */
  private async handleSearchByType(result: QueryDetectionResult, query: string): Promise<void> {
    switch (result.type) {
      case 'transaction':
        await this.handleTransactionSearch(query);
        break;
        
      case 'jira':
        await this.handleJiraSearch(result);
        break;
        
      case 'batch':
      case 'natural':
        await this.handleRegularSearch(result, query);
        break;
        
      default:
        await this.handleRegularSearch(result, query);
    }
  }

  /**
   * Handle transaction ID search
   */
  private async handleTransactionSearch(transactionId: string): Promise<void> {
    const globalFilters = this.searchFilterService.filters();
    
    if (!this.validateGlobalFilters(globalFilters)) {
      console.error('[SearchBar] Global filters required for transaction search');
      this.isSearching.set(false);
      return;
    }

    // Use existing search orchestrator
    await this.searchOrchestrator.performSearch({
      type: 'transaction',
      query: transactionId,
      title: `Transaction: ${transactionId.substring(0, 12)}...`,
      appName: globalFilters?.application?.[0] || ''
    });

    this.isSearching.set(false);
  }

  /**
   * Handle JIRA search
   */
  private async handleJiraSearch(result: QueryDetectionResult): Promise<void> {
    const jiraDetection = this.jiraService.detectJiraId(result.extractedValue);
    
    if (!jiraDetection.isValid) {
      console.error('[SearchBar] Invalid JIRA format:', result.extractedValue);
      this.isSearching.set(false);
      return;
    }

    // Handle test cycles specially - show execution selection dialog
    if (jiraDetection.type === 'test-cycle') {
      await this.showTestCycleExecutionDialog(jiraDetection.id);
      this.isSearching.set(false);
      return;
    }

    // For regular JIRA IDs, test cases, and executions
    await this.searchOrchestrator.performSearch({
      type: 'jira',
      query: jiraDetection.id,
      title: `JIRA: ${jiraDetection.id}`,
      appName: '', // JIRA searches don't require app name
      metadata: {
        jiraType: jiraDetection.type,
        detectionResult: jiraDetection
      }
    });

    this.isSearching.set(false);
  }

  /**
   * Handle regular search (batch, natural language, etc.)
   */
  private async handleRegularSearch(result: QueryDetectionResult, query: string): Promise<void> {
    await this.searchOrchestrator.performSearch({
      type: result.type as any,
      query: result.extractedValue,
      title: `${result.type}: ${result.extractedValue}`,
      appName: '',
      metadata: {
        detectionResult: result,
        originalQuery: query
      }
    });

    this.isSearching.set(false);
  }

  /**
   * Show test cycle execution selection dialog
   */
  private async showTestCycleExecutionDialog(testCycleId: string): Promise<void> {
    try {
      const executions = await this.jiraService.getTestCycleExecutions(testCycleId);
      
      this.testCycleId.set(testCycleId);
      this.testCycleExecutions.set(executions);
      this.showJiraExecutionDialog.set(true);
      
    } catch (error) {
      console.error('[SearchBar] Failed to load test cycle executions:', error);
    }
  }

  /**
   * Handle execution dialog close
   */
  public onExecutionDialogClose(): void {
    this.showJiraExecutionDialog.set(false);
    this.testCycleId.set('');
    this.testCycleExecutions.set([]);
  }

  /**
   * Handle Enter key press
   */
  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.executeSearch();
    }
  }

  // ================================
  // URL PARAMETER HANDLING
  // ================================

  /**
   * Handle URL parameters for JIRA context
   */
  private handleUrlParameters(params: any): void {
    const jiraid = params['jiraid'];
    const searchText = params['searchText'];

    if (jiraid && searchText) {
      // Handle JIRA with current ID navigation
      const decodedJiraId = this.safeBase64Decode(jiraid);
      const decodedSearchText = this.safeBase64Decode(searchText);
      
      if (decodedJiraId && decodedSearchText) {
        this.handleJiraWithCurrentId(decodedJiraId, decodedSearchText);
      }
    } else if (jiraid) {
      // Handle regular JIRA search
      const decodedJiraId = this.safeBase64Decode(jiraid);
      if (decodedJiraId) {
        this.searchQuery.set(decodedJiraId);
      }
    } else if (searchText) {
      // Handle regular transaction search
      const decodedSearchText = this.safeBase64Decode(searchText);
      if (decodedSearchText) {
        this.searchQuery.set(decodedSearchText);
      }
    }
  }

  /**
   * Handle JIRA search with current ID (timeline navigation)
   */
  private async handleJiraWithCurrentId(jiraId: string, currentId: string): Promise<void> {
    await this.searchOrchestrator.performSearch({
      type: 'jira',
      query: jiraId,
      title: `JIRA: ${jiraId} - ${currentId.substring(0, 12)}...`,
      appName: '',
      metadata: {
        currentId,
        isTimelineNavigation: true
      }
    });
  }

  /**
   * Safe base64 decode with error handling
   */
  private safeBase64Decode(encoded: string): string | null {
    try {
      return atob(encoded);
    } catch (error) {
      console.warn('[SearchBar] Failed to decode base64:', encoded);
      return null;
    }
  }

  // ================================
  // VALIDATION HELPERS
  // ================================

  /**
   * Validate that required global filters are set for transaction search
   */
  private validateGlobalFilters(globalFilters: any): boolean {
    return !!(
      globalFilters?.application?.length &&
      globalFilters?.environment &&
      globalFilters?.location
    );
  }
}