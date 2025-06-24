// src/app/core/services/theme.service.ts
import { Injectable, signal, effect, inject, DOCUMENT, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private readonly STORAGE_KEY = 'app-theme-mode';
  private readonly DARK_MODE_CLASS = 'app-dark';

  // Signal for current theme mode - default to dark
  public readonly currentMode = signal<ThemeMode>('dark');
  
  // Computed signal for dark mode state
  public readonly isDarkMode = computed(() => this.currentMode() === 'dark');

  constructor() {
    // Load saved theme or default to dark
    this.loadSavedTheme();
    
    // Effect to update DOM when theme changes
    effect(() => {
      this.applyTheme(this.currentMode());
      this.saveTheme(this.currentMode());
    });
  }

  /**
   * Toggle between light and dark mode
   */
  public toggleTheme(): void {
    this.currentMode.update(mode => mode === 'light' ? 'dark' : 'light');
  }

  /**
   * Set specific theme mode
   */
  public setTheme(mode: ThemeMode): void {
    this.currentMode.set(mode);
  }

  /**
   * Apply theme to DOM using PrimeNG's darkModeSelector approach
   */
  private applyTheme(mode: ThemeMode): void {
    const htmlElement = this.document.documentElement;
    
    if (mode === 'dark') {
      htmlElement.classList.add(this.DARK_MODE_CLASS);
    } else {
      htmlElement.classList.remove(this.DARK_MODE_CLASS);
    }
    
    console.log(`[ThemeService] Applied ${mode} theme with class: ${this.DARK_MODE_CLASS}`);
  }

  /**
   * Load saved theme from localStorage
   */
  private loadSavedTheme(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY) as ThemeMode;
      if (saved && (saved === 'light' || saved === 'dark')) {
        this.currentMode.set(saved);
      }
      // If no saved theme, defaults to 'dark' from signal initialization
    } catch (error) {
      console.warn('[ThemeService] Failed to load saved theme:', error);
      // Defaults to 'dark' from signal initialization
    }
  }

  /**
   * Save theme to localStorage
   */
  private saveTheme(mode: ThemeMode): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, mode);
    } catch (error) {
      console.warn('[ThemeService] Failed to save theme:', error);
    }
  }

  /**
   * Get theme-aware color values using PrimeNG design tokens
   */
  public getThemedColor(lightColor: string, darkColor: string): string {
    return this.isDarkMode() ? darkColor : lightColor;
  }

  /**
   * Check system preference
   */
  public getSystemThemePreference(): ThemeMode {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
}