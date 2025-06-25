// src/app/core/guards/authentication.guard.ts - Enhanced to store URL
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { OidcSecurityService, LoginResponse } from 'angular-auth-oidc-client';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

/**
 * Enhanced authentication guard that preserves URL during OIDC flow
 */
export const authenticationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot, 
  state: RouterStateSnapshot
): Observable<boolean> => {
  const oidcSecurityService = inject(OidcSecurityService);
  const router = inject(Router);

  return oidcSecurityService.checkAuth().pipe(
    switchMap((loginResponse: LoginResponse) => {
      if (loginResponse.isAuthenticated) {
        console.log('[AuthenticationGuard] Access granted. User is authenticated.');
        
        const savedUrl = sessionStorage.getItem('pre_auth_url');
        if (savedUrl && savedUrl !== state.url) {
          console.log('[AuthenticationGuard] Restoring saved URL:', savedUrl);
          sessionStorage.removeItem('pre_auth_url');
          router.navigateByUrl(savedUrl);
          return of(false); // Prevent current navigation, we're redirecting
        }
        
        return of(true);
      }

      console.log('[AuthenticationGuard] User not authenticated. Starting authorization flow...');
      
      const currentUrl = state.url;
      console.log('[AuthenticationGuard] Storing URL before auth:', currentUrl);
      sessionStorage.setItem('pre_auth_url', currentUrl);
      
      oidcSecurityService.authorize();
      return of(false);
    })
  );
};