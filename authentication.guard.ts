// src/app/core/guards/authentication.guard.ts - FIXED VERSION
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { OidcSecurityService, LoginResponse } from 'angular-auth-oidc-client';
import { Observable, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

/**
 * Fixed authentication guard that properly handles OIDC callback flow
 */
export const authenticationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot, 
  state: RouterStateSnapshot
): Observable<boolean> => {
  const oidcSecurityService = inject(OidcSecurityService);
  const router = inject(Router);

  console.log('[AuthenticationGuard] Checking authentication for:', state.url);

  // 🔥 Check if this is a callback URL - if so, let it through
  if (isCallbackUrl(state.url)) {
    console.log('[AuthenticationGuard] Callback URL detected, allowing through');
    return of(true);
  }

  return oidcSecurityService.checkAuth().pipe(
    tap((loginResponse: LoginResponse) => {
      console.log('[AuthenticationGuard] Auth check result:', {
        isAuthenticated: loginResponse.isAuthenticated,
        hasAccessToken: !!loginResponse.accessToken,
        errorMessage: loginResponse.errorMessage,
        validationResult: loginResponse.validationResult
      });
    }),
    switchMap((loginResponse: LoginResponse) => {
      if (loginResponse.isAuthenticated) {
        console.log('[AuthenticationGuard] User is authenticated');
        
        // 🔄 Check if we need to restore a saved URL
        const savedUrl = sessionStorage.getItem('pre_auth_url');
        if (savedUrl && savedUrl !== state.url && !isCallbackUrl(savedUrl)) {
          console.log('[AuthenticationGuard] Restoring saved URL:', savedUrl);
          sessionStorage.removeItem('pre_auth_url');
          router.navigateByUrl(savedUrl);
          return of(false); // Prevent current navigation
        }
        
        return of(true);
      }

      // Handle authentication error
      if (loginResponse.errorMessage) {
        console.error('[AuthenticationGuard] Authentication error:', loginResponse.errorMessage);
        return of(false);
      }

      console.log('[AuthenticationGuard] User not authenticated. Starting authorization flow...');
      
      // 💾 Store current URL before redirect (only if not a callback URL)
      if (!isCallbackUrl(state.url)) {
        console.log('[AuthenticationGuard] Storing URL before auth:', state.url);
        sessionStorage.setItem('pre_auth_url', state.url);
      }
      
      oidcSecurityService.authorize();
      return of(false);
    })
  );
};

// Helper function to detect callback URLs
function isCallbackUrl(url: string): boolean {
  return url.includes('code=') || 
         url.includes('signin-oidc') || 
         url.includes('auth/callback') ||
         url.includes('access_token=') ||
         url.includes('id_token=');
}