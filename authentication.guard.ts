// src/app/core/guards/authentication.guard.ts - SIMPLIFIED VERSION
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authenticationGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('[AuthGuard] Running...');

  // Convert the isLoading signal to an observable.
  return toObservable(authService.isLoading).pipe(
    // We only want to proceed when loading is complete.
    filter(isLoading => !isLoading),
    // We only need the first emission of `false`.
    take(1),
    // Once loading is false, perform the actual authentication check.
    map(() => {
      console.log('[AuthGuard] Auth service finished loading. Checking session...');

      if (authService.hasValidSession()) {
        console.log('[AuthGuard] User is authenticated. Access granted.');
        return true;
      } else {
        console.log('[AuthGuard] User is NOT authenticated. Starting login flow...');
        // Start the login flow, which will redirect the user.
        authService.login(true);
        // Prevent the router from navigating to the component.
        // The page will redirect to the login provider anyway.
        return false;
      }
    })
  );
};
