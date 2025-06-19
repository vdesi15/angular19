import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ColumnDefinition } from 'src/app/core/models/column-definition.model';

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule, TableModule],
  template: `
    <p-table 
      [value]="skeletonRows" 
      [columns]="columns"
      [scrollable]="true" 
      scrollHeight="flex"
      styleClass="p-datatable-striped p-datatable-sm p-datatable-gridlines">
      
      <ng-template pTemplate="header" let-columns>
        <tr>
          @for(col of columns; track col.id) {
            <th [style.width]="col.width">
              {{ col.displayName }}
            </th>
          }
        </tr>
        <tr>
          @for(col of columns; track col.id) {
            <th>
              @if(col.enableFiltering !== false) {
                <p-skeleton width="100%" height="1.75rem" styleClass="mb-0"></p-skeleton>
              }
            </th>
          }
        </tr>
      </ng-template>
      
      <ng-template pTemplate="body" let-rowData let-columns="columns">
        <tr>
          @for(col of columns; track col.id) {
            <td>
              <p-skeleton width="90%" height="1rem"></p-skeleton>
            </td>
          }
        </tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class TableSkeletonComponent {
  @Input() columns: ColumnDefinition[] = [];
  @Input() rowCount: number = 15; // Default to 15 rows
  
  get skeletonRows(): any[] {
    return Array(this.rowCount).fill({});
  }
}