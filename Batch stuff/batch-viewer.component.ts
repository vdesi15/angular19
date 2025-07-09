import { Component, Input, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ActiveSearch } from '../../models/search.model';
import { BatchSSEData } from '../../models/batch-sse.model';
import { ColumnDefinitionService } from '../../services/column-definition.service';
import { SearchOrchestratorService } from '../../services/search-orchestrator.service';
import { EditorDialogComponent } from '../editor-dialog/editor-dialog.component';

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
    EditorDialogComponent
  ],
  templateUrl: './batch-viewer.component.html',
  styleUrls: ['./batch-viewer.component.scss']
})
export class BatchViewerComponent {
  @Input({ required: true }) search!: ActiveSearch;

  private orchestrator = inject(SearchOrchestratorService);
  private colDefService = inject(ColumnDefinitionService);
  
  // State
  batchData = signal<BatchSSEData[]>([]);
  selectedTimeRange = signal<string>('7d');
  timeRanges = ['7d', '14d', '20d', '60d'];
  
  // Editor dialog
  showEditorDialog = signal(false);
  editorContent = signal<any>(null);
  editorTitle = signal('');
  
  // Group by state for summary table
  selectedGroupColumns = signal<string[]>(['type']);
  availableGroupColumns = [
    { label: 'Type', value: 'type' },
    { label: 'Slot', value: 'sid' },
    { label: 'Status', value: 'status' }
  ];

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

  constructor() {
    // Update batch data when search data changes
    effect(() => {
      if (this.search?.batchData) {
        this.batchData.set(this.search.batchData);
      }
    });
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

  getRuleCellClass(passed: boolean): string {
    return passed ? 'rule-pass' : 'rule-fail';
  }

  onRuleMessageClick(rule: any): void {
    if (rule.data && rule.data.length > 0) {
      this.editorTitle.set(`Rule Details: ${rule.name}`);
      this.editorContent.set(rule.data);
      this.showEditorDialog.set(true);
    }
  }

  formatLocalTime(time: string): string {
    return new Date(time).toLocaleString();
  }

  // Transform functions for table data
  getFieldValue(row: any, field: string): any {
    return field.split('.').reduce((obj, key) => obj?.[key], row);
  }
}