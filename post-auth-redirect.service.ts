// src/app/core/services/post-auth-redirect.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { filter, take } from 'rxjs/operators';

/**
 * Service to handle post-authentication redirects with URL preservation.
 * This service should be initialized in your app.component.ts or main.ts
 * 
 * Features:
 * - Preserves complete URLs with query parameters
 * - Handles authentication state changes
 * - Prevents redirect loops
 * - Uses Angular 19 signals for state management
 */
@Injectable({
  providedIn: 'root'
})
export class PostAuthRedirectService {
  private readonly router = inject(Router);
  private readonly oidcSecurityService = inject(OidcSecurityService);
  
  private readonly hasProcessedRedirect = signal(false);
  private readonly defaultRedirectUrl = '/logs/search';

  constructor() {
    this.initializeRedirectHandling();
  }

  /**
   * Initialize the redirect handling logic
   */
  private initializeRedirectHandling(): void {
    // Listen for authentication state changes
    this.oidcSecurityService.checkAuth().pipe(
      filter(loginResponse => loginResponse.isAuthenticated && !this.hasProcessedRedirect()),
      take(1)
    ).subscribe(() => {
      this.handlePostAuthRedirect();
    });

    // Also listen for navigation end events to catch auth callback redirects
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => !this.hasProcessedRedirect())
    ).subscribe((event: NavigationEnd) => {
      if (this.isAuthCallbackUrl(event.url)) {
        console.log('[PostAuthRedirectService] Auth callback detected, checking for stored URL');
        setTimeout(() => this.handlePostAuthRedirect(), 100); // Small delay to ensure auth state is updated
      }
    });
  }

  /**
   * Handle the redirect after successful authentication
   */
  private handlePostAuthRedirect(): void {
    if (this.hasProcessedRedirect()) {
      console.log('[PostAuthRedirectService] Redirect already processed, skipping');
      return;
    }

    console.log('[PostAuthRedirectService] Processing post-auth redirect');
    this.hasProcessedRedirect.set(true);

    try {
      const storedUrl = sessionStorage.getItem('auth_redirect_url');
      
      if (storedUrl && storedUrl !== '/' && !this.isAuthCallbackUrl(storedUrl)) {
        console.log('[PostAuthRedirectService] Redirecting to stored URL:', storedUrl);
        
        // Clear the stored URL
        sessionStorage.removeItem('auth_redirect_url');
        
        // Navigate to the stored URL
        this.router.navigateByUrl(storedUrl).then(success => {
          if (success) {
            console.log('[PostAuthRedirectService] Successfully redirected to stored URL');
          } else {
            console.warn('[PostAuthRedirectService] Failed to redirect to stored URL, using default');
            this.router.navigate([this.defaultRedirectUrl]);
          }
        }).catch(error => {
          console.error('[PostAuthRedirectService] Error during redirect:', error);
          this.router.navigate([this.defaultRedirectUrl]);
        });
        
      } else {
        console.log('[PostAuthRedirectService] No valid stored URL, using default redirect');
        this.router.navigate([this.defaultRedirectUrl]);
      }
      
    } catch (error) {
      console.error('[PostAuthRedirectService] Error processing redirect:', error);
      this.router.navigate([this.defaultRedirectUrl]);
    }
  }

  /**
   * Check if the given URL is an authentication callback URL
   */
  private isAuthCallbackUrl(url: string): boolean {
    // Adjust these patterns based on your OIDC configuration
    const authCallbackPatterns = [
      '/signin-oidc',
      '/auth/callback',
      '/callback',
      '#code=',
      '#access_token='
    ];

    return authCallbackPatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Manually trigger redirect processing (useful for testing)
   */
  public processRedirect(): void {
    this.hasProcessedRedirect.set(false);
    this.handlePostAuthRedirect();
  }

  /**
   * Reset the redirect processing state
   */
  public resetRedirectState(): void {
    this.hasProcessedRedirect.set(false);
    console.log('[PostAuthRedirectService] Redirect state reset');
  }

  /**
   * Store a URL for post-authentication redirect
   */
  public storeRedirectUrl(url: string): void {
    try {
      sessionStorage.setItem('auth_redirect_url', url);
      console.log('[PostAuthRedirectService] Stored redirect URL:', url);
    } catch (error) {
      console.warn('[PostAuthRedirectService] Could not store redirect URL:', error);
    }
  }

  /**
   * Get the currently stored redirect URL
   */
  public getStoredRedirectUrl(): string | null {
    try {
      return sessionStorage.getItem('auth_redirect_url');
    } catch (error) {
      console.warn('[PostAuthRedirectService] Could not retrieve redirect URL:', error);
      return null;
    }
  }
}