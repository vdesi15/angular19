import { Component, EventEmitter, inject, Input, Output, signal, WritableSignal, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';

// --- PrimeNG Modules ---
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';

// --- App Models and Services ---
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ElkHit } from '../../models/search.model';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { FiltersService } from 'src/app/core/services/filters.service';

// A constant token to identify the "custom value" option in the dropdown
const CUSTOM_VALUE_TOKEN = '%%CUSTOM_VALUE%%';

@Component({
  selector: 'app-streaming-filter',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, PopoverModule, DropdownModule,
    MultiSelectModule, InputTextModule, ChipModule, DialogModule, FloatLabelModule
  ],
  templateUrl: './streaming-filter.component.html',
  styleUrls: ['./streaming-filter.component.scss']
})
export class StreamingFilterComponent {
  // --- Inputs & Outputs ---
  @Input({ required: true }) availableFilterValues!: Map<string, Set<any>>;
  @Input() appliedFilters: StreamFilter[] = [];
  @Output() filtersChange = new EventEmitter<StreamFilter[]>();
  
  private colDefService = inject(ColumnDefinitionService);
  private filtersService = inject(FiltersService);
    
  public selectedField: WritableSignal<ColumnDefinition | null> = signal(null);
  public selectedValues: WritableSignal<string[]> = signal([]);   
  public isCustomValueDialogVisible = signal(false);
  public customValueInput: WritableSignal<string> = signal('');

  @ViewChild('valueMultiSelect') valueMultiSelect!: MultiSelect;

  // --- Derived Signals for Dropdown Options ---
  public filterableFields: Signal<ColumnDefinition[]> = computed(() => {
    const appName = this.filtersService.filters()?.application[0] ?? '';
    if (!appName) return [];
    return this.colDefService.getFilterableColsFor(appName).filter(col => col.visible === true);
  });

  public valueOptions = computed(() => {
    const fieldPath = this.selectedField()?.field;
    if (!fieldPath) return [];
    
    const uniqueValues = this.availableFilterValues.get(fieldPath) ?? new Set();
    const options = Array.from(uniqueValues).filter(v => v != null).map(val => ({ label: String(val), value: String(val) }));
    
    // Add the "Enter a custom value..." option to the top of the list
    return [{ label: 'Enter a custom value...', value: CUSTOM_VALUE_TOKEN }, ...options];
  });
  
  /**
   * Called when the "Add Filter" popover is shown.
   * It pre-populates the controls if an existing filter is being edited.
   */
  onPopoverShow(): void {
    const fieldToEdit = this.selectedField();
    if (fieldToEdit) {
      const existingFilter = this.appliedFilters.find(f => f.field === fieldToEdit.field);
      if (existingFilter) {
        this.selectedValues.set([...existingFilter.values]);
      }
    }
  }

  onValueChange(values: string[]): void {
    if (values.includes(CUSTOM_VALUE_TOKEN)) {
      this.isCustomValueDialogVisible.set(true);
      this.selectedValues.set(values.filter(val => val !== CUSTOM_VALUE_TOKEN));
    } else {
      this.selectedValues.set(values);      
      if (values.length > 0 && this.valueMultiSelect) {
        setTimeout(() => {
          this.valueMultiSelect.hide();
        }, 100);
      }
    }
  }

  closeCustomValueDialog(): void {
    this.isCustomValueDialogVisible.set(false);
    this.customValueInput.set(''); // Reset for the next time
  }

  /**
   * Called when the user clicks "Apply" in the custom value dialog.
   */
  applyCustomValue(): void {
    const value = this.customValueInput();
    if (value) {
      // Add the new custom value to the selection and close the dialog.
      //this.selectedValues.update(current => [...current, value]); <-- multi select
      this.selectedValues.update(current => [value]); //<- Single select
      this.closeCustomValueDialog();
    }
  }

  closeCustomValueDialog(): void {
    this.isCustomValueDialogVisible.set(false);
    this.customValueInput.set(''); // Reset for next time
  }

  /**
   * Called by the "Apply Filter" button in the main popover.
   * Emits the final filter state to the parent component.
   */
  applyFilter(popover: Popover): void {
    const fieldDef = this.selectedField();
    const values = this.selectedValues();
    if (!fieldDef || values.length === 0) return;

    const newFilter: StreamFilter = {
      field: fieldDef.field,
      displayName: fieldDef.displayName,
      values: values
    };
    
    const otherFilters = this.appliedFilters.filter(f => f.field !== newFilter.field);
    this.filtersChange.emit([...otherFilters, newFilter]);
    
    popover.hide(); // Close the main popover
    this.resetPopover();
  }

  removeFilter(filterToRemove: StreamFilter): void {
  const newFilters = this.appliedFilters.filter(f => f.field !== filterToRemove.field);
  this.filtersChange.emit(newFilters);
}
  
  /**
   * Called when a user clicks an existing chip to edit it.
   */
  editFilter(filter: StreamFilter, popover: Popover, event: Event): void {
    // Find the full ColumnDefinition object that matches the filter's field.
    const fieldDef = this.filterableFields().find(f => f.field === filter.field);
    this.selectedField.set(fieldDef || null);
    // Pre-populate the values for the multiselect.
    this.selectedValues.set([...filter.values]);
    // Open the popover attached to the event target (the chip).
    popover.toggle(event);
  }

  resetPopover(): void {
    this.selectedField.set(null);
    this.selectedValues.set([]);
  }
}