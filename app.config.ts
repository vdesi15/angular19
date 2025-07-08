import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideOAuthClient, OAuthStorage } from 'angular-oauth2-oidc';
import { ApmModule, ApmErrorHandler } from '@elastic/apm-rum-angular'
import { ConfigService } from './core/services/config.service';
import { mockApiInterceptor } from './core/interceptors/mock-api.interceptor';
import { ConfirmationService, MessageService } from 'primeng/api';

const runtimeConfig = new ConfigService();

// Custom storage factory to use sessionStorage instead of localStorage
export function storageFactory(): OAuthStorage {
  return sessionStorage;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.app-dark',
          prefix: 'p',
          cssLayer: false
        }
      },
      ripple: true
    }),
    provideHttpClient(
      withInterceptors([mockApiInterceptor])
    ),
    importProvidersFrom(ApmModule),
    provideOAuthClient({
      resourceServer: {
        allowedUrls: [runtimeConfig.get('api.baseUrl')],
        sendAccessToken: true
      }
    }),
    { provide: OAuthStorage, useFactory: storageFactory },
    {provide: ErrorHandler, useClass: ApmErrorHandler},
    MessageService,
    ConfirmationService
  ]
};