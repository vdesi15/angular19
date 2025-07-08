import { inject, Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { ConfigService } from './config.service';
import { UserInfo } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oauthService = inject(OAuthService);
  private readonly router = inject(Router);
  private readonly configService = inject(ConfigService);

  // Signals for reactive state
  public readonly isAuthenticated = signal(false);
  public readonly userInfo = signal<UserInfo | null>(null);
  public readonly isLoading = signal(true);

  // Computed properties
  public readonly hasValidSession = computed(() =>
    this.isAuthenticated() && !!this.oauthService.getAccessToken()
  );

  constructor() {
    this.configureOAuth();
    this.initializeAuth();
  }

  
  private configureOAuth(): void {
    const config = this.configService.get('oauth');

    const authConfig: AuthConfig = {
      issuer: config.authority,
      redirectUri: window.location.origin + '/signin-oidc', // Ensure this matches your route exactly
      postLogoutRedirectUri: config.postLogoutRedirectUri,
      clientId: config.clientId,
      scope: config.scope,
      responseType: 'code',
      disablePKCE: false,
      showDebugInformation: config.logLevel > 0,
      sessionChecksEnabled: true,
      clearHashAfterLogin: true,
      silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
      useSilentRefresh: config.silentRenew,
      silentRefreshTimeout: (config.renewTimeBeforeTokenExpiresInSeconds || 300) * 1000,
      strictDiscoveryDocumentValidation: false
    };

    this.oauthService.configure(authConfig);

    if (config.silentRenew) {
      this.oauthService.setupAutomaticSilentRefresh();
    }
  }

  /**
   * Passively checks for an existing session on any page load.
   * Does NOT perform navigation.
   */
  private async initializeAuth(): Promise<void> {
    try {
      // loadDiscoveryDocumentAndTryLogin is a passive check.
      await this.oauthService.loadDiscoveryDocumentAndTryLogin();

      if (this.oauthService.hasValidAccessToken()) {
        console.log('[AuthService] Session is valid from initial load.');
        this.isAuthenticated.set(true);
        await this.loadUserProfile();
      } else {
        console.log('[AuthService] No valid session on initial load.');
        this.isAuthenticated.set(false);
      }
    } catch (error) {
      console.error('[AuthService] Passive initialization error:', error);
    } finally {
      // This MUST be the last thing to happen here.
      this.isLoading.set(false);
    }
  }

   /**
   * Actively processes the OIDC callback, exchanges the code for a token,
   * and navigates to the originally requested URL.
   * This should ONLY be called from the OidcCallbackComponent.
   */
  public async handleLoginCallback(): Promise<void> {
    // --- KEY FIX: WAIT FOR INITIALIZATION ---
    // We must ensure the discovery document is loaded before calling tryLogin.
    // The `isLoading` signal tells us when the initial `initializeAuth` is complete.
    if (this.isLoading()) {
      console.log('[AuthService] Callback invoked, but service is still initializing. Waiting...');
      // Convert the signal to an observable and wait for it to be false.
      await firstValueFrom(toObservable(this.isLoading).pipe(filter(loading => !loading)));
      console.log('[AuthService] Service initialization complete. Proceeding with callback handling.');
    } else {
       console.log('[AuthService] Callback invoked, and service was already initialized.');
    }

    try {
      // Now it is safe to call tryLogin, as the library is fully configured.
      await this.oauthService.tryLogin({
        onTokenReceived: async (info) => {
          console.log('[AuthService] Token received successfully inside onTokenReceived hook.', info);

          this.isAuthenticated.set(true);
          await this.loadUserProfile();

          const savedUrl = sessionStorage.getItem('pre_auth_url');
          sessionStorage.removeItem('pre_auth_url'); // Always clean up
          const targetUrl = savedUrl && !this.isCallbackUrl(savedUrl) ? savedUrl : '/logs/search';

          console.log(`[AuthService] Post-login navigation. Target: ${targetUrl}`);
          await this.router.navigateByUrl(targetUrl);
        },
        // Add a handler for cases where tryLogin is called but there's nothing to do
        // (e.g., if the user refreshes the callback page after logging in).
        // This prevents hangs and ensures a redirect.
        onLoginError: async () => {
            console.warn('[AuthService] onLoginError triggered. Redirecting to home.');
            await this.router.navigateByUrl('/logs/search');
        }
      });
    } catch (error) {
      console.error('[AuthService] Critical error during login callback handling:', error);
      await this.router.navigate(['/access-denied']);
    }
  }

  public async login(preserveRoute: boolean = true): Promise<void> {
    console.log('[AuthService] login() called');

    if (preserveRoute) {
      const currentUrl = this.router.url;
      // Prevent saving the callback URL itself as the redirect destination
      if (!this.isCallbackUrl(currentUrl)) {
        sessionStorage.setItem('pre_auth_url', currentUrl);
        console.log('[AuthService] Saved URL before login:', currentUrl);
      }
    }
    // This correctly starts the redirect to the identity provider
    this.oauthService.initCodeFlow();
  }

  // THIS METHOD IS NO LONGER NEEDED AND HAS BEEN REMOVED.
  // public async handleCallback(): Promise<void> { ... }

  private async loadUserProfile(): Promise<void> {
    try {
      const claims = this.oauthService.getIdentityClaims() as UserInfo | null;
      if (claims) {
        // Map claims to your UserInfo model
        const userInfo: UserInfo = {
          name: claims.name || 'Unknown User',
          email: claims.email || 'No email',
          groups: claims.groups || [],
          sub: claims.sub,
          roles: claims.roles || [],
          department: claims.department,
          location: claims.location
        };
        this.userInfo.set(userInfo);
        console.log('[AuthService] User profile loaded:', userInfo);
      }
    } catch (error) {
      console.error('[AuthService] Failed to load user profile:', error);
    }
  }

  public getAccessToken(): string | null {
    return this.oauthService.getAccessToken();
  }

  public hasValidToken(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  public hasPermission(requiredGroups: string[]): boolean {
    const user = this.userInfo();
    if (!user?.groups) return false;
    return user.groups.some(group => requiredGroups.includes(group));
  }

  private isCallbackUrl(url: string): boolean {
    // Check if the given URL path is the configured redirect URI path.
    const redirectPath = new URL(this.oauthService.redirectUri).pathname;
    const urlPath = url.split('?')[0].split('#')[0];
    return urlPath === redirectPath;
  }
}