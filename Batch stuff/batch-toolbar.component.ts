import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'app-batch-toolbar',
  standalone: true,
  imports: [CommonModule, ToolbarModule],
  template: `
    <p-toolbar styleClass="batch-toolbar">
      <div class="p-toolbar-group-start">
        <span class="toolbar-title">Batch Timeline View</span>
      </div>
    </p-toolbar>
  `,
  styles: [`
    .batch-toolbar {
      border: none;
      padding: 0.5rem 1rem;
      background-color: var(--surface-ground);
      
      .toolbar-title {
        font-weight: 500;
        color: var(--text-color);
      }
    }
  `]
})
export class BatchToolbarComponent {}