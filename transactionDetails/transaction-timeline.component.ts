// transaction-timeline.component.ts - Simple PrimeNG Timeline
import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';

import { TransactionDetailsResponse, TransactionTimelineItem } from '../models/transaction-details.model';

@Component({
  selector: 'app-transaction-timeline',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule],
  template: `
    <div class="timeline-container">
      <div class="timeline-header">
        <h5>Transaction Timeline</h5>
        <span class="event-count">{{ events().length }} events</span>
      </div>
      
      @if (events().length > 0) {
        <p-timeline [value]="events()" class="timeline-content">
          <ng-template #content let-event>
            <div class="timeline-event">
              <div class="event-time">{{ formatTime(event.time) }}</div>
              <div class="event-action">{{ event.action }}</div>
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

    .timeline-event {
      padding: 0.5rem 0;
    }

    .event-time {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      font-family: monospace;
      margin-bottom: 0.25rem;
    }

    .event-action {
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.25rem;
    }

    .event-description {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
      line-height: 1.4;
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

  // Simple computed for timeline events
  public readonly events = computed(() => {
    return this.transactionDetails?.TRANSACTION_TIMELINE || [];
  });

  // Format time to HH:mm:ss.SSS
  formatTime(time: string): string {
    try {
      const date = new Date(time);
      return date.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
      }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
    } catch {
      return time;
    }
  }
}