import { Component, EventEmitter, Input, Output, WritableSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MultiSelectModule } from 'primeng/multiselect';
import { FormsModule } from '@angular/forms';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';

@Component({
  selector: 'app-streaming-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolbarModule, ButtonModule, TooltipModule, MultiSelectModule],
  template: `
    <p-toolbar>
      <div class="p-toolbar-group-left">
        <p-multiSelect 
          [options]="allColumns" 
          [(ngModel)]="visibleColumns"
          (ngModelChange)="columnsChange.emit($event)"
          optionLabel="displayName" 
          placeholder="Select Columns" 
          selectedItemsLabel="{0} columns selected"
          styleClass="w-full md:w-20rem">
        </p-multiSelect>
        <button pButton type="button" label="Reset" icon="pi pi-replay" class="p-button-text ml-2" (click)="reset.emit()"></button>
      </div>
      <div class="p-toolbar-group-right">
        <button pButton type="button" label="Add Filter" icon="pi pi-filter-plus" class="p-button-outlined"></button>
      </div>
    </p-toolbar>
  `
})
export class StreamingToolbarComponent {
  @Input() allColumns: ColumnDefinition[] = [];
  @Input() visibleColumns: ColumnDefinition[] = [];
  @Output() columnsChange = new EventEmitter<ColumnDefinition[]>();
  @Output() reset = new EventEmitter<void>();
}