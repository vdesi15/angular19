// src/app/core/guards/authentication.guard.ts - SIMPLIFIED VERSION
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authenticationGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot, 
  state: RouterStateSnapshot
): boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('[AuthGuard] Checking auth for:', state.url);

  // If still loading, allow navigation (auth service will handle redirect)
  if (authService.isLoading()) {
    return true;
  }

  // If authenticated, allow navigation
  if (authService.hasValidSession()) {
    console.log('[AuthGuard] User authenticated');
    return true;
  }

  // Not authenticated - start login flow
  console.log('[AuthGuard] Starting login flow');
  authService.login(true); // This preserves the current URL automatically
  
  return false;
};