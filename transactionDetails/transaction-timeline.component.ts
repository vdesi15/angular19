// transaction-timeline.component.ts - Fixed positioning timeline
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
      <!-- Fixed Header -->
      <div class="timeline-header">
        <h5>Transaction Timeline</h5>
      </div>
      
      <!-- Scrollable Timeline Content -->
      <div class="timeline-scrollable">
        @if (processedEvents().length > 0) {
          <p-timeline [value]="processedEvents()" align="left">
            <ng-template #marker let-event>
              <div 
                class="timeline-marker"
                [class.current]="event.isCurrent">
                <i class="pi pi-circle"></i>
              </div>
            </ng-template>
            
            <ng-template #content let-event>
              <div 
                class="timeline-event-wrapper"
                [class.current-transaction]="event.isCurrent">
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

       <div class="timeline-info-footer">
        Showing 1 forward and {{ (transactionDetails?.hits?.hits?.length || 0) - 1 }} previous looking txns
      </div>
    </div>
  `,
  styles: [`
   .timeline-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 🔥 Clean Header - EXACTLY matches table header + filter height */
.timeline-header {
  /* Calculate exact height: header (3.5rem) + filter (3rem) + borders */
  height: 6.5rem !important;
  padding: 1rem;
  background: #f8fafc !important; // Match table header
  color: #1a202c !important;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid #e2e8f0;
}

// ================================
// 🔥 NEW: INFO FOOTER - At bottom of container
// ================================
.timeline-info-footer {
  padding: 1rem;
  color: white !important;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  border-top: 2px solid #5a67d8;
  flex-shrink: 0;
}

.timeline-header h5 {
  margin: 0;
  color: #1a202c !important;
  font-weight: 600;
  font-size: 0.875rem; // Match table header font size
  letter-spacing: 0.3px;
}

.event-count {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280 !important;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  display: inline-block;
  font-weight: 500;
  width: fit-content;
}

/* Scrollable Timeline Area */
.timeline-scrollable {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  position: relative;
  background: #ffffff;
}

/* 🔥 FIXED Timeline Styling - Proper line and circles */
:host ::ng-deep {

  /* Hide the opposite side */
  .p-timeline-event-opposite {
    display: none !important;
  }

  /* Timeline events positioning */
  .p-timeline-event {
    position: relative !important;
    margin-bottom: 1.5rem !important;
    display: flex !important;
    align-items: flex-start !important;
  }

  /* 🔥 FIXED: Timeline connector line - properly positioned */
  .p-timeline-event-connector {
    position: absolute !important;
    left: 16px !important; // Centered on marker
    top: 0 !important;
    width: 2px !important;
    background: #d1d5db !important; // Clean gray line
    height: calc(100% + 1.5rem) !important; // Extend to next event
    z-index: 1 !important;
  }

  /* 🔥 FIXED: Timeline marker - clean circle */
  .p-timeline-event-marker {
    position: absolute !important;
    left: 16px !important;
    top: 1rem !important;
    width: 12px !important;
    height: 12px !important;
    margin: 0 !important;
    transform: translateX(-50%) !important;
    background: #3b82f6 !important; // Your blue theme
    border: 3px solid #ffffff !important;
    border-radius: 50% !important;
    box-shadow: 0 0 0 2px #e5e7eb !important;
    z-index: 2 !important;
  }

  /* 🔥 Timeline content cards - clean and elegant */
  .p-timeline-event-content {
    margin-left: 40px !important; // Space for line and marker
    width: calc(100% - 45px) !important;
    background: #ffffff !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 8px !important;
    padding: 1rem !important;
    transition: all 0.2s ease !important;
    position: relative !important;

    &:hover {
      border-color: #3b82f6 !important;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1) !important;
    }
  }

  /* Event wrapper styling */
  .timeline-event-wrapper {
    width: 100% !important;

    &.current-transaction {
      .p-timeline-event-content {
        border-color: #f59e0b !important; // Orange for current
        background: #fffbeb !important; // Light orange background
      }

      .p-timeline-event-marker {
        background: #f59e0b !important; // Orange marker
        box-shadow: 0 0 0 2px #fed7aa !important;
      }
    }
  }

  /* Event action styling */
  .event-action {
    margin-bottom: 0.75rem;

    .action-link {
      font-weight: 600;
      font-size: 0.875rem;
      color: #3b82f6 !important;
      text-decoration: none;
      transition: color 0.2s ease;

      &:hover {
        color: #1d4ed8 !important;
        text-decoration: underline;
      }
    }
  }

  /* Event timestamp styling */
  .event-timestamp {
    display: block;
    font-size: 0.75rem;
    color: #6b7280 !important;
    margin-bottom: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    display: inline-block;
    font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  }

  /* Event description styling */
  .event-description {
    font-size: 0.8rem;
    color: #374151 !important; // transaction-timeline.component.scss - Elegant styling to match the table

    .timeline-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: white;
      border: 2px solid #667eea;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }

    /* 🔥 Elegant Header - Matches table header height and style */
    .timeline-header {
      height: 7rem !important; // Match table header (3.5rem) + filter row (3.5rem)
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 2px solid #5a67d8;
    }

    .timeline-header h5 {
      margin: 0;
      color: white !important;
      font-weight: 600;
      font-size: 1rem;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      letter-spacing: 0.5px;
    }

    .event-count {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.9) !important;
      background: rgba(255, 255, 255, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      display: inline-block;
      backdrop-filter: blur(10px);
      font-weight: 500;
      width: fit-content;
    }

    /* Scrollable Timeline Area */
    .timeline-scrollable {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 1.5rem 1rem;
      position: relative;
      background: linear-gradient(to bottom, #f8fafc 0%, white 100%);
    }

    /* Enhanced Timeline Event Styling */
    :host ::ng-deep {

      /* Hide the opposite side completely */
      .p-timeline-event-opposite {
        display: none !important;
      }

      /* Enhanced timeline events */
      .p-timeline-event {
        position: relative !important;
        margin-bottom: 1.5rem !important;
        display: flex !important;
        align-items: flex-start !important;
      }

      /* Enhanced timeline connector line */
      .p-timeline-event-connector {
        position: absolute !important;
        left: 20px !important;
        top: 0 !important;
        width: 3px !important;
        background: linear-gradient(to bottom, #667eea, #764ba2) !important;
        height: 100% !important;
        border-radius: 2px !important;
      }

      /* Enhanced timeline marker */
      .p-timeline-event-marker {
        position: absolute !important;
        left: 20px !important;
        top: 0.5rem !important;
        width: 14px !important;
        height: 14px !important;
        margin: 0 !important;
        transform: translateX(-50%) !important;
        background: linear-gradient(135deg, #667eea, #764ba2) !important;
        border: 3px solid white !important;
        border-radius: 50% !important;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
        z-index: 5 !important;
      }

      /* Enhanced event content */
      .p-timeline-event-content {
        margin-left: 45px !important;
        width: calc(100% - 55px) !important;
        background: white !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        padding: 1rem !important;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1) !important;
        transition: all 0.3s ease !important;
        position: relative !important;

        &:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2) !important;
          border-color: #667eea !important;
        }

        /* Add elegant corner accent */
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 8px 0 0 8px;
        }
      }

      /* Event wrapper styling */
      .timeline-event-wrapper {
        width: 100% !important;

        &.current-transaction {
          .p-timeline-event-content {
            border-color: #667eea !important;
            background: linear-gradient(135deg, #667eea10, #764ba210) !important;

            &::before {
              background: linear-gradient(135deg, #f59e0b, #d97706) !important;
            }
          }

          .p-timeline-event-marker {
            background: linear-gradient(135deg, #f59e0b, #d97706) !important;
            border-color: white !important;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4) !important;
          }
        }
      }

      /* Event action styling */
      .event-action {
        margin-bottom: 0.75rem;

        .action-link {
          font-weight: 600;
          font-size: 0.9rem;
          color: #667eea !important;
          text-decoration: none;
          transition: all 0.2s ease;

          &:hover {
            color: #5a67d8 !important;
            text-decoration: underline;
          }
        }
      }

      /* Event timestamp styling */
      .event-timestamp {
        display: block;
        font-size: 0.75rem;
        color: #718096 !important;
        margin-bottom: 0.5rem;
        padding: 0.25rem 0.5rem;
        background: #f7fafc;
        border-radius: 4px;
        display: inline-block;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      }

      /* Event description styling */
      .event-description {
        font-size: 0.8rem;
        color: #4a5568 !important;
        line-height: 1.5;
        word-wrap: break-word;
        overflow-wrap: break-word;
        margin-top: 0.5rem;
      }

      /* No events state */
      .no-events {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #718096;
        gap: 1rem;
        height: 200px;
        text-align: center;

        i {
          font-size: 2.5rem;
          opacity: 0.5;
          color: #667eea;
        }

        p {
          margin: 0;
          font-size: 0.9rem;
          color: #a0aec0;
        }
      }
    }

    /* Dark mode support */
    :host-context(.app-dark) {
      .timeline-container {
        background: #1a202c !important;
        border-color: #4a5568 !important;
      }

      .timeline-header {
        background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%) !important;
        color: #e2e8f0 !important;
        border-bottom-color: #4a5568 !important;

        h5 {
          color: #e2e8f0 !important;
        }

        .event-count {
          color: #e2e8f0 !important;
          background: rgba(255, 255, 255, 0.1) !important;
        }
      }

      .timeline-scrollable {
        background: linear-gradient(to bottom, #1a202c 0%, #2d3748 100%) !important;
      }

      ::ng-deep {
        .p-timeline-event-content {
          background: #2d3748 !important;
          border-color: #4a5568 !important;
          color: #e2e8f0 !important;

          &:hover {
            border-color: #667eea !important;
            box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3) !important;
          }
        }

        .timeline-event-wrapper.current-transaction {
          .p-timeline-event-content {
            border-color: #667eea !important;
            background: linear-gradient(135deg, #667eea20, #764ba220) !important;
          }
        }

        .event-action .action-link {
          color: #90cdf4 !important;

          &:hover {
            color: #63b3ed !important;
          }
        }

        .event-timestamp {
          background: #1a202c !important;
          color: #a0aec0 !important;
        }

        .event-description {
          color: #cbd5e0 !important;
        }

        .no-events {
          color: #a0aec0 !important;

          i {
            color: #667eea !important;
          }

          p {
            color: #718096 !important;
          }
        }
      }
    }

    /* Custom scrollbar for timeline content */
    .timeline-scrollable::-webkit-scrollbar {
      width: 6px;
    }

    .timeline-scrollable::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 3px;
    }

    .timeline-scrollable::-webkit-scrollbar-thumb {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-radius: 3px;

      &:hover {
        background: linear-gradient(135deg, #5a67d8, #6b46c1);
      }
    }

    /* Dark mode scrollbar */
    :host-context(.app-dark) {
      .timeline-scrollable::-webkit-scrollbar-track {
        background: #2d3748;
      }

      .timeline-scrollable::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #4a5568, #667eea);

        &:hover {
          background: linear-gradient(135deg, #667eea, #764ba2);
        }
      }
    }

    /* Responsive adjustments */
    @media (max-width: 480px) {
      ::ng-deep .p-timeline-event-content {
        margin-left: 35px !important;
        width: calc(100% - 45px) !important;
        padding: 0.75rem !important;
      }

      .timeline-header {
        padding: 0.75rem !important;
        height: 6rem !important;

        h5 {
          font-size: 0.9rem !important;
        }
      }

      .timeline-scrollable {
        padding: 1rem 0.75rem !important;
      }

      ::ng-deep {
        .event-action .action-link {
          font-size: 0.8rem !important;
        }

        .event-description {
          font-size: 0.75rem !important;
        }

        .event-timestamp {
          font-size: 0.7rem !important;
        }
      }
    }

    /* Print styles */
    @media print {
      .timeline-container {
        border: 1px solid #000 !important;
        box-shadow: none !important;
      }

      .timeline-header {
        background: #f5f5f5 !important;
        color: #000 !important;
      }

      ::ng-deep .p-timeline-event-content {
        box-shadow: none !important;
        border: 1px solid #ccc !important;
      }
    }
    }
    }
  `]
})
export class TransactionTimelineComponent {
  @Input({ required: true }) transactionDetails!: TransactionDetailsResponse | null;
  @Input() transactionId?: string;

  private filtersService = inject(FiltersService);
  private urlBuilder = inject(UrlBuilderService);

  // Pre-process events once with all computed data to avoid repeated function calls
  public readonly processedEvents = computed(() => {
    const timeline = this.transactionDetails?.TRANSACTION_TIMELINE || [];
    
    return timeline.map(event => ({
      ...event,
      isCurrent: this.isCurrentTransaction(event),
      formattedTime: this.formatTime(event.time),
      searchLink: this.urlBuilder.buildSearchLink(event.action)
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
}
