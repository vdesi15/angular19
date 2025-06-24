// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { CustomPreset } from './theme/custom-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),
    
    // ✅ PrimeNG Configuration following best practices
    providePrimeNG({
      theme: {
        preset: CustomPreset,
        options: {
          prefix: 'p',
          darkModeSelector: '.app-dark', // Matches our ThemeService
          cssLayer: false
        }
      }
    }),
    
    // Add other providers here
  ]
};