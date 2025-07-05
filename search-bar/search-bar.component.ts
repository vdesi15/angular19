// src/app/features/search-logs/components/search-bar/search-bar.component.ts
// ================================
// MINIMAL UPDATES - Just add test cycle dialog integration
// ================================

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
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';
import { SearchFilterService } from 'src/app/core/services/filters.service';
import { EnhancedJiraService, TestCycleExecution } from '../../services/enhanced-jira.service';

// Components - REUSE EXISTING
import { FavoritesPopoverComponent } from 'src/app/core/components/search-favorites/search-favorites.component';
import { JiraUploadDialogComponent } from '../jira-upload-dialog/jira-upload-dialog.component';
import { TestCycleDialogComponent, TestCycleDialogResult } from '../test-cycle-dialog/test-cycle-dialog.component';

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
    JiraUploadDialogComponent,
    TestCycleDialogComponent // ADD NEW COMPONENT
  ],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent {
  @Output() search = new EventEmitter<string>();

  private searchOrchestrator = inject(SearchOrchestratorService);
  private searchFilterService = inject(SearchFilterService);
  private jiraService = inject(EnhancedJiraService);
  private route = inject(ActivatedRoute);

  // ================================
  // STATE SIGNALS
  // ================================

  public searchQuery: WritableSignal<string> = signal('');
  public isSearching: WritableSignal<boolean> = signal(false);
  
  // JIRA Dialog States
  public showJiraUploadDialog: WritableSignal<boolean> = signal(false);
  public showTestCycleDialog: WritableSignal<boolean> = signal(false);
  public currentTestCycleId: WritableSignal<string> = signal('');

  // ================================
  // COMPUTED SIGNALS
  // ================================

  public detectionResult = computed(() => {
    const query = this.searchQuery();
    if (!query.trim()) return null;
    return this.jiraService.detectJiraId(query);
  });

  public isValidQuery = computed(() => {
    const result = this.detectionResult();
    return result ? result.isValid : true;
  });

  public isTestCycle = computed(() => {
    const result = this.detectionResult();
    return result?.isValid && result.type === 'test-cycle';
  });

  // ================================
  // MAIN SEARCH HANDLER - ENHANCED
  // ================================

  public async performSearch(): Promise<void> {
    const query = this.searchQuery();
    if (!query.trim()) return;

    this.isSearching.set(true);

    try {
      const detectionResult = this.detectionResult();
      
      // Handle test cycle specially - show dialog in search mode
      if (detectionResult?.isValid && detectionResult.type === 'test-cycle') {
        await this.handleTestCycleSearch(detectionResult.id);
        return;
      }

      // Handle other search types normally
      await this.handleRegularSearch(query);
      
    } catch (error) {
      console.error('[SearchBar] Search failed:', error);
    } finally {
      this.isSearching.set(false);
    }
  }

  /**
   * Handle test cycle search - show JIRA dialog in search mode
   */
  private async handleTestCycleSearch(testCycleId: string): Promise<void> {
    console.log(`[SearchBar] Handling test cycle search: ${testCycleId}`);
    
    // Set the JIRA input and show dialog in search mode
    this.showJiraUploadDialog.set(true);
    // The effect in the JIRA component will auto-load executions
    
    this.isSearching.set(false);
  }

  /**
   * Handle regular search (non-test-cycle)
   */
  private async handleRegularSearch(query: string): Promise<void> {
    console.log(`[SearchBar] Handling regular search: ${query}`);
    
    // Emit to parent (search-logs component) which will handle strategy detection
    this.search.emit(query.trim());
  }

  // ================================
  // JIRA DIALOG HANDLERS
  // ================================

  /**
   * Handle search request from JIRA dialog
   */
  public onJiraSearchRequested(event: { query: string; type: 'cycle' | 'execution' }): void {
    console.log('[SearchBar] JIRA search requested:', event);
    
    // Emit the search to parent component
    this.search.emit(event.query);
    
    // Close dialog
    this.showJiraUploadDialog.set(false);
  }

  // ================================
  // EXISTING METHODS - KEEP UNCHANGED
  // ================================

  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.performSearch();
    }
  }

  public setSearchTerm(term: string): void {
    this.searchQuery.set(term);
  }

  public clearSearch(): void {
    this.searchQuery.set('');
  }

  public focusInput(): void {
    // Implementation depends on your input reference
  }