import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// --- PrimeNG Modules ---
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MultiSelectModule } from 'primeng/multiselect';

// --- App Components, Models & Services ---
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { ElkHit } from '../../models/search.model';
import { StreamingFilterComponent } from '../streaming-filter/streaming-filter.component'; // ✨ Import the filter component

@Component({
  selector: 'app-streaming-toolbar',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ToolbarModule, ButtonModule, TooltipModule, MultiSelectModule,
    StreamingFilterComponent // ✨ Add to imports
  ],
  templateUrl: './streaming-toolbar.component.html',
  styleUrls: ['./streaming-toolbar.component.scss']
})
export class StreamingToolbarComponent {
  // --- Inputs for Column Selection ---
  @Input() allAvailableColumns: ColumnDefinition[] = [];
  @Input() currentlyVisibleColumns: ColumnDefinition[] = [];
  @Output() visibleColumnsChange = new EventEmitter<ColumnDefinition[]>();
  @Output() resetColumns = new EventEmitter<void>();

  // --- Inputs & Outputs for Stream Filtering ---
  @Input() availableFilterValues!: Map<string, Set<any>>;
  @Input() appliedFilters: StreamFilter[] = [];
  @Output() filtersChange = new EventEmitter<StreamFilter[]>();
}