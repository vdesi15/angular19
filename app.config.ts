import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { routes } from './app.routes';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { OidcSecurityService, provideAuth, OpenIdConfiguration } from 'angular-auth-oidc-client';
import { ApmModule, ApmErrorHandler } from '@elastic/apm-rum-angular'
import { ConfigService } from './core/services/config.service';
import { mockApiInterceptor } from './core/interceptors/mock-api.interceptor';
import { ConfirmationService, MessageService } from 'primeng/api';

const runtimeConfig = new ConfigService();

const oauthConfig: OpenIdConfiguration = {
        authority: runtimeConfig.get('oauth').authority,
        redirectUrl: runtimeConfig.get('oauth').redirectUrl,
        postLogoutRedirectUri: runtimeConfig.get('oauth').postLogoutRedirectUri,
        clientId: runtimeConfig.get('oauth').clientId,
        scope: runtimeConfig.get('oauth').scope,
        responseType: runtimeConfig.get('oauth').responseType,
        silentRenew: runtimeConfig.get('oauth').silentRenew,
        useRefreshToken: runtimeConfig.get('oauth').useRefreshToken,
        renewTimeBeforeTokenExpiresInSeconds: runtimeConfig.get('oauth').renewTimeBeforeTokenExpiresInSeconds,
        logLevel: runtimeConfig.get('oauth').logLevel ?? 0,
        autoCleanStateAfterAuthentication: true
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
    provideAuth({config: oauthConfig }),
    {provide: ErrorHandler, useClass: ApmErrorHandler},
    MessageService,
    ConfirmationService
  ]
};
