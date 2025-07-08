// src/app/core/services/auth.service.ts - NEW VERSION
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
      // Map your existing config to angular-oauth2-oidc format
      issuer: config.authority,
      redirectUri: config.redirectUrl,
      postLogoutRedirectUri: config.postLogoutRedirectUri,
      clientId: config.clientId,
      scope: config.scope,
      responseType: 'code', // PKCE requires 'code' response type
      
      // PKCE Configuration (correct property names)
      disablePKCE: false, // This enables PKCE (false = PKCE enabled)
      showDebugInformation: config.logLevel > 0,
      
      // Session management
      sessionChecksEnabled: true,
      clearHashAfterLogin: true,
      
      // Silent refresh for token renewal
      silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
      useSilentRefresh: config.silentRenew,
      silentRefreshTimeout: (config.renewTimeBeforeTokenExpiresInSeconds || 300) * 1000,
      
      // Security settings
      requireHttps: window.location.protocol === 'https:',
      strictDiscoveryDocumentValidation: false
    };

    this.oauthService.configure(authConfig);
    
    // Set up automatic token refresh
    if (config.silentRenew) {
      this.oauthService.setupAutomaticSilentRefresh();
    }
  }

  private async initializeAuth(): Promise<void> {
    try {
      console.log('[AuthService] Initializing PKCE authentication...');
      
      // Load discovery document first
      await this.oauthService.loadDiscoveryDocument();
      console.log('[AuthService] Discovery document loaded');
      
      // Check current URL for debug
      console.log('[AuthService] Current URL:', window.location.href);
      
      // For PKCE flow, try to login (this handles both callback and silent refresh)
      const success = await this.oauthService.tryLogin();
      console.log('[AuthService] tryLogin() result:', success);
      
      // Detailed token debugging
      const hasAccessToken = this.oauthService.hasValidAccessToken();
      const accessToken = this.oauthService.getAccessToken();
      const idToken = this.oauthService.getIdToken();
      
      console.log('[AuthService] Token status:', {
        hasValidAccessToken: hasAccessToken,
        accessTokenLength: accessToken?.length || 0,
        hasIdToken: !!idToken,
        idTokenLength: idToken?.length || 0
      });
      
      // Check if we have a valid token after tryLogin
      if (hasAccessToken) {
        console.log('[AuthService] Valid access token found');
        await this.loadUserProfile();
        this.isAuthenticated.set(true);
      } else {
        console.log('[AuthService] No valid access token - checking for errors');
        
        // Check for specific error conditions
        const tokenError = (this.oauthService as any).getTokenError?.();
        if (tokenError) {
          console.error('[AuthService] Token error:', tokenError);
        }
        
        // Check localStorage for any stored tokens
        const storedAccessToken = localStorage.getItem('access_token');
        const storedIdToken = localStorage.getItem('id_token');
        console.log('[AuthService] LocalStorage tokens:', {
          hasStoredAccessToken: !!storedAccessToken,
          hasStoredIdToken: !!storedIdToken
        });
      }
      
    } catch (error) {
      console.error('[AuthService] Initialization error:', error);
    } finally {
      // Always set loading to false so app can start
      this.isLoading.set(false);
      console.log('[AuthService] Auth initialization complete');
    }
  }

  public async login(preserveRoute: boolean = true): Promise<void> {
    console.log('[AuthService] login() called with preserveRoute:', preserveRoute);
    
    if (preserveRoute) {
      // Save current URL with ALL parameters
      const currentUrl = this.router.url;
      if (!this.isCallbackUrl(currentUrl)) {
        sessionStorage.setItem('pre_auth_url', currentUrl);
        console.log('[AuthService] Saved URL before login:', currentUrl);
      }
    }

    // Check if OAuth is configured
    const config = (this.oauthService as any).authConfig;
    console.log('[AuthService] OAuth config check:', {
      hasConfig: !!config,
      issuer: config?.issuer,
      clientId: config?.clientId,
      redirectUri: config?.redirectUri,
      responseType: config?.responseType
    });

    // Start PKCE login flow
    console.log('[AuthService] About to call initCodeFlow()...');
    
    try {
      // This should trigger the /authorize call
      this.oauthService.initCodeFlow();
      console.log('[AuthService] initCodeFlow() completed - check network tab for /authorize call');
    } catch (error) {
      console.error('[AuthService] Error in initCodeFlow():', error);
    }
  }

  public async handleCallback(): Promise<void> {
    try {
      console.log('[AuthService] Processing PKCE callback...');
      console.log('[AuthService] Callback URL:', window.location.href);
      
      // Check URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      
      console.log('[AuthService] URL parameters:', {
        hasCode: !!code,
        codeLength: code?.length || 0,
        hasState: !!state,
        error: error
      });
      
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }
      
      if (!code) {
        throw new Error('No authorization code in callback URL');
      }
      
      // For PKCE, use tryLogin instead of tryLoginImplicitFlow
      const success = await this.oauthService.tryLogin();
      console.log('[AuthService] tryLogin() result:', success);
      
      // Detailed token check
      const hasAccessToken = this.oauthService.hasValidAccessToken();
      const accessToken = this.oauthService.getAccessToken();
      
      console.log('[AuthService] After tryLogin token status:', {
        success: success,
        hasValidAccessToken: hasAccessToken,
        accessTokenExists: !!accessToken,
        accessTokenLength: accessToken?.length || 0
      });
      
      if (hasAccessToken && accessToken) {
        console.log('[AuthService] Access token received via PKCE');
        await this.loadUserProfile();
        this.isAuthenticated.set(true);
        
        // Restore the original URL with ALL parameters
        const savedUrl = sessionStorage.getItem('pre_auth_url');
        if (savedUrl && !this.isCallbackUrl(savedUrl)) {
          sessionStorage.removeItem('pre_auth_url');
          console.log('[AuthService] Restoring URL:', savedUrl);
          this.router.navigateByUrl(savedUrl);
        } else {
          this.router.navigate(['/logs/search']);
        }
      } else {
        // Debug why we don't have a token
        console.error('[AuthService] Token exchange failed');
        console.log('[AuthService] Attempting manual token info...');
        
        // Check what the OAuth service knows about tokens
        const tokenResponse = (this.oauthService as any).getTokenResponse?.();
        if (tokenResponse) {
          console.log('[AuthService] Token response object:', tokenResponse);
        }
        
        throw new Error('PKCE flow completed but no valid access token received');
      }
      
    } catch (error) {
      console.error('[AuthService] PKCE callback error:', error);
      this.router.navigate(['/logs/search']);
    }
  }

  private async loadUserProfile(): Promise<void> {
    try {
      const claims = this.oauthService.getIdentityClaims() as any;
      
      if (claims) {
        const userInfo: UserInfo = {
          name: claims.name || claims.preferred_username || 'Unknown User',
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

  public hasRole(requiredRoles: string[]): boolean {
    const user = this.userInfo();
    if (!user?.roles) return false;
    return user.roles.some(role => requiredRoles.includes(role));
  }

  public isAdmin(): boolean {
    const user = this.userInfo();
    if (!user) return false;
    
    return user.groups?.includes('admin') || 
           user.roles?.includes('administrator') ||
           user.roles?.includes('admin') || false;
  }

  public getUserPermissions(): { groups: string[], roles: string[] } {
    const user = this.userInfo();
    return {
      groups: user?.groups || [],
      roles: user?.roles || []
    };
  }

  private isCallbackUrl(url: string): boolean {
    return url.includes('/signin-oidc') || url.includes('/auth/callback');
  }
}