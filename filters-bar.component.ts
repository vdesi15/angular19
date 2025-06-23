import { Component, computed, inject, Signal, WritableSignal, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

// --- PrimeNG Modules ---
import { MultiSelectModule } from 'primeng/multiselect';
import { FloatLabelModule } from 'primeng/floatlabel';
import { SkeletonModule } from 'primeng/skeleton';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { PopoverModule } from 'primeng/popover';
import { Popover } from 'primeng/popover';

// --- App Components, Models & Services ---
import { SearchFilterService } from '../../services/filters.service';
import { SearchFilterModel, SearchFilterMetadata, DateTimeRange } from '../../models/search-filter.model';
import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';

@Component({
  selector: 'app-filters-bar',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MultiSelectModule, FloatLabelModule, SkeletonModule,
    InputGroupModule, InputTextModule, PopoverModule, DateRangePickerComponent
  ],
  templateUrl: './filters-bar.component.html',
  styleUrls: ['./filters-bar.component.scss']
})
export class FiltersBarComponent {
  private searchFilterService = inject(SearchFilterService);
  private router = inject(Router);

  // --- Get the "source of truth" signals from the service ---
  private serviceFilters = this.searchFilterService.filters;
  public searchFilterMetadata = this.searchFilterService.searchFilterMetadata;
  
  // --- Local UI State Signals ---
  public selectedApplications: WritableSignal<string[]> = signal([]);
  public selectedEnvironment: WritableSignal<string[]> = signal([]);
  public selectedLocation: WritableSignal<string[]> = signal([]);
  public dateRangeInputText: WritableSignal<string | null> = signal(null);

  // --- Visibility Signals ---
  public showDatePicker = computed(() => {
    const route = this.router.routerState.snapshot.root;
    const active = this.findActiveRoute(route);
    const allowed = active.data['allowedFilters'] || [];
    return allowed.includes('dateRange');
  });

  constructor() {
    // This effect syncs the central service state to our local UI signals
    effect(() => {
      const filters = this.serviceFilters();
      if (filters) {
        this.selectedApplications.set(filters.application ?? []);
        this.selectedEnvironment.set(filters.environment ? [filters.environment] : []);
        this.selectedLocation.set(filters.location ? [filters.location] : []);
        this.dateRangeInputText.set(filters.dateRange?.text || null);
      }
    });
  }

  // --- Computed signals for dropdown options ---
  applicationOptions = computed(() => this.searchFilterMetadata()?.applications.map(app => ({ label: app.label, value: app.label })) ?? []);
  environmentOptions = computed(() => Object.keys(this.searchFilterMetadata()?.environments ?? {}).map(env => ({ label: env, value: env })));
  locationOptions = computed(() => {
    const meta = this.searchFilterMetadata();
    const selectedEnv = this.selectedEnvironment()?.[0];
    if (!meta || !selectedEnv) return [];
    return (meta.environments[selectedEnv] ?? []).map(loc => ({ label: loc, value: loc }));
  });

  // --- Event Handlers to update the central state ---
  onApplicationChange(selectedApps: string[]): void { this.searchFilterService.updateFilters({ application: selectedApps }); }
  onEnvironmentChange(selectedEnvArray: string[]): void { this.searchFilterService.updateFilters({ environment: selectedEnvArray[0] ?? '', location: '' }); }
  onLocationChange(selectedLocArray: string[]): void { this.searchFilterService.updateFilters({ location: selectedLocArray[0] ?? '' }); }
  onRangeSelected(range: DateTimeRange, popover: Popover): void {
    this.searchFilterService.updateFilters({ dateRange: range });
    popover.hide();
  }
  
  private findActiveRoute(route: any) {
    while (route.firstChild) { route = route.firstChild; }
    return route;
  }
}