// batch-viewer.component.ts - TARGETED FIX for data flow issue + UI improvements
import { Component, Input, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { ActiveSearch } from '../../models/search.model';
import { BatchSSEData } from '../../models/batch-sse.model';
import { ColumnDefinitionService } from '../../services/column-definition.service';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';
import { EditorDialogComponent } from '../editor-dialog/editor-dialog.component';
import { TransformPipe } from 'src/app/shared/pipes/transform.pipe';
import { UrlBuilderService } from 'src/app/shared/services/url-builder.service';
import { get } from 'lodash-es';

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
  
  selectedGroupColumns = signal<string[]>([]);
  
  // Streaming state for header display
  isStopButtonHovered = signal(false);
  
  availableGroupColumns = computed(() => {
    const summaryColDefs = this.summaryColumns();
    
    return summaryColDefs
      .filter(col => col.groupable === true)
      .map(col => ({
        label: col.displayName,
        value: col.field
      }));
  });

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

  // Computed properties for template binding (fix Angular parsing error)
  globalFilterFields = computed(() => 
    this.filterableColumns().map(col => col.field)
  );

  constructor() {
    console.log('[BatchViewer] Constructor called');
    
    // TARGETED FIX: Subscribe to orchestrator's activeSearches signal to track the specific search
    effect(() => {
      // Get the current search from orchestrator's signal by ID
      const allSearches = this.orchestrator.activeSearches();
      const currentSearch = allSearches.find(s => s.id === this.search?.id);
      const batchDataArray = currentSearch?.batchData;
      
      console.log('[BatchViewer] Effect triggered - Search ID:', currentSearch?.id);
      console.log('[BatchViewer] BatchData length:', batchDataArray?.length);
      console.log('[BatchViewer] BatchData reference:', batchDataArray);
      
      if (batchDataArray && batchDataArray.length > 0) {
        console.log('[BatchViewer] ✅ Processing batch data:', batchDataArray.length);
        console.log('[BatchViewer] Latest item:', batchDataArray[batchDataArray.length - 1]);
        
        // Set the data
        this.batchData.set([...batchDataArray]);
        
        // FIXED: Only initialize accordion states for completely new data, don't update existing ones
        const currentStates = this.accordionStates();
        const hasAnyStates = currentStates.size > 0;
        
        if (!hasAnyStates) {
          // First time loading - initialize all states
          const newStates = new Map<string, boolean>();
          batchDataArray.forEach(data => {
            newStates.set(data.api_txnid, false);
          });
          this.accordionStates.set(newStates);
          console.log('[BatchViewer] ✅ Initialized accordion states for first load');
        } else {
          // Subsequent loads - only add missing states, don't modify existing ones
          const needsUpdate = batchDataArray.some(data => !currentStates.has(data.api_txnid));
          
          if (needsUpdate) {
            const updatedStates = new Map(currentStates);
            batchDataArray.forEach(data => {
              if (!updatedStates.has(data.api_txnid)) {
                updatedStates.set(data.api_txnid, false);
              }
            });
            this.accordionStates.set(updatedStates);
            console.log('[BatchViewer] ✅ Added new accordion states only');
          }
        }
        
        console.log('[BatchViewer] ✅ Updated batchData signal to:', this.batchData().length);
      } else if (batchDataArray?.length === 0 || !batchDataArray) {
        console.log('[BatchViewer] ❌ No valid batch data or empty array');
        // Only clear if we have existing data and this is truly empty (not initial state)
        if (this.batchData().length > 0 && batchDataArray?.length === 0) {
          this.batchData.set([]);
          this.accordionStates.set(new Map());
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
        this.selectedGroupColumns.set(defaultGroups);
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
    
    console.log(`[BatchViewer] Toggled accordion ${txnId}: ${!currentState}`);
  }

  isAccordionExpanded(txnId: string): boolean {
    return this.accordionStates().get(txnId) || false;
  }

  onTimeRangeClick(range: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.selectedTimeRange.set(range);
    
    // Stop current SSE and start new one with different days parameter
    this.orchestrator.stopSseStream(this.search.id);
    
    // Create new search with updated days
    const days = range.replace('d', '');
    this.orchestrator.performBatchSearch({
      query: this.search.query,
      title: this.search.title,
      appName: this.search.appName,
      days: days
    });
  }

  // IMPROVED: Professional accordion title with bold API name
  getAccordionTitle(data: BatchSSEData): string {
    const localTime = new Date(data.time).toLocaleString();
    const allRulesPassed = this.calculateAllRulesPassed(data);
    return `[${localTime}] ${data.api_name} VLine:${data.v_line} Min:${data.min} UG:${data.good_u} MG:${data.good_m} All Rules Passed:${allRulesPassed}`;
  }

  // NEW: Calculate all rules passed based on actual rules data
  calculateAllRulesPassed(data: BatchSSEData): boolean {
    if (!data.rules || data.rules.length === 0) {
      return data.all_rules_passed; // fallback to original value
    }
    
    // Check if all rules have pass: true
    return data.rules.every(rule => rule.pass === true);
  }

  // IMPROVED: Professional accordion styling
  getAccordionClass(data: BatchSSEData): string {
    const allRulesPassed = this.calculateAllRulesPassed(data);
    return allRulesPassed ? 'batch-accordion-success' : 'batch-accordion-error';
  }

  getAccordionHeaderStyle(data: BatchSSEData): any {
    const allRulesPassed = this.calculateAllRulesPassed(data);
    const baseStyle = {
      borderLeft: `4px solid ${allRulesPassed ? '#28a745' : '#dc3545'}`,
      backgroundColor: allRulesPassed 
        ? 'rgba(40, 167, 69, 0.1)' 
        : 'rgba(220, 53, 69, 0.1)',
      padding: '12px 16px',
      borderRadius: '6px',
      marginBottom: '2px'
    };
    return baseStyle;
  }

  getRuleCellClass(passed: boolean): string {
    return passed ? 'rule-pass' : 'rule-fail';
  }

  getFieldValue(obj: any, field: string): any {
    return get(obj, field);
  }

  // NEW: Build search link using the reusable URL builder service
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

  // State for table filtering
  private ruleFilters = signal<Map<string, string>>(new Map());
  private aggFilters = signal<Map<string, string>>(new Map());
  private summaryFilters = signal<Map<string, string>>(new Map());

  // Filtered data computed signals
  filteredRules = computed(() => {
    const filters = this.ruleFilters();
    if (filters.size === 0) return [];
    
    const currentData = this.batchData().find(data => data.rules)?.rules || [];
    
    return currentData.filter(rule => {
      return Array.from(filters.entries()).every(([field, filterValue]) => {
        if (!filterValue.trim()) return true;
        const fieldValue = this.getFieldValue(rule, field)?.toString().toLowerCase() || '';
        return fieldValue.includes(filterValue.toLowerCase());
      });
    });
  });

  filteredAgg = computed(() => {
    const filters = this.aggFilters();
    if (filters.size === 0) return [];
    
    const currentData = this.batchData().find(data => data.agg)?.agg || [];
    
    return currentData.filter(agg => {
      return Array.from(filters.entries()).every(([field, filterValue]) => {
        if (!filterValue.trim()) return true;
        const fieldValue = this.getFieldValue(agg, field)?.toString().toLowerCase() || '';
        return fieldValue.includes(filterValue.toLowerCase());
      });
    });
  });

  filteredSummary = computed(() => {
    const filters = this.summaryFilters();
    if (filters.size === 0) return [];
    
    const currentData = this.batchData().find(data => data.summary)?.summary || [];
    
    return currentData.filter(summary => {
      return Array.from(filters.entries()).every(([field, filterValue]) => {
        if (!filterValue.trim()) return true;
        const fieldValue = this.getFieldValue(summary, field)?.toString().toLowerCase() || '';
        return fieldValue.includes(filterValue.toLowerCase());
      });
    });
  });

  // Filter methods with actual implementation
  onRuleFilter(event: Event, field: string): void {
    const value = (event.target as HTMLInputElement).value;
    console.log(`[BatchViewer] Rule filter applied on ${field}:`, value);
    
    const currentFilters = new Map(this.ruleFilters());
    if (value.trim()) {
      currentFilters.set(field, value);
    } else {
      currentFilters.delete(field);
    }
    this.ruleFilters.set(currentFilters);
  }

  onAggFilter(event: Event, field: string): void {
    const value = (event.target as HTMLInputElement).value;
    console.log(`[BatchViewer] Aggregation filter applied on ${field}:`, value);
    
    const currentFilters = new Map(this.aggFilters());
    if (value.trim()) {
      currentFilters.set(field, value);
    } else {
      currentFilters.delete(field);
    }
    this.aggFilters.set(currentFilters);
  }

  onSummaryFilter(event: Event, field: string): void {
    const value = (event.target as HTMLInputElement).value;
    console.log(`[BatchViewer] Summary filter applied on ${field}:`, value);
    
    const currentFilters = new Map(this.summaryFilters());
    if (value.trim()) {
      currentFilters.set(field, value);
    } else {
      currentFilters.delete(field);
    }
    this.summaryFilters.set(currentFilters);
  }

  // Get the correct data source for tables (filtered or original)
  getRulesData(data: BatchSSEData) {
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

  getAggData(data: BatchSSEData) {
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

  getSummaryData(data: BatchSSEData) {
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

  calculateGroupTotal(data: BatchSSEData, summary: any): number {
    if (!data.summary || this.selectedGroupColumns().length === 0) {
      return 0;
    }
    
    const groupField = this.selectedGroupColumns()[0];
    const groupValue = get(summary, groupField);
    
    return data.summary.filter(s => get(s, groupField) === groupValue).length;
  }
}