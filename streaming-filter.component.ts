import { Component, EventEmitter, inject, Input, Output, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ChipModule } from 'primeng/chip';
import { get } from 'lodash-es';

import { StreamFilter, StreamFilterOption } from 'src/app/core/models/stream-filter.model';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { FiltersService } from 'src/app/core/services/filters.service';
import { ElkHit } from '../../models/search.model';

const CUSTOM_VALUE_TOKEN = '%%CUSTOM_VALUE%%';

@Component({
  selector: 'app-streaming-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, PopoverModule, DropdownModule, InputTextModule, ChipModule],
  templateUrl: './streaming-filter.component.html',
  styleUrls: ['./streaming-filter.component.scss']
})
export class StreamingFilterComponent {
  @Input({ required: true }) fullDataset: ElkHit[] = [];
  @Input() appliedFilters: StreamFilter[] = [];
  @Output() filtersChange = new EventEmitter<StreamFilter[]>();

  private colDefService = inject(ColumnDefinitionService);
  private filtersService = inject(FiltersService);
  
  public selectedField: WritableSignal<ColumnDefinition | null> = signal(null);
  public selectedValue: WritableSignal<string | null> = signal(null);
  public customValue: WritableSignal<string> = signal('');
  public showCustomInput = computed(() => this.selectedValue() === CUSTOM_VALUE_TOKEN);
  
  // --- Options for the dropdowns ---
  public filterableFields: Signal<ColumnDefinition[]> = computed(() => {
    const appName = this.filtersService.filters()?.application[0] ?? '';
    if (!appName) return [];
    // Use the new service method
    return this.colDefService.getFilterableColsFor(appName);
  });

  public availableValues = computed(() => {
    // ✨ We now get the deep path from `selectedField().field` ✨
    const fieldPath = this.selectedField()?.field; 
    if (!fieldPath) return [];
    
    const uniqueValues = [...new Set(this.fullDataset.map(hit => get(hit._source, fieldPath)))];
    const options = uniqueValues.filter(v => v != null).map(val => ({ label: String(val), value: String(val) }));
    
    return [{ label: 'Enter a custom value...', value: CUSTOM_VALUE_TOKEN }, ...options];
  });

  applyFilter(): void {
    const field = this.selectedField()?.field; // Get the field path
    const value = this.showCustomInput() ? this.customValue() : this.selectedValue();
    
    if (!field || !value || value === CUSTOM_VALUE_TOKEN) return;

    const newFilter: StreamFilter = { field, value };
    if (!this.appliedFilters.some(f => f.field === newFilter.field && f.value === newFilter.value)) {
      this.filtersChange.emit([...this.appliedFilters, newFilter]);
    }
    this.resetPopover();
  }

  removeFilter(filterToRemove: StreamFilter, popover: any): void {
    const newFilters = this.appliedFilters.filter(f => f !== filterToRemove);
    this.filtersChange.emit(newFilters);
    popover.hide();
  }
  
  resetPopover(): void {
    this.selectedField.set(null);
    this.selectedValue.set(null);
    this.customValue.set('');
  }
}