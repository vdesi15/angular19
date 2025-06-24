// src/app/core/services/theme.service.ts
import { Injectable, signal, effect, WritableSignal, DOCUMENT, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private readonly THEME_KEY = 'app-theme';
  
  // Default to dark mode
  public readonly isDarkMode: WritableSignal<boolean> = signal(true);

  // PrimeNG theme URLs
  private readonly themes = {
    light: 'bootstrap4-light-blue', // PrimeNG light theme
    dark: 'bootstrap4-dark-blue'    // PrimeNG dark theme
  };

  constructor() {
    // Load theme from localStorage or default to dark
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const prefersDark = savedTheme === 'dark' || (!savedTheme);
    this.isDarkMode.set(prefersDark);

    // Apply theme effect
    effect(() => {
      this.switchPrimeNGTheme(this.isDarkMode());
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
   * Switch PrimeNG theme dynamically
   */
  private switchPrimeNGTheme(isDark: boolean): void {
    const themeName = isDark ? this.themes.dark : this.themes.light;
    const themeKey = isDark ? 'dark' : 'light';
    
    // Find existing theme link
    const existingThemeLink = this.document.getElementById('app-theme') as HTMLLinkElement;
    
    if (existingThemeLink) {
      // Update existing theme
      existingThemeLink.href = `https://cdn.jsdelivr.net/npm/primeng@19.0.0/resources/themes/${themeName}/theme.css`;
    } else {
      // Create new theme link if it doesn't exist
      const themeLink = this.document.createElement('link');
      themeLink.id = 'app-theme';
      themeLink.rel = 'stylesheet';
      themeLink.type = 'text/css';
      themeLink.href = `https://cdn.jsdelivr.net/npm/primeng@19.0.0/resources/themes/${themeName}/theme.css`;
      this.document.head.appendChild(themeLink);
    }
    
    // Add data attribute for any custom styles that need theme awareness
    this.document.documentElement.setAttribute('data-theme', themeKey);
    
    // Save to localStorage
    localStorage.setItem(this.THEME_KEY, themeKey);
    
    console.log(`[ThemeService] Applied PrimeNG ${themeKey} theme: ${themeName}`);
  }

  /**
   * Get current theme name
   */
  public getCurrentTheme(): string {
    return this.isDarkMode() ? 'dark' : 'light';
  }

  /**
   * Get current PrimeNG theme name
   */
  public getCurrentPrimeNGTheme(): string {
    return this.isDarkMode() ? this.themes.dark : this.themes.light;
  }
}