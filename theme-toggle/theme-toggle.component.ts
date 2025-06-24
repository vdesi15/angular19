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
      class="p-button-text p-button-rounded theme-toggle-btn"
      (click)="themeService.toggleTheme()"
      [pTooltip]="getTooltipText()"
      tooltipPosition="bottom">
    </button>
  `,
  styles: [`
    .theme-toggle-btn {
      width: 2.5rem;
      height: 2.5rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      
      &:hover {
        background-color: var(--surface-hover) !important;
        transform: scale(1.05);
      }
      
      .pi {
        font-size: 1.1rem;
        transition: all 0.3s ease;
      }
      
      // Light mode styling
      .light-mode & {
        color: var(--yellow-600);
        
        &:hover {
          color: var(--yellow-500);
          background-color: var(--yellow-50) !important;
        }
      }
      
      // Dark mode styling  
      .dark-mode & {
        color: var(--blue-300);
        
        &:hover {
          color: var(--blue-200);
          background-color: var(--blue-900) !important;
        }
      }
    }
    
    // Smooth icon transition animation
    @keyframes fadeIn {
      from { opacity: 0; transform: rotate(-180deg); }
      to { opacity: 1; transform: rotate(0deg); }
    }
    
    .theme-toggle-btn .pi {
      animation: fadeIn 0.3s ease-in-out;
    }
  `]
})
export class ThemeToggleComponent {
  public themeService = inject(ThemeService);

  public getTooltipText(): string {
    return this.themeService.isDarkMode() 
      ? 'Switch to light mode' 
      : 'Switch to dark mode';
  }
}