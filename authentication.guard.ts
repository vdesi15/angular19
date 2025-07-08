// src/app/core/guards/authentication.guard.ts - SIMPLIFIED VERSION
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authenticationGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('[AuthGuard] Running...');

  // Convert the isLoading signal to an observable
  return toObservable(authService.isLoading).pipe(
    // Wait for loading to complete
    filter(isLoading => !isLoading),
    take(1),
    // Check authentication status
    map(() => {
      console.log('[AuthGuard] Auth service finished loading. Checking session...');

      if (authService.hasValidSession()) {
        console.log('[AuthGuard] User is authenticated. Access granted.');
        return true;
      } else {
        console.log('[AuthGuard] User is NOT authenticated. Starting login flow...');
        // Start the login flow
        authService.login(true);
        // Return false to prevent navigation
        return false;
      }
    })
  );
};
