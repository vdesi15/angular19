// src/app/core/guards/authentication.guard.ts - ENHANCED FOR STATE ISSUES
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, of } from 'rxjs';
import { map, catchError, tap, retry, delay } from 'rxjs/operators';

/**
 * Enhanced Authentication Guard that handles state parameter issues
 */
export const authenticationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot, 
  state: RouterStateSnapshot
): Observable<boolean> => {
  const oidcSecurityService = inject(OidcSecurityService);
  const router = inject(Router);

  console.log('[AuthenticationGuard] Checking authentication for:', state.url);

  return oidcSecurityService.checkAuth().pipe(
    // Add retry logic for state validation issues
    retry({
      count: 2,
      delay: (error, retryCount) => {
        console.log(`[AuthenticationGuard] Retry attempt ${retryCount} due to:`, error);
        return of(null).pipe(delay(300));
      }
    }),
    tap(loginResponse => {
      console.log('[AuthenticationGuard] Auth check result:', {
        isAuthenticated: loginResponse.isAuthenticated,
        hasAccessToken: !!loginResponse.accessToken,
        errorMessage: loginResponse.errorMessage,
        configId: loginResponse.configId
      });
    }),
    map(loginResponse => {
      // If user is authenticated, allow navigation
      if (loginResponse.isAuthenticated) {
        console.log('[AuthenticationGuard] User authenticated - allowing navigation');
        return true;
      }

      // Handle state validation errors specifically
      if (loginResponse.errorMessage?.toLowerCase().includes('state')) {
        console.warn('[AuthenticationGuard] State validation error detected');
        
        // Clear potentially corrupted OIDC storage
        clearCorruptedOidcStorage();
        
        // If we're already on a callback URL, let it handle the error
        if (isCallbackUrl(state.url)) {
          console.log('[AuthenticationGuard] On callback URL, letting callback component handle state error');
          return true;
        }
        
        console.log('[AuthenticationGuard] Starting fresh auth flow due to state error');
      }

      // Handle other authentication errors
      if (loginResponse.errorMessage) {
        console.error('[AuthenticationGuard] Authentication error:', loginResponse.errorMessage);
        
        // If we're on a callback URL, let the callback component handle it
        if (isCallbackUrl(state.url)) {
          return true;
        }
      }

      // User not authenticated - start authorization flow
      console.log('[AuthenticationGuard] User not authenticated, starting auth flow');

      // Save URL only if it's not a callback URL and not already saved
      if (!isCallbackUrl(state.url)) {
        const existingSavedUrl = sessionStorage.getItem('pre_auth_url');
        if (!existingSavedUrl || existingSavedUrl !== state.url) {
          console.log('[AuthenticationGuard] Saving current URL before auth:', state.url);
          
          // Add timestamp to prevent conflicts
          const urlWithTimestamp = `${state.url}${state.url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
          sessionStorage.setItem('pre_auth_url', state.url); // Save original URL without timestamp
          sessionStorage.setItem('pre_auth_timestamp', Date.now().toString());
        }
      }

      // Start the authorization flow
      oidcSecurityService.authorize();
      
      return false; // Block navigation - user will be redirected to auth
    }),
    catchError(error => {
      console.error('[AuthenticationGuard] Unexpected error during auth check:', error);
      
      // If we're on a callback URL, let it proceed to handle the error
      if (isCallbackUrl(state.url)) {
        return of(true);
      }
      
      // For state-related errors, clear storage and restart
      if (error.message?.toLowerCase().includes('state')) {
        console.log('[AuthenticationGuard] State error caught, clearing storage and restarting auth');
        clearCorruptedOidcStorage();
      }
      
      // Try to restart auth flow
      console.log('[AuthenticationGuard] Restarting auth flow due to error');
      oidcSecurityService.authorize();
      return of(false);
    })
  );
};

/**
 * Clear potentially corrupted OIDC storage that causes state issues
 */
function clearCorruptedOidcStorage(): void {
  try {
    console.log('[AuthenticationGuard] Clearing potentially corrupted OIDC storage');
    
    // Clear specific OIDC items that can cause state conflicts
    const itemsToRemove = [
      'oidc.silent.redirect',
      'oidc.redirect',
      'oidc_storage_silent_redirect',
      'oidc_storage_authorize_request'
    ];
    
    itemsToRemove.forEach(item => {
      sessionStorage.removeItem(item);
      localStorage.removeItem(item);
    });
    
    // Clear any items with 'oidc' and 'state' or 'nonce' in the key
    const sessionKeys = Object.keys(sessionStorage);
    const localKeys = Object.keys(localStorage);
    
    [...sessionKeys, ...localKeys].forEach(key => {
      if (key.includes('oidc') && (key.includes('state') || key.includes('nonce'))) {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      }
    });
    
  } catch (error) {
    console.warn('[AuthenticationGuard] Failed to clear OIDC storage:', error);
  }
}

/**
 * Utility function to check if a URL is a callback URL
 */
function isCallbackUrl(url: string): boolean {
  const callbackPatterns = [
    '/signin-oidc',
    '/auth/callback',
    'code=',
    'state=',
    'error=',
    'access_token=',
    'id_token='
  ];
  
  return callbackPatterns.some(pattern => url.includes(pattern));
}