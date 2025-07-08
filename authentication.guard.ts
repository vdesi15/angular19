import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { toObservable } from "@angular/core/rxjs-interop";
import { filter, map, Observable, take } from "rxjs";

export const authenticationGuard: CanActivateFn = (route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> => {
    const authService = inject(AuthService);
    // Use the public, shared observable from the service
    return authService.isLoading$.pipe(
        filter(loading => !loading),
        take(1),
        map(() => {
            // ... rest of the logic is the same
            if (authService.hasValidSession()) {
                return true;
            } else {
                const redirectUrl = state.url;
                console.log(`[AuthGuard] User not authenticated. Intended URL: ${redirectUrl}`);

                // Pass the reliable URL to the login method.
                authService.login(redirectUrl); 
                return false;
            }
        })
    );
  };
