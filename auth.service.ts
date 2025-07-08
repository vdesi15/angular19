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
      
      // For PKCE flow, try to login (this handles both callback and silent refresh)
      const success = await this.oauthService.tryLogin();
      console.log('[AuthService] Login attempt result:', success);
      
      // Check if we have a valid token after tryLogin
      if (this.oauthService.hasValidAccessToken()) {
        console.log('[AuthService] Valid access token found');
        await this.loadUserProfile();
        this.isAuthenticated.set(true);
      } else {
        console.log('[AuthService] No valid access token found');
        // Don't automatically redirect - let guards handle it
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
    if (preserveRoute) {
      // Save current URL with ALL parameters
      const currentUrl = this.router.url;
      if (!this.isCallbackUrl(currentUrl)) {
        sessionStorage.setItem('pre_auth_url', currentUrl);
        console.log('[AuthService] Saved URL before login:', currentUrl);
      }
    }

    // Start PKCE login flow
    console.log('[AuthService] Starting PKCE login flow...');
    this.oauthService.initCodeFlow();
  }

  public async handleCallback(): Promise<void> {
    try {
      console.log('[AuthService] Processing PKCE callback...');
      
      // For PKCE, use tryLogin instead of tryLoginImplicitFlow
      const success = await this.oauthService.tryLogin();
      console.log('[AuthService] Callback processing result:', success);
      
      if (this.oauthService.hasValidAccessToken()) {
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