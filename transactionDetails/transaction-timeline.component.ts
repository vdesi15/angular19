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
   // ================================
// TIMELINE CONTAINER - Keep existing
// ================================
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

// ================================
// HEADER - Just title, no footer here
// ================================
.timeline-header {
  height: 7rem !important;
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

// ================================
// SCROLLABLE AREA - Keep existing
// ================================
.timeline-scrollable {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.5rem 1rem;
  position: relative;
  background: linear-gradient(to bottom, #f8fafc 0%, white 100%);
}

// ================================
// 🔥 NEW: INFO FOOTER - At bottom of container
// ================================
.timeline-info-footer {
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  border-top: 2px solid #5a67d8;
  flex-shrink: 0;
}

// ================================
// 🔥 FIXED: TIMELINE LAYOUT - Proper circles and lines
// ================================
:host ::ng-deep {
  
  .p-timeline-event-opposite {
    display: none !important;
  }

  .p-timeline-event {
    position: relative !important;
    margin-bottom: 2rem !important;
    display: flex !important;
    align-items: flex-start !important;
  }

  // 🔥 FIXED: Line starts BELOW circle and connects to next circle
  .p-timeline-event-connector {
    position: absolute !important;
    left: 20px !important;
    top: 2rem !important; // 🔥 START: Below the circle (circle is at 0.5rem + 14px height)
    width: 3px !important;
    background: linear-gradient(to bottom, #667eea, #764ba2) !important;
    height: calc(100% - 1rem) !important; // 🔥 HEIGHT: Reach next circle
    border-radius: 2px !important;
    transform: translateX(-50%) !important;
  }

  // 🔥 FIXED: Circle positioning
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

  // Content boxes - keep existing
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

  // 🔥 CURRENT TRANSACTION: Highlighted circle
  .timeline-event-wrapper {
    width: 100% !important;
    
    &.current-transaction {
      .p-timeline-event-content {
        border-color: #f59e0b !important;
        background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
        
        &::before {
          background: linear-gradient(135deg, #f59e0b, #d97706) !important;
        }
      }
      
      .p-timeline-event-marker {
        background: linear-gradient(135deg, #f59e0b, #d97706) !important;
        border: 4px solid white !important;
        width: 16px !important;
        height: 16px !important;
        box-shadow: 0 0 0 3px #fed7aa, 0 4px 12px rgba(245, 158, 11, 0.4) !important;
      }
    }
  }

  // 🔥 LAST EVENT: No line after last circle
  .p-timeline-event:last-child {
    .p-timeline-event-connector {
      display: none !important;
    }
  }

  // Keep existing content styling
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

  .event-description {
    font-size: 0.8rem;
    color: #4a5568 !important;
    line-height: 1.5;
    word-wrap: break-word;
    overflow-wrap: break-word;
    margin-top: 0.5rem;
  }

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

// ================================
// DARK MODE - Updated for footer
// ================================
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
  }

  .timeline-info-footer {
    background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%) !important;
    color: #e2e8f0 !important;
    border-top-color: #4a5568 !important;
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
        border-color: #f59e0b !important;
        background: linear-gradient(135deg, #92400e, #b45309) !important;
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

// Keep existing scrollbar and responsive styles
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