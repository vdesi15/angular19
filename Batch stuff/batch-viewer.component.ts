// batch-viewer.component.ts - TARGETED FIX for data flow issue
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

  constructor() {
    console.log('[BatchViewer] Constructor called');
    
    // TARGETED FIX: Use getter-based effect to track property changes
    effect(() => {
      const searchObj = this.search;
      const batchDataArray = searchObj?.batchData;
      
      console.log('[BatchViewer] Effect triggered');
      console.log('[BatchViewer] Search ID:', searchObj?.id);
      console.log('[BatchViewer] BatchData length:', batchDataArray?.length);
      
      if (batchDataArray && batchDataArray.length > 0) {
        console.log('[BatchViewer] ✅ Processing batch data:', batchDataArray.length);
        console.log('[BatchViewer] First item:', batchDataArray[0]);
        
        // Set the data
        this.batchData.set([...batchDataArray]);
        
        // Reset accordion states for new data
        const newStates = new Map<string, boolean>();
        batchDataArray.forEach(data => {
          newStates.set(data.api_txnid, false);
        });
        this.accordionStates.set(newStates);
        
        console.log('[BatchViewer] ✅ Updated batchData signal to:', this.batchData().length);
      } else {
        console.log('[BatchViewer] ❌ No valid batch data, clearing');
        this.batchData.set([]);
        this.accordionStates.set(new Map());
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

  getAccordionTitle(data: BatchSSEData): string {
    const localTime = new Date(data.time).toLocaleString();
    return `[${localTime}] ${data.api_name} VLine:${data.v_line} Min:${data.min} UG:${data.good_u} MG:${data.good_m} All Rules Passed:${data.all_rules_passed}`;
  }

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
    return get(obj, field);
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

  onColumnFilter(event: Event, field: string): void {
    console.log(`[BatchViewer] Filter applied on field: ${field}`);
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