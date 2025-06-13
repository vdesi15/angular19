import { Component, Input, computed, inject, WritableSignal, signal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { ResultsToolbarComponent } from './results-toolbar/results-toolbar.component';
import { LogViewerComponent } from './log-viewer/log-viewer.component';
import { TableSkeletonComponent } from 'src/app/shared/components/table-skeleton/table-skeleton.component';
import { ActiveSearch } from '../../models/search.model';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';
import { FiltersService } from 'src/app/core/services/filters.service';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';

@Component({
  selector: 'app-result-host',
  standalone: true,
  imports: [CommonModule, AccordionModule, ResultsToolbarComponent, LogViewerComponent, TableSkeletonComponent],
  templateUrl: './result-host.component.html'
})
export class ResultHostComponent {
  @Input({ required: true }) search!: ActiveSearch;
  
  private colDefService = inject(ColumnDefinitionService);
  private viewDefService = inject(ViewDefinitionService);
  private orchestrator = inject(SearchOrchestratorService);

  public columns: Signal<ColumnDefinition[]> = computed(() => this.colDefService.getColumnsFor(this.search.appName, this.search.type));
  public availableViews: Signal<ViewDefinition[]> = computed(() => this.viewDefService.getViewsForApp(this.search.appName));
  public selectedViewId: WritableSignal<string> = signal('');
  
  constructor() {
    const defaultView = this.availableViews().find(v => v.default);
    if (defaultView) this.selectedViewId.set(defaultView.viewId);
  }

  onDrilldown(query: any): void {
    this.orchestrator.performSearch({
      type: 'transaction',
      query: query,
      title: `Transaction: ${query}`,
      appName: this.search.appName
    });
  }
}