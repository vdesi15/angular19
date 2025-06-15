import { Component, Input, computed, inject, WritableSignal, signal, Signal, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// --- Models ---
import { ActiveSearch } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';

// --- Services ---
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';

// --- Child Components ---
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TransactionToolbarComponent } from './transaction-toolbar/transaction-toolbar.component';
import { StreamingToolbarComponent } from './streaming-toolbar/streaming-toolbar.component';
import { LogViewerComponent } from './log-viewer/log-viewer.component';
import { TableSkeletonComponent } from 'src/app/shared/components/table-skeleton/table-skeleton.component';

@Component({
  selector: 'app-search-result',
  standalone: true,
  imports: [
    CommonModule,
    AccordionModule,
    ButtonModule,
    TooltipModule,
    TransactionToolbarComponent,
    StreamingToolbarComponent,
    LogViewerComponent,
    TableSkeletonComponent
  ],
  templateUrl: './search-result.component.html',
  styleUrls: ['./search-result.component.scss']
})
export class SearchResultComponent implements AfterViewInit {
  @Input({ required: true }) search!: ActiveSearch;

  // Get a reference to the child LogViewerComponent to interact with it
  @ViewChild(LogViewerComponent) private logViewer?: LogViewerComponent;

  // --- Injected Services ---
  private colDefService = inject(ColumnDefinitionService);
  private viewDefService = inject(ViewDefinitionService);
  private orchestrator = inject(SearchOrchestratorService);

  // --- State Signals ---
  public selectedViewId: WritableSignal<string> = signal('');
  
  // --- Derived Signals ---
  public allColumnsForViewType: Signal<ColumnDefinition[]> = computed(() => {
    const app = this.search.appName;
    let viewType: 'browse' | 'error';

    // ✨ THE FIX: Map the search type to an allowed column definition type. ✨
    // If the search is for a 'transaction', we'll use the 'browse' column set.
    if (this.search.type === 'transaction') {
      viewType = 'browse'; 
    } else {
      // Otherwise, the type ('browse' or 'error') matches directly.
      viewType = this.search.type;
    }
    
    return this.colDefService.getColumnsFor(app, viewType);
  });
  
  public availableViews: Signal<ViewDefinition[]> = computed(() => {
    return this.viewDefService.getViewsForApp(this.search.appName);
  });
  
  ngAfterViewInit(): void {
    // After the view initializes, set the default view.
    // We do this here to ensure availableViews() has a value.
    const defaultView = this.availableViews().find(v => v.default);
    if (defaultView) {
      this.selectedViewId.set(defaultView.viewId);
    }
  }

  /**
   * Called when a row is clicked in the LogViewerComponent (for drill-down).
   * It tells the orchestrator to start a new search.
   */
  onDrilldown(query: any): void {
    this.orchestrator.performSearch({
      type: 'transaction',
      query: query,
      title: `Transaction: ${query}`,
      appName: this.search.appName
    });
  }

  /**
   * Resets the visible columns in the LogViewer back to the API default.
   */
  resetColumns(): void {
    this.logViewer?.resetColumnsToDefault();
  }

  /**
   * Closes this specific accordion panel.
   */
  closePanel(): void {
    this.orchestrator.closeSearch(this.search.id);
  }

  /**
   * Toggles the expanded/collapsed state of this accordion panel.
   */
  toggleExpansion(): void {
    this.orchestrator.updateSearchState(this.search.id, {
      isExpanded: !this.search.isExpanded
    });
  }
}