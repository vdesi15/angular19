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
      redirectUri: window.location.origin + '/signin-oidc',
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
      strictDiscoveryDocumentValidation: false,
      nonceStateSeparator: 'semicolon' // Add this to help with state management
    };

    this.oauthService.configure(authConfig);

    if (config.silentRenew) {
      this.oauthService.setupAutomaticSilentRefresh();
    }
  }

  private async initializeAuth(): Promise<void> {
    try {
      // Only do passive check if NOT on callback URL
      if (!this.isCallbackUrl(window.location.pathname)) {
        await this.oauthService.loadDiscoveryDocumentAndTryLogin();

        if (this.oauthService.hasValidAccessToken()) {
          console.log('[AuthService] Session is valid from initial load.');
          this.isAuthenticated.set(true);
          await this.loadUserProfile();
        } else {
          console.log('[AuthService] No valid session on initial load.');
          this.isAuthenticated.set(false);
        }
      }
    } catch (error) {
      console.error('[AuthService] Passive initialization error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  public async handleLoginCallback(): Promise<void> {
    try {
      console.log('[AuthService] handleLoginCallback started');
      
      // First, check if we have the required OAuth parameters
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has('code') || !urlParams.has('state')) {
        console.error('[AuthService] Missing OAuth parameters');
        await this.router.navigate(['/access-denied']);
        return;
      }

      // Ensure discovery document is loaded first
      if (!this.oauthService.hasValidIdToken()) {
        console.log('[AuthService] Loading discovery document...');
        await this.oauthService.loadDiscoveryDocument();
      }

      // Try to login and exchange code for token
      console.log('[AuthService] Attempting tryLoginCodeFlow...');
      const loginResult = await this.oauthService.tryLoginCodeFlow();
      console.log('[AuthService] tryLoginCodeFlow result:', loginResult);

      // Check multiple times with a small delay as token might not be immediately available
      let tokenAttempts = 0;
      while (!this.oauthService.hasValidAccessToken() && tokenAttempts < 3) {
        console.log(`[AuthService] Waiting for token... attempt ${tokenAttempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        tokenAttempts++;
      }

      if (this.oauthService.hasValidAccessToken()) {
        console.log('[AuthService] Token obtained successfully');
        console.log('[AuthService] Access token:', this.oauthService.getAccessToken()?.substring(0, 20) + '...');
        
        // Update state
        this.isAuthenticated.set(true);
        
        // Load user profile
        await this.loadUserProfile();
        
        // Get the saved URL from sessionStorage
        const savedUrl = sessionStorage.getItem('pre_auth_url');
        sessionStorage.removeItem('pre_auth_url');
        
        // Parse and navigate
        let targetUrl = '/logs/search';
        if (savedUrl && !this.isCallbackUrl(savedUrl)) {
          targetUrl = savedUrl;
          console.log('[AuthService] Navigating to saved URL:', targetUrl);
        }
        
        // Use navigateByUrl to preserve query parameters
        await this.router.navigateByUrl(targetUrl, { replaceUrl: true });
        
      } else {
        console.error('[AuthService] Failed to obtain valid token after multiple attempts');
        console.error('[AuthService] Token state:', {
          hasIdToken: this.oauthService.hasValidIdToken(),
          hasAccessToken: this.oauthService.hasValidAccessToken(),
          idToken: this.oauthService.getIdToken()?.substring(0, 20) + '...',
          accessToken: this.oauthService.getAccessToken()
        });
        await this.router.navigate(['/access-denied']);
      }
      
    } catch (error) {
      console.error('[AuthService] Error in handleLoginCallback:', error);
      await this.router.navigate(['/access-denied']);
    }
  }

  public async login(preserveRoute: boolean = true): Promise<void> {
    console.log('[AuthService] login() called');

    if (preserveRoute) {
      // Save the COMPLETE current URL including query parameters
      const currentUrl = this.router.url;
      
      if (!this.isCallbackUrl(currentUrl)) {
        sessionStorage.setItem('pre_auth_url', currentUrl);
        console.log('[AuthService] Saved URL with params:', currentUrl);
      }
    }
    
    // Start the OAuth flow
    this.oauthService.initCodeFlow();
  }

  private async loadUserProfile(): Promise<void> {
    try {
      const claims = this.oauthService.getIdentityClaims() as any;
      if (claims) {
        const userInfo: UserInfo = {
          name: claims.name || 'Unknown User',
          email: claims.email || 'No email',
          groups: claims.groups || []
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
    const callbackPath = '/signin-oidc';
    return url.includes(callbackPath);
  }

  public logout(): void {
    this.oauthService.logOut();
  }
}