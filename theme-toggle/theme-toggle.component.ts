// src/app/shared/components/theme-toggle/theme-toggle.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ThemeService } from 'src/app/core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  template: `
    <button 
      pButton 
      type="button" 
      [icon]="themeService.isDarkMode() ? 'pi pi-sun' : 'pi pi-moon'"
      [label]="getButtonLabel()"
      class="p-button-text theme-toggle-btn"
      (click)="themeService.toggleTheme()"
      [pTooltip]="getTooltipText()"
      tooltipPosition="bottom">
    </button>
  `,
  styles: [`
    .theme-toggle-btn {
      height: 3rem !important; // Match header height
      padding: 0.5rem 0.75rem !important;
      font-size: 0.875rem !important;
      border-radius: 6px !important;
      transition: all 0.2s ease;
      white-space: nowrap;
      
      &:hover {
        background-color: var(--p-content-hover-background) !important;
        transform: none; // Remove scale transform
      }
      
      .pi {
        font-size: 1rem;
        margin-right: 0.5rem;
      }
      
      // Ensure no overflow from the button
      overflow: hidden;
      box-sizing: border-box;
    }
  `]
})
export class ThemeToggleComponent {
  public themeService = inject(ThemeService);

  public getButtonLabel(): string {
    return this.themeService.isDarkMode() ? 'Light Mode' : 'Dark Mode';
  }

  public getTooltipText(): string {
    return this.themeService.isDarkMode() 
      ? 'Switch to light mode' 
      : 'Switch to dark mode';
  }
}