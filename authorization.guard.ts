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

  // --- KEY FIX: Create all observables from signals at the top level ---
  const isLoading$ = toObservable(authService.isLoading);
  const userInfo$ = toObservable(authService.userInfo);

  // The main observable stream starts with isLoading$.
  return isLoading$.pipe(
    // 1. Wait for loading to be complete.
    filter(loading => !loading),
    take(1),

    // 2. Once loading is done, bring in the LATEST value from the userInfo$ stream.
    // `withLatestFrom` is perfect here because we don't need userInfo$ to emit
    // a new value right now, we just need its current state after loading is done.
    withLatestFrom(userInfo$),

    // 3. The `map` operator now receives an array: [isLoading, userInfo]
    // We can destructure it for clarity.
    map(([/* isLoading is now false */, user]) => {
      // 4. NOW it is safe to check the session and user profile.
      if (!authService.hasValidSession()) {
        console.log('[AuthorizationGuard] No valid session after init. Denying access.');
        return router.parseUrl('/access-denied');
      }
      
      // We check the user object we got from the withLatestFrom operator.
      if (!user) {
        // This can happen if the session is valid but the profile hasn't loaded yet.
        // It indicates a potential issue but for safety, we deny access.
        console.error('[AuthorizationGuard] Session is valid, but user profile is null. Denying access.');
        return router.parseUrl('/access-denied');
      }

      const requiredGroups = configService.get('requiredGroups');
      const userGroups = user.groups || [];
      const hasAccess = userGroups.some(userGroup => requiredGroups.includes(userGroup));

      console.log('[AuthorizationGuard] Permission check result:', { hasAccess });

      return hasAccess ? true : router.parseUrl('/access-denied');
    })
  );
};
