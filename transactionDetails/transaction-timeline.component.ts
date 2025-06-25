// transaction-timeline.component.ts
import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TransactionTimelineItem } from '../models/transaction-details.model';
import { FiltersService } from 'src/app/core/services/filters.service';
import { ConfigService } from 'src/app/core/services/config.service';

interface TimelineEvent {
  status?: string;
  date?: string;
  time?: string;
  action?: string;
  actionLink?: string;
  description?: string;
  id?: string;
  isCurrent?: boolean;
}

@Component({
  selector: 'app-transaction-timeline',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule, ButtonModule, TooltipModule],
  template: `
    <div class="timeline-wrapper">
      <p-timeline 
        [value]="timelineEvents()" 
        layout="vertical" 
        align="left"
        styleClass="transaction-timeline">
        
        <ng-template pTemplate="marker" let-event>
          <div class="timeline-marker" [class.current]="event.isCurrent">
            <i class="pi" [class]="event.isCurrent ? 'pi-circle-fill' : 'pi-circle'"></i>
          </div>
        </ng-template>
        
        <ng-template pTemplate="content" let-event>
          <div class="timeline-card">
            <div class="timeline-content">
              <div class="timeline-time">
                {{ event.time }}
              </div>
              <div class="timeline-action">
                @if (event.actionLink) {
                  <a 
                    [href]="event.actionLink" 
                    target="_blank"
                    class="action-link"
                    pTooltip="Open transaction details">
                    {{ event.action }}
                  </a>
                } @else {
                  <span class="action-text">{{ event.action }}</span>
                }
              </div>
              <div class="timeline-description">
                {{ event.description }}
              </div>
            </div>
          </div>
        </ng-template>
      </p-timeline>
      
      @if (timelineEvents().length === 0) {
        <div class="empty-timeline">
          <i class="pi pi-clock text-2xl text-color-secondary mb-2"></i>
          <p class="text-color-secondary">No timeline events available</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline-wrapper {
      height: 100%;
      padding: 1rem;
      overflow-y: auto;
      background: var(--surface-a);
    }
    
    :host ::ng-deep .transaction-timeline {
      .p-timeline-event-marker {
        background: transparent;
        border: none;
        width: auto;
        height: auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .p-timeline-event-connector {
        background: var(--surface-border);
        width: 2px;
      }
      
      .p-timeline-event-content {
        padding: 0 0 1rem 1rem;
      }
    }
    
    .timeline-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--surface-b);
      border: 2px solid var(--surface-border);
      position: relative;
      z-index: 1;
      
      &.current {
        background: var(--primary-color);
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.2);
        
        .pi {
          color: white;
        }
      }
      
      .pi {
        font-size: 0.7rem;
        color: var(--text-color-secondary);
      }
    }
    
    .timeline-card {
      background: var(--surface-b);
      border: 1px solid var(--surface-border);
      border-radius: var(--border-radius);
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      transition: all 0.2s ease;
      
      &:hover {
        background: var(--surface-hover);
        border-color: var(--primary-color);
        transform: translateX(2px);
      }
    }
    
    .timeline-content {
      font-size: 0.875rem;
    }
    
    .timeline-time {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      margin-bottom: 0.25rem;
      font-weight: 500;
      font-family: var(--font-family-monospace);
    }
    
    .timeline-action {
      margin-bottom: 0.25rem;
      
      .action-link {
        color: var(--primary-color);
        text-decoration: none;
        font-weight: 600;
        
        &:hover {
          text-decoration: underline;
        }
      }
      
      .action-text {
        color: var(--text-color);
        font-weight: 600;
      }
    }
    
    .timeline-description {
      color: var(--text-color-secondary);
      font-size: 0.8rem;
      line-height: 1.4;
    }
    
    .empty-timeline {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      text-align: center;
      color: var(--text-color-secondary);
      
      p {
        margin: 0;
        font-size: 0.875rem;
      }
    }
    
    /* Custom scrollbar */
    .timeline-wrapper::-webkit-scrollbar {
      width: 4px;
    }
    
    .timeline-wrapper::-webkit-scrollbar-track {
      background: var(--surface-ground);
    }
    
    .timeline-wrapper::-webkit-scrollbar-thumb {
      background: var(--surface-border);
      border-radius: 2px;
      
      &:hover {
        background: var(--text-color-secondary);
      }
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .timeline-wrapper {
        padding: 0.75rem;
      }
      
      .timeline-card {
        padding: 0.5rem;
      }
      
      .timeline-content {
        font-size: 0.8rem;
      }
      
      .timeline-time {
        font-size: 0.7rem;
      }
    }
    
    /* Accessibility */
    @media (prefers-reduced-motion: reduce) {
      .timeline-card {
        transition: none;
        
        &:hover {
          transform: none;
        }
      }
    }
  `]
})
export class TransactionTimelineComponent {
  @Input() timelineData: TransactionTimelineItem[] = [];
  @Input() appName = '';
  @Input() environment = '';
  @Input() location = '';

  private filtersService = inject(FiltersService);
  private configService = inject(ConfigService);

  public timelineEvents = computed((): TimelineEvent[] => {
    const items = this.timelineData;
    const baseApi = this.configService.get('api.baseUrl');
    
    return items.map(item => {
      // Format the time
      const formattedTime = this.formatTime(item.time);
      
      // Generate action link if applicable
      const actionLink = this.generateActionLink(item, baseApi);
      
      return {
        status: item.current ? 'current' : 'completed',
        date: item.time,
        time: formattedTime,
        action: item.action,
        actionLink: actionLink,
        description: item.e,
        id: item.id,
        isCurrent: item.current || false
      };
    }).sort((a, b) => {
      // Sort by date to ensure chronological order
      return new Date(a.date || '').getTime() - new Date(b.date || '').getTime();
    });
  });

  private formatTime(timeString: string): string {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });
    } catch (error) {
      return timeString;
    }
  }

  private generateActionLink(item: TransactionTimelineItem, baseApi: string): string | null {
    // Generate link to transaction details if we have enough info
    if (baseApi && this.appName && this.environment && this.location) {
      // Example: /logs/transaction/{app}/{env}/{location}/{transactionId}
      return `${baseApi}/logs/transaction/${this.appName}/${this.environment}/${this.location}/${item.id}`;
    }
    return null;
  }
}