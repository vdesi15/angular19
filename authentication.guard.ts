import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from "@angular/router";
import { LoginResponse, OidcSecurityService, ConfigurationService, OpenIdConfiguration } from "angular-auth-oidc-client";
import { Observable, of, switchMap, tap } from "rxjs";
import { ConfigService } from "../services/config.service";

// Using arrow function with fatarrow.
export const authenticationGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> => {
    const oidcSercurityService = inject(OidcSecurityService);
    const oidcConfigService = inject(ConfigurationService);
    const router = inject(Router);

    return oidcSercurityService.checkAuth().pipe(
        tap((loginResponse: LoginResponse) => {
            console.log('[AuthenticationGuard] Auth check result:', {
                isAuthenticated: loginResponse.isAuthenticated,
                hasAccessToken: !!loginResponse.accessToken,
                errorMessage: loginResponse.errorMessage,
                userData: loginResponse.userData
            });
        }),
        switchMap((loginResponse: LoginResponse) => {
            // If the user is already authenticated then the guard's job is done.
            // We return an observable that emits 'true', allowing navigation
            if (loginResponse.isAuthenticated) {
                console.log('[AuthenticationGuard] User is authenticated');
                const savedUrl = sessionStorage.getItem('pre_auth_url');
                if (savedUrl && savedUrl !== state.url && !isCallbackUrl(savedUrl)) {
                    console.log('[AuthenticationGuard] Restoring saved URL:', savedUrl);
                    sessionStorage.removeItem('pre_auth_url');
                    router.navigateByUrl(savedUrl);
                    return of(false); // Prevent current navigation
                }
                return of(true);
            }

             if (loginResponse.errorMessage) {
                console.error('[AuthenticationGuard] Authentication error:', loginResponse.errorMessage);
                return of(false);
            }

            const configs:OpenIdConfiguration[] = oidcConfigService.getAllConfigurations();
            configs.forEach(config => {
                console.log('Redirect URI:', config.redirectUrl);
            });
            

            // After the user logs in at the ID provider, they are redirected back to the app.
            // the URL will contain parameters like code and state.
            console.log('[AuthenticationGuard] User not authenticated. Starting authorization flow...');

            if (!isCallbackUrl(state.url)) {
                console.log('[AuthenticationGuard] Storing URL before auth:', state.url);
                sessionStorage.setItem('pre_auth_url', state.url);
            }
            
            oidcSercurityService.authorize();

            // Returning an observable that emits 'false'
            // This tells angular router to stop navigating to the route.
            return of(false);
        })
    );
}

function isCallbackUrl(url: string): boolean {
  return url.includes('code=') || 
         url.includes('signin-oidc') || 
         url.includes('auth/callback') ||
         url.includes('access_token=') ||
         url.includes('id_token=');
}
