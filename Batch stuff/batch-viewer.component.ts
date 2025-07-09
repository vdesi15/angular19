// batch-viewer.component.ts - Updated with Angular 19 signals and targeted fixes
import { Component, Input, inject, signal, computed, effect, linkedSignal } from '@angular/core';
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
  
  // State - Using Angular 19 signals
  batchData = signal<BatchSSEData[]>([]);
  selectedTimeRange = signal<string>('7d');
  timeRanges = ['7d', '14d', '20d', '60d'];
  
  // Individual accordion expansion state - Fix for issue #2
  accordionStates = signal<Map<string, boolean>>(new Map());
  
  // Editor dialog
  showEditorDialog = signal(false);
  editorContent = signal<any>(null);
  editorTitle = signal('');
  
  selectedGroupColumns = signal<string[]>([]);
  
  // Streaming state for header display - Fix for issue #6
  isStopButtonHovered = signal(false);
  
  // LinkedSignal - tracks batch data from search (Angular 19 feature)
  batchDataLinked = linkedSignal(() => this.search?.batchData || []);
  
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

  // Computed for filterable columns - Fix for issue #5
  filterableColumns = computed(() => 
    this.summaryColumns().filter(col => col.enableFiltering === true)
  );

  constructor() {
    // Fix for issue #1: Update batch data when search data changes
    effect(() => {
      if (this.search?.batchData) {
        console.log('[BatchViewer] New batch data detected:', this.search.batchData.length);
        this.batchData.set([...this.search.batchData]); // Create new array reference
        
        // Reset accordion states for new data
        const newStates = new Map<string, boolean>();
        this.search.batchData.forEach(data => {
          newStates.set(data.api_txnid, false); // Start collapsed
        });
        this.accordionStates.set(newStates);
      }
    });

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

  // Fix for issue #2: Individual accordion control
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

  getAccordionTitle(data: BatchSSEData): string {
    const localTime = new Date(data.time).toLocaleString();
    return `[${localTime}] ${data.api_name} VLine:${data.v_line} Min:${data.min} UG:${data.good_u} MG:${data.good_m} All Rules Passed:${data.all_rules_passed}`;
  }

  // Fix for issue #4: Enhanced accordion class with better color handling
  getAccordionClass(data: BatchSSEData): string {
    return data.all_rules_passed ? 'batch-accordion-success' : 'batch-accordion-error';
  }

  getAccordionHeaderStyle(data: BatchSSEData): any {
    const baseStyle = {
      borderLeft: `4px solid ${data.all_rules_passed ? '#28a745' : '#dc3545'}`,
      backgroundColor: data.all_rules_passed 
        ? 'rgba(40, 167, 69, 0.1)' 
        : 'rgba(220, 53, 69, 0.1)'
    };
    return baseStyle;
  }

  getRuleCellClass(passed: boolean): string {
    return passed ? 'rule-pass' : 'rule-fail';
  }

  getFieldValue(obj: any, field: string): any {
    return field.split('.').reduce((current, key) => current?.[key], obj);
  }

  openMessageEditor(message: string): void {
    this.editorTitle.set('Rule Message');
    this.editorContent.set(message);
    this.showEditorDialog.set(true);
  }

  // Fix for issue #6: Streaming control methods (similar to SSE implementation)
  stopStreaming(event: Event): void {
    event.stopPropagation();
    this.orchestrator.stopSseStream(this.search.id);
  }

  // Methods for summary table filtering (Fix for issue #5)
  onColumnFilter(event: Event, field: string): void {
    // This will be handled by p-table's built-in filtering
    console.log(`[BatchViewer] Filter applied on field: ${field}`);
  }

  // Track by function for better performance
  trackByTxnId(index: number, item: BatchSSEData): string {
    return item.api_txnid;
  }

  trackByField(index: number, col: any): string {
    return col.id || col.field;
  }
}