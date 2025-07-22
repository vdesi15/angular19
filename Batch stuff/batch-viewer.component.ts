// batch-viewer.component.ts - Enhanced with Angular 19 signals and fixes
import { Component, Input, inject, signal, computed, effect, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { ActiveSearch } from '../../models/search.model';
import { BatchSSEData } from '../../models/batch-sse.model';
import { ColumnDefinitionService } from '../../services/column-definition.service';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';
import { EditorDialogComponent } from '../editor-dialog/editor-dialog.component';
import { TransformPipe } from 'src/app/shared/pipes/transform.pipe';
import { UrlBuilderService } from 'src/app/shared/services/url-builder.service';
import { get, groupBy } from 'lodash-es';

@Component({
  selector: 'app-batch-viewer',
  standalone: true,
  imports: [
    CommonModule,
    AccordionModule,
    TableModule,
    TagModule,
    MultiSelectModule,
    ButtonModule,
    DialogModule,
    TooltipModule,
    InputTextModule,
    EditorDialogComponent,
    TransformPipe
  ],
  templateUrl: './batch-viewer.component.html',
  styleUrls: ['./batch-viewer.component.scss']
})
export class BatchViewerComponent {
  @Input({ required: true }) search!: ActiveSearch;

  private orchestrator = inject(SearchOrchestratorService);
  private colDefService = inject(ColumnDefinitionService);
  private urlBuilder = inject(UrlBuilderService);
  
  // State - Using Angular 19 signals
  batchData = signal<BatchSSEData[]>([]);
  selectedTimeRange = signal<string>('7d');
  timeRanges = ['7d', '14d', '20d', '60d'];
  
  // Individual accordion expansion state
  accordionStates = signal<Map<string, boolean>>(new Map());
  
  // Editor dialog
  showEditorDialog = signal(false);
  editorContent = signal<any>(null);
  editorTitle = signal('');
  
  selectedGroupColumns: WritableSignal<string[]> = signal([]);
  
  // Streaming state for header display
  isStopButtonHovered = signal(false);
  
  // Filter signals - using WritableSignal for proper reactivity
  private ruleFilters: WritableSignal<Map<string, string>> = signal(new Map());
  private aggFilters: WritableSignal<Map<string, string>> = signal(new Map());
  private summaryFilters: WritableSignal<Map<string, string>> = signal(new Map());
  
  // Available group columns
  availableGroupColumns = computed(() => {
    const summaryColDefs = this.summaryColumns();
    
    return summaryColDefs
      .filter(col => col.groupable === true)
      .map(col => ({
        label: col.displayName,
        value: col.field
      }));
  });

  // Get group columns for specific accordion
  getGroupColumnsForAccordion(txnId: string): string[] {
    return this.selectedGroupColumns().get(txnId) || [];
  }

  // Set group columns for specific accordion
  setGroupColumnsForAccordion(txnId: string, columns: string[]): void {
    this.selectedGroupColumns.update(map => {
      const newMap = new Map(map);
      if (columns.length === 0) {
        newMap.delete(txnId);
      } else {
        newMap.set(txnId, columns);
      }
      return newMap;
    });
  }

  // Column definitions from API
  rulesColumns = computed(() => 
    this.colDefService.getTableDefinition('UMTableDefinition_Rules') || []
  );
  
  aggColumns = computed(() => 
    this.colDefService.getTableDefinition('UMTableDefinition_Aggs') || []
  );
  
  summaryColumns = computed(() => 
    this.colDefService.getTableDefinition('UMTableDefinition_Summary') || []
  );

  // Computed for filterable columns
  filterableColumns = computed(() => 
    this.summaryColumns().filter(col => col.enableFiltering === true)
  );

  // Computed properties for template binding
  globalFilterFields = computed(() => 
    this.filterableColumns().map(col => col.field)
  );

  // Grouped summary data with proper filtering and grouping
  groupedSummaryData = computed(() => {
    const allSummaryData: any[] = [];
    this.batchData().forEach(batch => {
      if (batch.summary) {
        allSummaryData.push(...batch.summary);
      }
    });

    // Apply filters first
    const filters = this.summaryFilters();
    const filteredData = filters.size === 0 ? allSummaryData : 
      allSummaryData.filter(summary => {
        return Array.from(filters.entries()).every(([field, filterValue]) => {
          if (!filterValue.trim()) return true;
          const fieldValue = this.getFieldValue(summary, field)?.toString().toLowerCase() || '';
          return fieldValue.includes(filterValue.toLowerCase());
        });
      });

    // If no group columns selected, return all rows
    const groupColumns = this.selectedGroupColumns();
    if (groupColumns.length === 0) {
      return [{ key: 'All Data', data: filteredData }];
    }

    // Group by selected columns
    const grouped = groupBy(filteredData, (item) => {
      return groupColumns.map(col => get(item, col)).join(' | ');
    });

    return Object.entries(grouped).map(([key, data]) => ({ key, data }));
  });

  constructor() {
    // Data subscription effect - keeping your preferred way
    effect(() => {
      // Get the current search from orchestrator's signal by ID
      const allSearches = this.orchestrator.activeSearches();
      const currentSearch = allSearches.find(s => s.id === this.search?.id);
      const batchDataArray = currentSearch?.batchData;
      
      console.log('[BatchViewer] 🔄 Data effect triggered:', batchDataArray?.length || 0, 'items');
      
      if (batchDataArray?.length > 0) {
        this.batchData.set([...batchDataArray]);
        
        // Update accordion states for new items only
        const currentStates = this.accordionStates();
        const needsUpdate = batchDataArray.some(data => !currentStates.has(data.api_txnid));
        
        if (needsUpdate) {
          const updatedStates = new Map(currentStates);
          batchDataArray.forEach(data => {
            if (!updatedStates.has(data.api_txnid)) {
              updatedStates.set(data.api_txnid, false);
            }
          });
          this.accordionStates.set(updatedStates);
        }
      }
    });

    // Set default group columns
    effect(() => {
      const summaryColDefs = this.summaryColumns();
      const defaultGroups = summaryColDefs
        .filter(col => col.defaultGroup === true)
        .map(col => col.field);
        
      if (defaultGroups.length > 0) {
        // Don't auto-set defaults, let user choose
      }
    });
  }

  // Individual accordion control
  toggleAccordion(txnId: string, event: Event): void {
    event.stopPropagation();
    const currentStates = new Map(this.accordionStates());
    const currentState = currentStates.get(txnId) || false;
    currentStates.set(txnId, !currentState);
    this.accordionStates.set(currentStates);
  }

  // Time range selection with proper orchestrator call
  selectTimeRange(range: string): void {
    this.selectedTimeRange.set(range);
    // Use your existing orchestrator method
    this.orchestrator.triggerBatchSearch(this.search.id, range);
  }

  // Accordion state utilities
  isAccordionExpanded(txnId: string): boolean {
    return this.accordionStates().get(txnId) || false;
  }

  calculateAllRulesPassed(data: BatchSSEData): boolean {
    if (!data.rules || data.rules.length === 0) return true;
    return data.rules.every(rule => rule.passed === true);
  }

  getAccordionClass(data: BatchSSEData): string {
    const allRulesPassed = this.calculateAllRulesPassed(data);
    return allRulesPassed ? 'batch-accordion-success' : 'batch-accordion-error';
  }

  getRuleCellClass(passed: boolean): string {
    return passed ? 'rule-pass' : 'rule-fail';
  }

  getFieldValue(obj: any, field: string): any {
    return get(obj, field);
  }

  buildTransactionSearchLink(txnId: string): string {
    return this.urlBuilder.buildSearchLink(txnId);
  }

  openMessageEditor(message: string): void {
    this.editorTitle.set('Rule Message');
    this.editorContent.set(message);
    this.showEditorDialog.set(true);
  }

  stopStreaming(event: Event): void {
    event.stopPropagation();
    this.orchestrator.stopSseStream(this.search.id);
  }

  // FIXED: Filter methods with proper WritableSignal updates
  onRuleFilter(event: Event, field: string): void {
    const value = (event.target as HTMLInputElement).value;
    console.log(`[BatchViewer] Rule filter applied on ${field}:`, value);
    
    this.ruleFilters.update(currentFilters => {
      const newFilters = new Map(currentFilters);
      if (value.trim()) {
        newFilters.set(field, value);
      } else {
        newFilters.delete(field);
      }
      return newFilters;
    });
  }

  onAggFilter(event: Event, field: string): void {
    const value = (event.target as HTMLInputElement).value;
    console.log(`[BatchViewer] Aggregation filter applied on ${field}:`, value);
    
    this.aggFilters.update(currentFilters => {
      const newFilters = new Map(currentFilters);
      if (value.trim()) {
        newFilters.set(field, value);
      } else {
        newFilters.delete(field);
      }
      return newFilters;
    });
  }

  onSummaryFilter(event: Event, field: string): void {
    const value = (event.target as HTMLInputElement).value;
    console.log(`[BatchViewer] Summary filter applied on ${field}:`, value);
    
    this.summaryFilters.update(currentFilters => {
      const newFilters = new Map(currentFilters);
      if (value.trim()) {
        newFilters.set(field, value);
      } else {
        newFilters.delete(field);
      }
      return newFilters;
    });
  }

  // FIXED: Data methods with proper filtering
  getRulesData(data: BatchSSEData): any[] {
    const filters = this.ruleFilters();
    if (filters.size === 0) return data.rules || [];
    
    return (data.rules || []).filter(rule => {
      return Array.from(filters.entries()).every(([field, filterValue]) => {
        if (!filterValue.trim()) return true;
        const fieldValue = this.getFieldValue(rule, field)?.toString().toLowerCase() || '';
        return fieldValue.includes(filterValue.toLowerCase());
      });
    });
  }

  getAggData(data: BatchSSEData): any[] {
    const filters = this.aggFilters();
    if (filters.size === 0) return data.agg || [];
    
    return (data.agg || []).filter(agg => {
      return Array.from(filters.entries()).every(([field, filterValue]) => {
        if (!filterValue.trim()) return true;
        const fieldValue = this.getFieldValue(agg, field)?.toString().toLowerCase() || '';
        return fieldValue.includes(filterValue.toLowerCase());
      });
    });
  }

  getSummaryData(data: BatchSSEData): any[] {
    const filters = this.summaryFilters();
    if (filters.size === 0) return data.summary || [];
    
    return (data.summary || []).filter(summary => {
      return Array.from(filters.entries()).every(([field, filterValue]) => {
        if (!filterValue.trim()) return true;
        const fieldValue = this.getFieldValue(summary, field)?.toString().toLowerCase() || '';
        return fieldValue.includes(filterValue.toLowerCase());
      });
    });
  }

  // Track by function for better performance
  trackByTxnId(index: number, item: BatchSSEData): string {
    return item.api_txnid;
  }

  trackByField(index: number, col: any): string {
    return col.id || col.field;
  }

  trackByGroupKey(index: number, group: any): string {
    return group.key;
  }

  calculateGroupTotal(data: BatchSSEData, summary: any, txnId: string): number {
    if (!data.summary) {
      return 0;
    }
    
    const groupColumns = this.getGroupColumnsForAccordion(txnId);
    if (groupColumns.length === 0) {
      return 0;
    }
    
    const groupField = groupColumns[0];
    const groupValue = get(summary, groupField);
    
    return data.summary.filter(s => get(s, groupField) === groupValue).length;
  }
}