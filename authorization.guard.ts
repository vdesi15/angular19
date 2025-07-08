import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';
import { filter, map, Observable, of, switchMap, take, withLatestFrom } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

export const authorizationGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const configService = inject(ConfigService);
  const router = inject(Router);

  // We still need to create an observable from the userInfo signal here.
  const userInfo$ = toObservable(authService.userInfo);

  // 1. Subscribe to the public, shared `isLoading$` observable from the service.
  return authService.isLoading$.pipe(
    filter(loading => !loading), // Wait for auth service to be ready.
    take(1),
    switchMap(() => {
      // 2. Failsafe: check session validity.
      if (!authService.hasValidSession()) {
        console.warn('[AuthorizationGuard] No valid session after init. Denying access.');
        return of(router.parseUrl('/access-denied'));
      }

      // 3. Now, wait for the userInfo$ stream to emit a valid user object.
      return userInfo$.pipe(
        filter(user => user !== null), // Wait until the user object is available.
        take(1),
        map(user => {
          // 4. Perform final permission check.
          const requiredGroups = configService.get('requiredGroups');
          const hasAccess = user!.groups?.some(g => requiredGroups.includes(g)) ?? false;

          console.log('[AuthorizationGuard] Permission check result:', { hasAccess });

          return hasAccess ? true : router.parseUrl('/access-denied');
        })
      );
    })
  );
};
