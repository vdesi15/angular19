import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class DynamicRowsService {
  private document = inject(DOCUMENT);
  
  // Signals for responsive row calculation
  private containerHeight = signal<number>(0);
  private headerHeight = signal<number>(140); // Header + filter rows
  private paginatorHeight = signal<number>(50); // Paginator height
  private rowHeight = signal<number>(35); // Individual row height
  
  // Computed optimal rows per page
  readonly optimalRowsPerPage = computed(() => {
    const available = this.containerHeight() - this.headerHeight() - this.paginatorHeight();
    const rows = Math.floor(available / this.rowHeight());
    return Math.max(5, Math.min(50, rows)); // Min 5, max 50 rows
  });
  
  /**
   * Calculate optimal rows for a specific accordion content area
   */
  calculateRowsForAccordion(containerElement: HTMLElement): number {
    if (!containerElement) return 20;
    
    const containerRect = containerElement.getBoundingClientRect();
    const availableHeight = containerRect.height - this.headerHeight() - this.paginatorHeight();
    const calculatedRows = Math.floor(availableHeight / this.rowHeight());
    
    return Math.max(5, Math.min(50, calculatedRows));
  }
  
  /**
   * Update container height for calculations
   */
  updateContainerHeight(height: number): void {
    this.containerHeight.set(height);
  }
  
  /**
   * Get fixed height for accordion content based on row count
   */
  getAccordionContentHeight(rowCount: number): string {
    const totalHeight = this.headerHeight() + (rowCount * this.rowHeight()) + this.paginatorHeight();
    return `${totalHeight}px`;
  }
}