// src/app/core/guards/authentication.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { OidcSecurityService, LoginResponse } from 'angular-auth-oidc-client';
import { Observable, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { signal } from '@angular/core';

/**
 * Enhanced authentication guard with URL preservation.
 * Uses Angular 19 patterns and preserves the full URL during auth flow.
 * 
 * Key improvements:
 * - Preserves complete URL with query parameters
 * - Better error handling and logging
 * - Reactive state management with signals
 * - Prevents multiple concurrent auth attempts
 */

// Signal to track authentication state
const authenticationState = signal<'idle' | 'checking' | 'authenticating'>('idle');

export const authenticationGuard: CanActivateFn = (route: ActivatedRouteSnapshot): Observable<boolean> => {
  const oidcSecurityService = inject(OidcSecurityService);
  const router = inject(Router);

  console.log('[AuthenticationGuard] Checking authentication for route:', route.routeConfig?.path);

  // Prevent concurrent authentication attempts
  if (authenticationState() === 'authenticating') {
    console.log('[AuthenticationGuard] Authentication already in progress, waiting...');
    return of(false);
  }

  authenticationState.set('checking');

  return oidcSecurityService.checkAuth().pipe(
    tap((loginResponse: LoginResponse) => {
      console.log('[AuthenticationGuard] Auth check result:', {
        isAuthenticated: loginResponse.isAuthenticated,
        hasToken: !!loginResponse.accessToken,
        configId: loginResponse.configId
      });
    }),
    switchMap((loginResponse: LoginResponse) => {
      if (loginResponse.isAuthenticated) {
        console.log('[AuthenticationGuard] User is authenticated, allowing navigation');
        authenticationState.set('idle');
        return of(true);
      }

      console.log('[AuthenticationGuard] User not authenticated, starting authorization flow');
      
      // Preserve the current URL with all parameters
      const fullUrl = router.url;
      console.log('[AuthenticationGuard] Preserving URL for post-auth redirect:', fullUrl);
      
      // Store the URL in session storage for retrieval after auth
      try {
        sessionStorage.setItem('auth_redirect_url', fullUrl);
      } catch (error) {
        console.warn('[AuthenticationGuard] Could not store redirect URL:', error);
      }

      authenticationState.set('authenticating');
      
      // Start the authorization flow
      oidcSecurityService.authorize();
      
      return of(false);
    })
  );
};