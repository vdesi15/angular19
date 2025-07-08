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
      responseType: config.responseType,
      
      // These work much better in angular-oauth2-oidc
      silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
      useSilentRefresh: config.silentRenew,
      silentRefreshTimeout: (config.renewTimeBeforeTokenExpiresInSeconds || 300) * 1000,
      
      // Better session management
      sessionChecksEnabled: true,
      clearHashAfterLogin: true,
      
      // Token validation
      requireHttps: window.location.protocol === 'https:',
      strictDiscoveryDocumentValidation: false
    };

    this.oauthService.configure(authConfig);
    
    // Set log level
    if (config.logLevel > 0) {
      this.oauthService.setLogging(true);
    }
  }

  private async initializeAuth(): Promise<void> {
    try {
      console.log('[AuthService] Initializing authentication...');
      
      // Load discovery document
      await this.oauthService.loadDiscoveryDocument();
      
      // Try to process any existing callback or silent refresh
      const result = await this.oauthService.tryLoginImplicitFlow();
      
      if (this.oauthService.hasValidAccessToken()) {
        console.log('[AuthService] Valid access token found');
        await this.loadUserProfile();
        this.isAuthenticated.set(true);
      } else {
        console.log('[AuthService] No valid access token found');
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
      }
    }

    // Start the login flow - NO STATE ISSUES!
    this.oauthService.initLoginFlow();
  }

  public async logout(): Promise<void> {
    sessionStorage.removeItem('pre_auth_url');
    this.isAuthenticated.set(false);
    this.userInfo.set(null);
    this.oauthService.logOut();
  }

  public async handleCallback(): Promise<void> {
    try {
      // Process the callback - MUCH more reliable!
      const result = await this.oauthService.tryLoginImplicitFlow();
      
      if (this.oauthService.hasValidAccessToken()) {
        await this.loadUserProfile();
        this.isAuthenticated.set(true);
        
        // Restore the original URL with ALL parameters
        const savedUrl = sessionStorage.getItem('pre_auth_url');
        if (savedUrl && !this.isCallbackUrl(savedUrl)) {
          sessionStorage.removeItem('pre_auth_url');
          this.router.navigateByUrl(savedUrl);
        } else {
          this.router.navigate(['/logs/search']);
        }
      } else {
        throw new Error('No valid access token received');
      }
      
    } catch (error) {
      console.error('[AuthService] Callback error:', error);
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