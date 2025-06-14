import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { ViewDefinition } from 'src/app/core/models/view-definition.model';
// Donut chart popover would be its own component
// import { TransactionMetricsComponent } from './transaction-metrics.component';

@Component({
  selector: 'app-transaction-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolbarModule, ButtonModule, TooltipModule, DropdownModule],
  template: `
    <p-toolbar>
      <div class="p-toolbar-group-left">
        <p-dropdown [options]="views" [(ngModel)]="selectedView" (ngModelChange)="viewChange.emit($event)"
          optionLabel="displayName" optionValue="viewId" placeholder="Select View"></p-dropdown>
      </div>
      <div class="p-toolbar-group-right">
        <button pButton type="button" icon="pi pi-chart-pie" class="p-button-text" pTooltip="Transaction Metrics"></button>
        <button pButton type="button" icon="pi pi-share-alt" class="p-button-text" pTooltip="Share"></button>
        <button pButton type="button" icon="pi pi-download" class="p-button-text" pTooltip="Download"></button>
      </div>
    </p-toolbar>
  `
})
export class TransactionToolbarComponent {
  @Input() views: ViewDefinition[] = [];
  @Input() selectedView!: string;
  @Output() viewChange = new EventEmitter<string>();
}