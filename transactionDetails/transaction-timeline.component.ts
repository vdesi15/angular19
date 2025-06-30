// transaction-timeline.component.ts - Simple PrimeNG Timeline with Search Links
import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';

import { TransactionDetailsResponse, TransactionTimelineItem } from '../models/transaction-details.model';
import { FiltersService } from 'src/app/core/services/filters.service';

@Component({
  selector: 'app-transaction-timeline',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule],
  template: `
    <div class="timeline-container">
      <div class="timeline-header">
        <h5>Transaction Timeline</h5>
        <span class="event-count">{{ processedEvents().length }} events</span>
      </div>
      
      @if (processedEvents().length > 0) {
        <p-timeline [value]="processedEvents()" class="timeline-content" align="left">
          <ng-template #marker let-event>
            <div 
              class="timeline-marker"
              [class.current]="event.isCurrent">
              <i class="pi pi-circle"></i>
            </div>
          </ng-template>
          
          <ng-template #content let-event>
            <div 
              class="timeline-event"
              [class.current]="event.isCurrent">
              <div class="event-time">{{ event.formattedTime }}</div>
              <div class="event-action">
                <a [href]="event.searchLink" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="action-link">
                  {{ event.action }}
                </a>
              </div>
              <div class="event-description">{{ event.e }}</div>
            </div>
          </ng-template>
        </p-timeline>
      } @else {
        <div class="no-events">
          <i class="pi pi-info-circle"></i>
          <p>No timeline events available</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .timeline-header {
      padding: 1rem;
      background: var(--surface-50);
      border-bottom: 1px solid var(--surface-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .timeline-header h5 {
      margin: 0;
      color: var(--text-color);
      font-weight: 600;
    }

    .event-count {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
      background: var(--surface-100);
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
    }

    .timeline-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }

    /* Simple marker styling - just override the current transaction color */
    .timeline-marker.current ::ng-deep i {
      color: #22c55e !important; /* Green color for current transaction */
    }

    /* Timeline Event Content */
    .timeline-event {
      padding: 0.5rem 0;
      
      &.current {
        background: rgba(34, 197, 94, 0.1);
        border-left: 3px solid #22c55e;
        padding-left: 0.75rem;
        border-radius: 0 4px 4px 0;
        margin-left: -0.5rem;
      }
    }

    .event-time {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      font-family: var(--font-family-mono, 'Courier New', monospace);
      margin-bottom: 0.25rem;
      font-weight: 600;
    }

    .event-action {
      margin-bottom: 0.25rem;
      
      .action-link {
        color: var(--primary-color);
        text-decoration: none;
        font-size: 0.875rem;
        font-weight: 600;
        
        &:hover {
          text-decoration: underline;
          color: var(--primary-color-text);
        }
        
        &:visited {
          color: var(--primary-color);
        }
      }
    }

    .event-description {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      line-height: 1.3;
    }

    .no-events {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--text-color-secondary);
      gap: 0.5rem;
    }

    .no-events i {
      font-size: 2rem;
      opacity: 0.5;
    }

    .no-events p {
      margin: 0;
      font-size: 0.875rem;
    }

    /* Dark mode support */
    :host-context(.app-dark) {
      .timeline-header {
        background: var(--surface-800);
        border-bottom-color: var(--surface-600);
      }

      .event-count {
        background: var(--surface-700);
      }
      
      .timeline-event.current {
        background: rgba(34, 197, 94, 0.2);
        border-left-color: #22c55e;
      }
    }

    /* Custom scrollbar */
    .timeline-content::-webkit-scrollbar {
      width: 6px;
    }

    .timeline-content::-webkit-scrollbar-track {
      background: var(--surface-ground);
    }

    .timeline-content::-webkit-scrollbar-thumb {
      background: var(--text-color-secondary);
      border-radius: 3px;
    }

    .timeline-content::-webkit-scrollbar-thumb:hover {
      background: var(--primary-color);
    }
  `]
})
export class TransactionTimelineComponent {
  @Input({ required: true }) transactionDetails!: TransactionDetailsResponse | null;
  @Input() transactionId?: string;

  private filtersService = inject(FiltersService);

  // Pre-process events once with all computed data to avoid repeated function calls
  public readonly processedEvents = computed(() => {
    const timeline = this.transactionDetails?.TRANSACTION_TIMELINE || [];
    
    return timeline.map(event => ({
      ...event,
      isCurrent: this.isCurrentTransaction(event),
      formattedTime: this.formatTime(event.time),
      searchLink: this.buildSearchLink(event.action)
    }));
  });

  // Check if this event represents the current transaction
  private isCurrentTransaction(event: TransactionTimelineItem): boolean {
    if (event.current) return true;
    
    if (this.transactionId) {
      return event.action.includes(this.transactionId) || 
             event.id === this.transactionId ||
             event.action.toLowerCase().includes(this.transactionId.toLowerCase());
    }
    
    return false;
  }

  // Format time to HH:mm:ss AM/PM (matching your existing format)
  private formatTime(time: string): string {
    try {
      const date = new Date(time);
      return date.toLocaleTimeString('en-US', { 
        hour12: true,
        hour: 'numeric', 
        minute: '2-digit', 
        second: '2-digit'
      });
    } catch {
      return time;
    }
  }

  // Build search link for action (from your existing implementation)
  private buildSearchLink(action: string): string {
    const filters = this.filtersService.filters();
    if (!filters) return '#';

    const baseUrl = window.location.origin;
    const currentApp = filters.application?.[0] || '';
    const currentEnv = filters.environment || '';
    const currentLoc = filters.location || '';

    // URL encode all parameters
    const encodedApp = encodeURIComponent(currentApp);
    const encodedEnv = encodeURIComponent(currentEnv);
    const encodedLoc = encodeURIComponent(currentLoc);
    const encodedAction = encodeURIComponent(action);

    return `${baseUrl}/logs/search?applications=${encodedApp}&env=${encodedEnv}&location=${encodedLoc}&searchText=${encodedAction}`;
  }
}