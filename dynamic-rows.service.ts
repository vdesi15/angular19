import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class DynamicRowsService {
  private document = inject(DOCUMENT);
  
  // 🔥 UPDATED: Compact table measurements
  private containerHeight = signal<number>(0);
  private headerHeight = signal<number>(100); // Reduced: Header + filter rows (compact)
  private paginatorHeight = signal<number>(40); // Reduced: Compact paginator
  private rowHeight = signal<number>(28); // Reduced: Compact row height
  
  // Computed optimal rows per page
  readonly optimalRowsPerPage = computed(() => {
    const available = this.containerHeight() - this.headerHeight() - this.paginatorHeight();
    const rows = Math.floor(available / this.rowHeight());
    
    // 🔥 ENHANCED: Better bounds for compact display
    return Math.max(8, Math.min(60, rows)); // Min 8, max 60 rows for compact view
  });
  
  /**
   * 🔥 ENHANCED: Calculate optimal rows for accordion with better measurements
   */
  calculateRowsForAccordion(containerElement: HTMLElement): number {
    if (!containerElement) return 25; // Increased default for compact view
    
    const containerRect = containerElement.getBoundingClientRect();
    const availableHeight = containerRect.height - this.headerHeight() - this.paginatorHeight();
    const calculatedRows = Math.floor(availableHeight / this.rowHeight());
    
    // 🔥 ENHANCED: Better bounds for accordion tables
    return Math.max(8, Math.min(60, calculatedRows));
  }
  
  /**
   * Update container height for calculations
   */
  updateContainerHeight(height: number): void {
    this.containerHeight.set(height);
  }
  
  /**
   * 🔥 ENHANCED: Get exact height for accordion content based on row count
   */
  getAccordionContentHeight(rowCount: number): string {
    const totalHeight = this.headerHeight() + (rowCount * this.rowHeight()) + this.paginatorHeight();
    return `${Math.min(totalHeight, 600)}px`; // Cap at 600px max height
  }
  
  /**
   * 🔥 NEW: Get optimal height for table container in accordion
   */
  getOptimalTableHeight(): string {
    const rows = this.optimalRowsPerPage();
    return this.getAccordionContentHeight(rows);
  }
  
  /**
   * 🔥 NEW: Calculate rows based on available viewport height
   */
  calculateRowsForViewport(): number {
    const viewportHeight = this.document.defaultView?.innerHeight || 800;
    const availableHeight = viewportHeight * 0.6; // Use 60% of viewport
    const calculatedRows = Math.floor((availableHeight - this.headerHeight() - this.paginatorHeight()) / this.rowHeight());
    
    return Math.max(10, Math.min(50, calculatedRows));
  }
}