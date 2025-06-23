// transaction-timeline.component.ts
import { Component, Input, computed, inject, signal } from '@angular/core';
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
    <div class="timeline-container">
      <div class="timeline-header">
        <h4>Timeline for {{ timelineKey() }}</h4>
        <span class="timeline-count">{{ timelineEvents().length }} events</span>
      </div>
      
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
          <p-card styleClass="timeline-card">
            <div class="timeline-content">
              <div class="timeline-time">
                {{ event.time }}
              </div>
              <div class="timeline-action">
                <a 
                  [href]="event.actionLink" 
                  target="_blank"
                  class="action-link"
                  pTooltip="Open transaction details">
                  {{ event.action }}
                </a>
              </div>
              <div class="timeline-description">
                {{ event.description }}
              </div>
            </div>
          </p-card>
        </ng-template>
      </p-timeline>
    </div>
  `,
  styles: [`
    .timeline-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--surface-a);
      border-radius: 6px;
      overflow: hidden;
    }
    
    .timeline-header {
      padding: 1rem;
      background: var(--surface-b);
      border-bottom: 1px solid var(--surface-d);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .timeline-header h4 {
      margin: 0;
      color: var(--text-color);
      font-size: 1rem;
    }
    
    .timeline-count {
      font-size: 0.8rem;
      color: var(--text-color-secondary);
      background: var(--surface-c);
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
    }
    
    :host ::ng-deep .transaction-timeline {
      padding: 1rem;
      height: 100%;
      overflow-y: auto;
      
      .p-timeline-event-marker {
        background: transparent;
        border: none;
        width: auto;
        height: auto;
      }
      
      .p-timeline-event-connector {
        background: var(--surface-d);
      }
    }
    
    .timeline-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--surface-b);
      border: 2px solid var(--surface-d);
      
      &.current {
        background: var(--primary-color);
        border-color: var(--primary-color);
        
        .pi {
          color: white;
        }
      }
      
      .pi {
        font-size: 0.8rem;
        color: var(--text-color-secondary);
      }
    }
    
    :host ::ng-deep .timeline-card {
      margin-bottom: 0.5rem;
      
      .p-card-body {
        padding: 0.75rem;
      }
      
      .p-card-content {
        padding: 0;
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
    }
    
    .timeline-action {
      margin-bottom: 0.25rem;
      
      .action-link {
        color: var(--primary-color);
        text-decoration: none;
        font-weight: 500;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
    
    .timeline-description {
      color: var(--text-color-secondary);
      font-size: 0.8rem;
      line-height: 1.4;
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

  public timelineKey = computed(() => {
    const items = this.timelineData;
    if (items.length > 0) {
      return items[0].l || 'Transaction';
    }
    return 'Transaction';
  });

  public timelineEvents = computed((): TimelineEvent[] => {
    const items = this.timelineData;
    const timezone = this.filtersService.filters()?.timezone || 'UTC';
    const baseApi = this.configService.get('api.baseUrl');

    return items.map(item => ({
      status: item.current ? 'current' : 'normal',
      time: this.formatTimeInTimezone(item.time, timezone),
      action: item.action,
      actionLink: `${baseApi}/gettxndetails/${this.appName}/${this.environment}/${this.location}/${item.id}`,
      description: item.e,
      id: item.id,
      isCurrent: item.current || false
    }));
  });

  private formatTimeInTimezone(timeString: string, timezone: string): string {
    try {
      const date = new Date(timeString);
      return date.toLocaleString('en-US', { 
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return timeString;
    }
  }
}