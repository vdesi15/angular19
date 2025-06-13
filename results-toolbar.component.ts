import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-results-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, DropdownModule, ButtonModule, TooltipModule],
  template: `
    <div class="results-toolbar-container">
      <div class="toolbar-section left">
        <span class="p-input-icon-left">
          <i class="pi pi-eye"></i>
          <p-dropdown [options]="views" [(ngModel)]="selectedView" (ngModelChange)="viewChange.emit($event)"
            optionLabel="displayName" optionValue="viewId" placeholder="Default View"></p-dropdown>
        </span>
      </div>
      <div class="toolbar-section right">
        <button pButton type="button" icon="pi pi-share-alt" class="p-button-text" pTooltip="Share"></button>
        <button pButton type="button" icon="pi pi-download" class="p-button-text" pTooltip="Download"></button>
        <button pButton type="button" icon="pi pi-chart-bar" class="p-button-text" pTooltip="Metrics"></button>
      </div>
    </div>
  `,
  styles: [`/* Add flexbox with justify-content: space-between */`]
})
export class ResultsToolbarComponent {
  @Input() views: ViewDefinition[] = [];
  @Input() selectedView!: string;
  @Output() viewChange = new EventEmitter<string>();
}