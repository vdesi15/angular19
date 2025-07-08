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

  // Must be authenticated first
  if (!authService.hasValidSession()) {
    return router.parseUrl('/access-denied');
  }

  // Get user info
  const user = authService.userInfo();
  if (!user) {
    return router.parseUrl('/access-denied');
  }

  // Check if user has any of the required groups
  const requiredGroups = configService.get('requiredGroups');
  const userGroups = user.groups || [];
  
  const hasAccess = userGroups.some(userGroup => requiredGroups.includes(userGroup));

  console.log('[AuthorizationGuard]', {
    hasAccess,
    userGroups,
    requiredGroups
  });

  return hasAccess ? true : router.parseUrl('/access-denied');
};
