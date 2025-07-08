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
    this.initializeAuth(); // This single call will now handle all auth scenarios
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

  private async initializeAuth(): Promise<void> {
    try {
      console.log('[AuthService] Initializing authentication...');
      await this.oauthService.loadDiscoveryDocument();

      // tryLogin() handles both session checks and the PKCE callback flow.
      // It returns true if a login has just been completed (i.e., code was exchanged for a token).
      const hasLoggedIn = await this.oauthService.tryLogin();
      console.log(`[AuthService] tryLogin() result: ${hasLoggedIn}`);

      if (this.oauthService.hasValidAccessToken()) {
        console.log('[AuthService] Session is valid.');
        this.isAuthenticated.set(true);
        await this.loadUserProfile();

        // --- KEY CHANGE ---
        // Only redirect if a login flow has just completed. This prevents
        // redirection on every page refresh when already logged in.
        if (hasLoggedIn) {
          const savedUrl = sessionStorage.getItem('pre_auth_url');
          sessionStorage.removeItem('pre_auth_url'); // Always clean up

          const targetUrl = savedUrl && !this.isCallbackUrl(savedUrl) ? savedUrl : '/logs/search';

          console.log(`[AuthService] Login successful, redirecting to: ${targetUrl}`);
          // Use navigateByUrl to handle full paths with query params
          this.router.navigateByUrl(targetUrl);
        }
      } else {
        console.log('[AuthService] No valid session found.');
        this.isAuthenticated.set(false);
        this.userInfo.set(null);
      }
    } catch (error) {
      console.error('[AuthService] Initialization error:', error);
      this.isAuthenticated.set(false);
      this.userInfo.set(null);
    } finally {
      this.isLoading.set(false);
      console.log('[AuthService] Auth initialization complete.');
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