import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, switchMap, filter } from 'rxjs/operators';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';

export const authorizationGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const configService = inject(ConfigService);
  const router = inject(Router);

  // --- KEY CHANGE: WAIT FOR INITIALIZATION FIRST ---
  // We must wait for the auth service to finish its initial check (isLoading === false)
  // before we can trust any of its state signals (like isAuthenticated or userInfo).
  return toObservable(authService.isLoading).pipe(
    // 1. Wait for loading to be complete.
    filter(loading => !loading),
    take(1),
    // 2. Once loading is done, switch to a new observable sequence to check permissions.
    switchMap(() => {
      // 3. NOW it is safe to check hasValidSession().
      if (!authService.hasValidSession()) {
        console.log('[AuthorizationGuard] No valid session after init. Denying access.');
        return of(router.parseUrl('/access-denied'));
      }

      // 4. If the session is valid, proceed to check the user profile for groups.
      return toObservable(authService.userInfo).pipe(
        filter(user => user !== null), // Wait for the user profile to be loaded.
        take(1),
        map(user => {
          const requiredGroups = configService.get('requiredGroups');
          const userGroups = user!.groups || [];
          const hasAccess = userGroups.some(userGroup => requiredGroups.includes(userGroup));

          console.log('[AuthorizationGuard] Permission check result:', { hasAccess });

          return hasAccess ? true : router.parseUrl('/access-denied');
        })
      );
    })
  );
};
