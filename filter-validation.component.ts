import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { FiltersService } from 'src/app/core/services/filters.service';

@Component({
  selector: 'app-filter-validation',
  standalone: true,
  imports: [CommonModule, ButtonModule, MessageModule],
  template: `
    <div class="filter-validation-container">
      <p-message 
        severity="info" 
        [closable]="false"
        styleClass="filter-validation-message">
        <ng-template pTemplate="icon">
          <i class="pi pi-info-circle"></i>
        </ng-template>
        <div class="message-content">
          <div class="message-text">
            <h4>Filters Required</h4>
            <p>Please select all required filters to view the data stream:</p>
            <ul class="missing-filters-list">
              @if (missingFilters().includes('application')) {
                <li><i class="pi pi-circle-fill"></i> Application</li>
              }
              @if (missingFilters().includes('environment')) {
                <li><i class="pi pi-circle-fill"></i> Environment</li>
              }
              @if (missingFilters().includes('location')) {
                <li><i class="pi pi-circle-fill"></i> Location</li>
              }
            </ul>
          </div>
          <div class="message-actions">
            <p-button 
              label="Go to Filters" 
              icon="pi pi-filter" 
              severity="info"
              [outlined]="true"
              (click)="scrollToFilters()">
            </p-button>
          </div>
        </div>
      </p-message>
    </div>
  `,
  styles: [`
    .filter-validation-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
      padding: 2rem;
    }

    :host ::ng-deep .filter-validation-message {
      max-width: 500px;
      width: 100%;
      
      .p-message-wrapper {
        padding: 2rem;
        border-radius: 8px;
        background: var(--p-surface-50);
        border: 1px solid var(--p-primary-200);
      }

      .p-message-icon {
        font-size: 1.5rem;
        color: var(--p-primary-color);
        margin-right: 1rem;
      }
    }

    .message-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .message-text {
      h4 {
        margin: 0 0 0.5rem 0;
        color: var(--p-text-color);
        font-size: 1.1rem;
        font-weight: 600;
      }

      p {
        margin: 0 0 1rem 0;
        color: var(--p-text-muted-color);
      }
    }

    .missing-filters-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--p-text-color);
        font-weight: 500;

        .pi-circle-fill {
          font-size: 0.5rem;
          color: var(--p-primary-color);
        }
      }
    }

    .message-actions {
      display: flex;
      justify-content: center;
    }

    // Dark mode
    :host-context(.app-dark) ::ng-deep .filter-validation-message {
      .p-message-wrapper {
        background: var(--p-surface-800);
        border-color: var(--p-primary-600);
      }
    }
  `]
})
export class FilterValidationComponent {
  private filtersService = inject(FiltersService);

  // Computed to check which filters are missing
  public missingFilters = computed(() => {
    const filters = this.filtersService.filters();
    const missing: string[] = [];

    if (!filters?.application || filters.application.length === 0) {
      missing.push('application');
    }
    if (!filters?.environment) {
      missing.push('environment');
    }
    if (!filters?.location) {
      missing.push('location');
    }

    return missing;
  });

  // Check if all required filters are selected
  public areFiltersValid = computed(() => {
    return this.missingFilters().length === 0;
  });

  // Scroll to filters section
  public scrollToFilters(): void {
    const filtersElement = document.querySelector('.filters-bar-container');
    if (filtersElement) {
      filtersElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }
}