import { computed, inject, Injectable, Injector, runInInjectionContext, signal } from "@angular/core";
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { UserInfo } from "../models/user.model";
import { ConfigService } from "./config.service";
import { Router } from "@angular/router";
import { filter, firstValueFrom, Observable, shareReplay } from "rxjs";
import { toObservable } from "@angular/core/rxjs-interop";

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly oauthService = inject(OAuthService);
    private readonly router = inject(Router);
    private readonly configService = inject(ConfigService);

    // Signals for reactive state
    public readonly isAuthenticated = signal(false);
    public readonly userInfo = signal<UserInfo | null>(null);
    private readonly _isLoading = signal(true); 
    public readonly isLoading$: Observable<boolean>;
    public get isLoading(): boolean {
        return this._isLoading();
    }

    // Computed properties
    public hasValidSession(): boolean {
        return this.isAuthenticated() && this.oauthService.hasValidAccessToken();
    }

    constructor() {
        this.isLoading$ = toObservable(this._isLoading).pipe(
            shareReplay(1) // shareReplay(1) caches and replays the last emitted value.
        );
        this.configureOAuth();
        this.initializeAuthState();
    }

    private configureOAuth(): void {
        const config = this.configService.get('oauth');

        const authConfig: AuthConfig = {
            issuer: config.authority,
            redirectUri: config.redirectUrl, // Ensure this matches your route exactly
            postLogoutRedirectUri: config.postLogoutRedirectUri,
            clientId: config.clientId,
            scope: config.scope,
            responseType: config.responseType,
            disablePKCE: false,
            showDebugInformation: true,
            sessionChecksEnabled: true,
            clearHashAfterLogin: true,            
            useSilentRefresh: config.silentRenew,            
            strictDiscoveryDocumentValidation: false
        };

        this.oauthService.configure(authConfig);
    }

    /**
   * Initializes the authentication state on every application load.
   * This method is passive and does not perform any navigation.
   */
    private async initializeAuthState(): Promise<void> {
        try {
            await this.oauthService.loadDiscoveryDocumentAndTryLogin();
            if (this.oauthService.hasValidAccessToken()) {
                this.isAuthenticated.set(true);
                await this.loadUserProfile();
            } else {
                this.isAuthenticated.set(false);
            }
        } catch (error) {
            console.error('[AuthService] Error during state initialization.', error);
        } finally {
            // Set the private signal's value. The public observable will emit this.
            this._isLoading.set(false);
            console.log(`[AuthService] State initialization complete. isLoading: false`);
        }
      }

    public login(redirectUrl: string): void {
        console.log(`[AuthService] login() called. Saving redirect URL: ${redirectUrl}`);

        // Save the reliable URL that the guard captured.
        sessionStorage.setItem('pre_auth_url', redirectUrl);

        // Start the redirect to the Identity Provider.
        this.oauthService.initCodeFlow();
      }

    private async loadUserProfile(): Promise<void> {
        try {
            const claims = await this.oauthService.loadUserProfile() as any;
            if (claims) {
                // Map claims to your UserInfo model
                const userInfo: UserInfo = {
                    name: claims.info.name || 'Unknown User',
                    email: claims.info.email || 'No email',
                    groups: claims.info.groups || [],
                    idsid: claims.info.idsid || '',
                    wwid: claims.info.wwid,
                    user_domain: claims.info.user_domain
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
        return url.startsWith('/signin-oidc');
    }
}
