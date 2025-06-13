import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  template: `
    <div class="skeleton-table p-3">
      <div class="skeleton-row header">
        @for(col of columns; track col.id) {
          <div class="skeleton-cell" [style.width]="col.width || '150px'"><p-skeleton width="80%" height="1.5rem"></p-skeleton></div>
        }
      </div>
      @for(i of [1,2,3,4,5]; track i) {
        <div class="skeleton-row">
          @for(col of columns; track col.id) {
            <div class="skeleton-cell" [style.width]="col.width || '150px'"><p-skeleton width="90%" height="1rem"></p-skeleton></div>
          }
        </div>
      }
    </div>
  `
})
export class TableSkeletonComponent {
  @Input({ required: true }) columns: ColumnDefinition[] = [];
}