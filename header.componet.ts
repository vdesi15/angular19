// src/app/core/components/header/header.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ThemeToggleComponent } from 'src/app/shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, ThemeToggleComponent],
  template: `
    <header class="app-header">
      <div class="header-content">
        <!-- Left side - Logo/Brand -->
        <div class="header-left">
          <a routerLink="/" class="brand-link">
            <i class="pi pi-chart-line brand-icon"></i>
            <span class="brand-text">Log Analytics</span>
          </a>
        </div>
        
        <!-- Center - Could add breadcrumbs or search here -->
        <div class="header-center">
          <!-- Reserved for future use -->
        </div>
        
        <!-- Right side - Actions -->
        <div class="header-right">
          <app-theme-toggle></app-theme-toggle>
          
          <!-- User menu could go here -->
          <button 
            type="button"
            class="p-button p-button-text p-button-rounded user-menu-btn"
            title="User menu">
            <i class="pi pi-user"></i>
          </button>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
      padding: 0;
      height: 4rem;
      display: flex;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    
    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0 1.5rem;
      height: 100%;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      
      .brand-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        text-decoration: none;
        color: var(--text-color);
        font-weight: 600;
        font-size: 1.25rem;
        transition: color 0.2s ease;
        
        &:hover {
          color: var(--primary-color);
        }
        
        .brand-icon {
          font-size: 1.5rem;
          color: var(--primary-color);
        }
        
        .brand-text {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          letter-spacing: -0.02em;
        }
      }
    }
    
    .header-center {
      flex: 1;
      display: flex;
      justify-content: center;
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      .user-menu-btn {
        width: 2.5rem;
        height: 2.5rem;
        color: var(--text-color-secondary);
        
        &:hover {
          background-color: var(--surface-hover);
          color: var(--text-color);
        }
        
        .pi {
          font-size: 1.1rem;
        }
      }
    }
    
    // Responsive design
    @media (max-width: 768px) {
      .header-content {
        padding: 0 1rem;
      }
      
      .brand-text {
        display: none;
      }
      
      .header-right {
        gap: 0.25rem;
      }
    }
  `]
})
export class HeaderComponent {
  // Component logic here if needed
}