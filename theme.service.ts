// src/app/core/services/theme.service.ts
import { Injectable, signal, effect, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'app-theme';
  
  // Default to dark mode
  public readonly isDarkMode: WritableSignal<boolean> = signal(true);

  constructor() {
    // Load theme from localStorage or default to dark
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const prefersDark = savedTheme === 'dark' || (!savedTheme);
    this.isDarkMode.set(prefersDark);

    // Apply theme effect
    effect(() => {
      this.applyTheme(this.isDarkMode());
    });
  }

  /**
   * Toggle between light and dark mode
   */
  public toggleTheme(): void {
    this.isDarkMode.update(isDark => !isDark);
  }

  /**
   * Set specific theme
   */
  public setTheme(isDark: boolean): void {
    this.isDarkMode.set(isDark);
  }

  /**
   * Apply theme to document
   */
  private applyTheme(isDark: boolean): void {
    const theme = isDark ? 'dark' : 'light';
    const htmlElement = document.documentElement;
    
    // Remove existing theme classes
    htmlElement.classList.remove('light-theme', 'dark-theme');
    
    // Add new theme class
    htmlElement.classList.add(`${theme}-theme`);
    
    // Set data attribute for PrimeNG
    htmlElement.setAttribute('data-theme', theme);
    
    // Save to localStorage
    localStorage.setItem(this.THEME_KEY, theme);
    
    console.log(`[ThemeService] Applied ${theme} theme`);
  }

  /**
   * Get current theme name
   */
  public getCurrentTheme(): string {
    return this.isDarkMode() ? 'dark' : 'light';
  }
}