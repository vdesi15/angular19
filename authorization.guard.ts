import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';

/**
 * This guard ensures an authenticated user has the required group permissions.
 * It should run AFTER the authenticationGuard.
 */
export const authorizationGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const configService = inject(ConfigService);
  const router = inject(Router);

  return authService.userInfo$.pipe(
    take(1),
    map(user => {
      if (!user) {
        console.error('[AuthorizationGuard] User data not found. Denying access.');
        return router.parseUrl('/access-denied');
      }

      const requiredGroups = configService.get('requiredGroups');
      const userGroups = user.groups ?? [];
      const hasPermission = userGroups.some(userGroup => requiredGroups.includes(userGroup));

      if (hasPermission) {
        console.log('[AuthorizationGuard] Access granted. User has a required group.');
        return true;
      } else {
        console.warn(`[AuthorizationGuard] Access Denied. User groups do not meet requirements.`);
        return router.parseUrl('/access-denied');
      }
    })
  );
};