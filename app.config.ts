// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { CustomPreset } from './theme/custom-preset';
import { PostAuthRedirectService } from './core/services/post-auth-redirect.service';
import { ThemeService } from './core/services/theme.service';
import { LoadingService } from './core/services/loading.service';

/**
 * Enhanced application configuration using Angular 19 features.
 * 
 * Key improvements:
 * - Proper service initialization order
 * - Better router configuration with blocking navigation
 * - Enhanced HTTP client setup
 * - Optimized PrimeNG configuration
 * - Service initialization via APP_INITIALIZER
 */

/**
 * Application initializer function
 */
function initializeApplication(): () => Promise<void> {
  return () => {
    console.log('[AppConfig] Initializing application services');
    
    // Perform any synchronous initialization here
    // Services with DI will auto-initialize when injected
    
    return Promise.resolve();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    // ================================
    // ROUTER CONFIGURATION
    // ================================
    provideRouter(
      routes,
      withEnabledBlockingInitialNavigation(), // Prevents flicker during initial load
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      })
    ),

    // ================================
    // HTTP CLIENT CONFIGURATION
    // ================================
    provideHttpClient(
      // Add interceptors here when needed
      // withInterceptors([authInterceptor, errorInterceptor])
    ),

    // ================================
    // ANIMATIONS
    // ================================
    provideAnimationsAsync(),
    
    // ================================
    // PRIMENG CONFIGURATION
    // ================================
    providePrimeNG({
      theme: {
        preset: CustomPreset,
        options: {
          prefix: 'p',
          darkModeSelector: '.app-dark',
          cssLayer: false
        }
      },
      ripple: {
        disabled: false // Enable ripple effects
      },
      inputStyle: 'outlined', // Use outlined input style
      locale: 'en' // Set default locale
    }),

    // ================================
    // APPLICATION INITIALIZERS
    // ================================
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApplication,
      multi: true
    },

    // ================================
    // CORE SERVICES
    // ================================
    // These services are provided here to ensure they're available app-wide
    // and initialized in the correct order
    
    PostAuthRedirectService,
    ThemeService,
    LoadingService,

    // ================================
    // DEVELOPMENT/DEBUG PROVIDERS
    // ================================
    // Add development-specific providers here
    // {
    //   provide: 'DEBUG_MODE',
    //   useValue: !environment.production
    // }
  ]
};