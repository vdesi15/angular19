// Simple transaction-timeline.component.ts based on your requirements
import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG Components
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { BadgeModule } from 'primeng/badge';

import { TransactionDetailsResponse, TransactionTimelineItem } from '../models/transaction-details.model';
import { FiltersService } from 'src/app/core/services/filters.service';

@Component({
  selector: 'app-transaction-timeline',
  standalone: true,
  imports: [
    CommonModule,
    TimelineModule,
    CardModule,
    BadgeModule
  ],
  template: `
    <p-card styleClass="timeline-card h-full">
      <ng-template pTemplate="header">
        <div class="p-3">
          <h5 class="m-0">Timeline for {{ getTimelineGrouping() }}</h5>
        </div>
      </ng-template>

      @if (timelineItems().length > 0) {
        <p-timeline 
          [value]="timelineItems()" 
          layout="vertical" 
          styleClass="simple-timeline">
          
          <ng-template pTemplate="marker" let-item>
            <div 
              class="timeline-marker"
              [class.current]="item.current">
              <i class="pi pi-circle"></i>
            </div>
          </ng-template>
          
          <ng-template pTemplate="content" let-item>
            <div class="timeline-content" [class.current]="item.current">
              <div class="timeline-time">{{ formatTime(item.time) }}</div>
              <div class="timeline-action">
                <a [href]="buildSearchLink(item.action)" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="action-link">
                  {{ item.action }}
                </a>
              </div>
              <div class="timeline-description">{{ item.e }}</div>
            </div>
          </ng-template>
        </p-timeline>
      } @else {
        <div class="no-timeline text-center p-4">
          <p class="text-600">No timeline data available</p>
        </div>
      }
    </p-card>
  `,
  styles: [`
    .timeline-card {
      height: 100%;
      border: 1px solid var(--surface-300);
      
      :host ::ng-deep .p-card-header {
        padding: 0;
        border-bottom: 1px solid var(--surface-200);
        background: var(--surface-50);
      }
      
      :host ::ng-deep .p-card-body {
        padding: 1rem;
        height: calc(100% - 60px);
        overflow-y: auto;
      }
      
      :host ::ng-deep .p-card-content {
        padding: 0;
      }
    }

    :host ::ng-deep .simple-timeline {
      .p-timeline-event {
        min-height: auto;
        
        .p-timeline-event-marker {
          border: none;
          width: 1.5rem;
          height: 1.5rem;
          margin-left: -0.75rem;
        }
        
        .p-timeline-event-content {
          padding: 0.5rem 0 1rem 1rem;
        }
      }
    }

    .timeline-marker {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--surface-400);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 0.5rem;
      
      &.current {
        background: var(--primary-color);
        box-shadow: 0 0 8px rgba(var(--primary-color-rgb), 0.4);
      }
    }

    .timeline-content {
      &.current {
        background: var(--primary-50);
        border-left: 3px solid var(--primary-color);
        padding-left: 0.5rem;
        border-radius: 0 4px 4px 0;
      }
      
      .timeline-time {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-color);
        margin-bottom: 0.25rem;
        font-family: var(--font-family-mono, 'Courier New', monospace);
      }
      
      .timeline-action {
        margin-bottom: 0.25rem;
        
        .action-link {
          color: var(--primary-color);
          text-decoration: none;
          font-size: 0.875rem;
          
          &:hover {
            text-decoration: underline;
          }
        }
      }
      
      .timeline-description {
        font-size: 0.75rem;
        color: var(--text-color-secondary);
        line-height: 1.3;
      }
    }

    .no-timeline {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 150px;
    }
  `]
})
export class TransactionTimelineComponent {
  @Input({ required: true }) transactionDetails!: TransactionDetailsResponse | null;
  @Input() transactionId?: string;

  private filtersService = inject(FiltersService);

  // Simple computed signals
  public readonly timelineItems = computed(() => {
    return this.transactionDetails?.TRANSACTION_TIMELINE || [];
  });

  // Get the timeline grouping (l field) from first item
  getTimelineGrouping(): string {
    const items = this.timelineItems();
    return items.length > 0 ? items[0].l : 'Unknown';
  }

  // Format time to HH:mm:ss AM/PM
  formatTime(time: string): string {
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

  // Build search link for action
  buildSearchLink(action: string): string {
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