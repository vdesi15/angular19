import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { OidcSecurityService, LoginResponse } from 'angular-auth-oidc-client';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

/**
 * This guard ensures that a user is authenticated. Its only job is to
 * check for a valid login session and trigger the login flow if needed.
 */
export const authenticationGuard: CanActivateFn = (): Observable<boolean> => {
  const oidcSecurityService = inject(OidcSecurityService);

  return oidcSecurityService.checkAuth().pipe(
    switchMap((loginResponse: LoginResponse) => {
      if (loginResponse.isAuthenticated) {
        console.log('[AuthenticationGuard] Access granted. User is authenticated.');
        return of(true);
      }

      console.log('[AuthenticationGuard] User not authenticated. Starting authorization flow...');
      oidcSecurityService.authorize();
      return of(false);
    })
  );
};