// src/app/core/guards/authorization.guard.ts - FIXED VERSION
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, switchMap, filter } from 'rxjs/operators';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';

/**
 * Fixed authorization guard that waits for token exchange to complete
 * before checking user permissions.
 */
export const authorizationGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const oidcSecurityService = inject(OidcSecurityService);
  const authService = inject(AuthService);
  const configService = inject(ConfigService);
  const router = inject(Router);

  console.log('[AuthorizationGuard] Starting authorization check');

  // 🔥 KEY FIX: Wait for OIDC to complete token exchange first
  return oidcSecurityService.checkAuth().pipe(
    filter(result => {
      console.log('[AuthorizationGuard] OIDC Auth Result:', {
        isAuthenticated: result.isAuthenticated,
        hasAccessToken: !!result.accessToken,
        configId: result.configId
      });
      return result.isAuthenticated;
    }),
    take(1),
    switchMap(() => {
      console.log('[AuthorizationGuard] OIDC authentication confirmed, checking user permissions');
      
      // Now safely get user info after token exchange is complete
      return authService.userInfo$.pipe(
        take(1),
        map(user => {
          console.log('[AuthorizationGuard] User info retrieved:', {
            hasUser: !!user,
            userGroups: user?.groups || []
          });

          if (!user) {
            console.error('[AuthorizationGuard] User data not found after authentication.');
            return router.parseUrl('/access-denied');
          }

          const requiredGroups = configService.get('requiredGroups');
          const userGroups = user.groups ?? [];
          const hasPermission = userGroups.some(userGroup => requiredGroups.includes(userGroup));

          if (hasPermission) {
            console.log('[AuthorizationGuard] Access granted. User has required permissions.');
            return true;
          } else {
            console.warn('[AuthorizationGuard] Access denied. User groups do not meet requirements.', {
              userGroups,
              requiredGroups
            });
            return router.parseUrl('/access-denied');
          }
        })
      );
    })
  );
};