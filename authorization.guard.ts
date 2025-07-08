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

  // The authenticationGuard has already run and waited for isLoading to be false.
  // We can safely check the session status now.
  if (!authService.hasValidSession()) {
    console.log('[AuthorizationGuard] No valid session. Denying access.');
    // This is a safeguard, but the previous guard should have caught this.
    return of(router.parseUrl('/access-denied'));
  }

  // Now, we wait for the user profile (which is loaded asynchronously) to be available.
  return toObservable(authService.userInfo).pipe(
    // Wait until the userInfo signal is populated (is not null).
    filter(user => user !== null),
    // We only need the first valid user object to make a decision.
    take(1),
    map(user => {
      // The `filter` operator guarantees `user` is not null here.
      const requiredGroups = configService.get('requiredGroups');
      const userGroups = user!.groups || []; // Use non-null assertion for type safety.

      const hasAccess = userGroups.some(userGroup => requiredGroups.includes(userGroup));

      console.log('[AuthorizationGuard]', {
        hasAccess,
        userGroups,
        requiredGroups
      });

      // If the user has the required group, return true. Otherwise, redirect.
      return hasAccess ? true : router.parseUrl('/access-denied');
    })
  );
};
