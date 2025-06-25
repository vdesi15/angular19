// src/app/core/services/auth-callback-handler.service.ts
import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { filter, take } from 'rxjs/operators';

/**
 * Service to handle OIDC callback and URL restoration
 * Initialize this in your app.component.ts constructor
 */
@Injectable({
  providedIn: 'root'
})
export class AuthCallbackHandlerService {
  private readonly router = inject(Router);
  private readonly oidcSecurityService = inject(OidcSecurityService);
  
  private hasProcessedCallback = false;

  constructor() {
    this.setupCallbackHandling();
  }

  private setupCallbackHandling(): void {
    // Listen for successful authentication
    this.oidcSecurityService.checkAuth().pipe(
      filter(result => result.isAuthenticated && !this.hasProcessedCallback),
      take(1)
    ).subscribe(() => {
      this.handleAuthCallback();
    });

    // Also listen for navigation to catch callback URLs
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => !this.hasProcessedCallback)
    ).subscribe((event: NavigationEnd) => {
      if (this.isCallbackUrl(event.url)) {
        console.log('[AuthCallbackHandler] Callback URL detected:', event.url);
        // Small delay to ensure auth state is updated
        setTimeout(() => this.handleAuthCallback(), 100);
      }
    });
  }

  private handleAuthCallback(): void {
    if (this.hasProcessedCallback) return;
    
    this.hasProcessedCallback = true;
    console.log('[AuthCallbackHandler] Processing auth callback');

    const savedUrl = sessionStorage.getItem('pre_auth_url');
    
    if (savedUrl && !this.isCallbackUrl(savedUrl)) {
      console.log('[AuthCallbackHandler] Restoring saved URL:', savedUrl);
      sessionStorage.removeItem('pre_auth_url');
      
      this.router.navigateByUrl(savedUrl).then(success => {
        if (success) {
          console.log('[AuthCallbackHandler] Successfully restored URL');
        } else {
          console.warn('[AuthCallbackHandler] Failed to restore URL, using default');
          this.router.navigate(['/logs/search']);
        }
      });
    } else {
      console.log('[AuthCallbackHandler] No saved URL or invalid URL, using default');
      this.router.navigate(['/logs/search']);
    }
  }

  private isCallbackUrl(url: string): boolean {
    // Adjust these patterns based on your OIDC configuration
    return url.includes('code=') || 
           url.includes('signin-oidc') || 
           url.includes('auth/callback') ||
           url.includes('access_token=');
  }

  public resetCallbackState(): void {
    this.hasProcessedCallback = false;
    sessionStorage.removeItem('pre_auth_url');
  }
}