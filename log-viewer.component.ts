import { Component, computed, EventEmitter, inject, Input, Output, Signal, WritableSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { SortIcon } from 'primeng/icons/sort';
import { ActiveSearch, ElkHit } from '../../models/search.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';
import { ViewDefinitionService } from 'src/app/core/services/view-definition.service';
import { TransformPipe } from 'src/app/core/pipes/transform.pipe';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';

@Component({
  selector: 'app-log-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, InputTextModule, SortIcon, TransformPipe],
  templateUrl: './log-viewer.component.html',
  styleUrls: ['./log-viewer.component.scss']
})
export class LogViewerComponent {
  @Input({ required: true }) searchInstance!: ActiveSearch;
  @Input({ required: true }) allColumnsForViewType: ColumnDefinition[] = [];
  @Input({ required: true }) viewId!: string;
  @Output() rowDrilldown = new EventEmitter<any>();

  private viewDefService = inject(ViewDefinitionService);
  public globalFilter: WritableSignal<string> = signal('');

  public activeColumns: Signal<ColumnDefinition[]> = computed(() => {
    const selectedViewId = this.viewId;
    if (!selectedViewId) return this.allColumnsForViewType.filter(c => c.visible);
    return this.allColumnsForViewType.filter(col => col.views.split(',').map(v => v.trim()).includes(selectedViewId));
  });

  public processedData: Signal<{ data: any[], filteredCount: number }> = computed(() => {
    const columns = this.activeColumns();
    const hits = this.searchInstance.data as ElkHit[] ?? [];
    const filterValue = this.globalFilter().toLowerCase();

    let tableRows = hits.map(hit => {
      const row: any = { _original: hit._source };
      columns.forEach(col => { row[col.name] = get(hit._source, col.field, 'N/A'); });
      return row;
    });

    if (filterValue) {
      tableRows = tableRows.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(filterValue)));
    }
    
    return { data: tableRows, filteredCount: tableRows.length };
  });

  handleRowClick(rowData: any) {
    const drilldownQuery = rowData._original?.user?.id;
    if (drilldownQuery) this.rowDrilldown.emit(drilldownQuery);
  }
  
  createFilterFunction(filterStr: string): (source: any) => boolean {
    const safeFilterStr = filterStr.replace(/\$_source/g, 'source');
    return new Function('source', `try { return ${safeFilterStr}; } catch { return false; }`) as (source: any) => boolean;
  }
}