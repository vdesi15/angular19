<p-table #logTable 
  [value]="allTableData()" <!-- Bind to the full dataset -->
  [columns]="visibleColumns"
  [paginator]="true" 
  [rows]="50" 
  [totalRecords]="allTableData().length"
  [first]="paginatorFirst()" <!-- ✨ Control the paginator's state with our signal -->
  (onPageChange)="onPageChange($event)" <!-- ✨ Update our state when the user paginates -->
  ...
>
  <!-- ... rest of template ... -->
</p-table>