import { Component, EventEmitter, inject, Input, Output, signal, WritableSignal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { get } from 'lodash-es';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';

// PrimeNG UI Modules
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { ChipModule } from 'primeng/chip';

// App Models and Services
import { StreamFilter } from 'src/app/core/models/stream-filter.model';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';
import { ColumnDefinitionService } from 'src/app/core/services/column-definition.service';
import { FiltersService } from 'src/app/core/services/filters.service';
import { CustomValueDialogComponent } from '../custom-value-dialog/custom-value-dialog.component';

const CUSTOM_VALUE_TOKEN = '%%CUSTOM_VALUE%%';

@Component({
  selector: 'app-streaming-filter',
  standalone: true,
  imports: [ /* All modules listed above */ CommonModule, FormsModule, ButtonModule, PopoverModule, DropdownModule, MultiSelectModule, InputTextModule, ChipModule, DynamicDialogModule ],
  providers: [DialogService], // Provide DialogService locally to this component
  templateUrl: './streaming-filter.component.html',
  styleUrls: ['./streaming-filter.component.scss']
})
export class StreamingFilterComponent {
  @Input({ required: true }) availableFilterValues!: Map<string, Set<any>>;
  @Input() appliedFilters: StreamFilter[] = [];
  @Output() filtersChange = new EventEmitter<StreamFilter[]>();

  private colDefService = inject(ColumnDefinitionService);
  private filtersService = inject(FiltersService);
  private dialogService = inject(DialogService);
  
  // --- State for the popover ---
  public selectedField: WritableSignal<ColumnDefinition | null> = signal(null);
  public selectedValues: WritableSignal<string[]> = signal([]);
  
  public isCustomValueDialogVisible: WritableSignal<boolean> = signal(false);
  public customValueInput: WritableSignal<string> = signal('');

  // --- Options for the dropdowns ---
  public filterableFields: Signal<ColumnDefinition[]> = computed(() => {
    const appName = this.filtersService.filters()?.applications[0] ?? '';
    return this.colDefService.getFilterableColsFor(appName);
  });

  public valueOptions = computed(() => {
    const fieldPath = this.selectedField()?.field;
    if (!fieldPath) return [];
    
    const uniqueValues = this.availableFilterValues.get(fieldPath) ?? new Set();
    const options = Array.from(uniqueValues).map(val => ({ label: String(val), value: String(val) }));
    
    // Add the custom value option to the top
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

  /**
   * ✨ THE FIX: A dedicated method to handle editing a filter. ✨
   * This is called when a user clicks on an existing filter chip.
   * @param filter The filter object associated with the clicked chip.
   * @param popover The popover instance from the template.
   * @param event The browser click event.
   */
  editFilter(filter: StreamFilter, popover: Popover, event: Event): void {
    console.log("Editing filter:", filter);
    // 1. Set the state of the popover controls to match the filter being edited.
    // We need to find the full ColumnDefinition object for the `selectedField`.
    const fieldDef = this.filterableFields().find(f => f.field === filter.field);
    this.selectedField.set(fieldDef || null);
    this.selectedValues.set([...filter.values]);
    
    // 2. Open the popover.
    popover.toggle(event);
  }

  // Called when the user clicks "Apply" in the custom value dialog
  applyCustomValue(): void {
    const value = this.customValueInput();
    if (value) {
      // Add the new custom value to the selection and close the dialog
      this.selectedValues.update(current => [...current, value]);
      this.isCustomValueDialogVisible.set(false);
      this.customValueInput.set(''); // Reset for next time
    }
  }


  /**
   * Called when the user selects a value in the multiselect.
   * If they choose "custom", it opens the dialog.
   */
   onValueChange(values: string[]): void {
    if (values.includes(CUSTOM_VALUE_TOKEN)) {
      this.selectedValues.update(v => v.filter(val => val !== CUSTOM_VALUE_TOKEN));
      this.isCustomValueDialogVisible.set(true); // ✨ Open the dialog
    } else {
      this.selectedValues.set(values);
    }
  }

  applyFilter(): void {
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
    this.resetPopover();
  }

  removeFilter(filterToRemove: StreamFilter): void {
    this.filtersChange.emit(this.appliedFilters.filter(f => f !== filterToRemove));
  }
  
  resetPopover(): void {
    this.selectedField.set(null);
    this.selectedValues.set([]);
  }
}