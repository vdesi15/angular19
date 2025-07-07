// src/app/auth/root-handler/root-handler.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';

/**
 * Root Handler Component - Handles the root route intelligently
 * Checks if this is an OIDC callback or a normal navigation
 */
@Component({
  selector: 'app-root-handler',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="root-handler">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <h2>{{ loadingMessage }}</h2>
        <p>{{ loadingSubtext }}</p>
      </div>
    </div>
  `,
  styles: [`
    .root-handler {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: #f8f9fa;
    }

    .loading-content {
      text-align: center;
      padding: 2rem;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e3e3e3;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    h2 {
      margin: 1rem 0 0.5rem;
      color: #333;
    }

    p {
      color: #666;
      margin: 0;
    }
  `]
})
export class RootHandlerComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly oidcSecurityService = inject(OidcSecurityService);

  public loadingMessage = 'Loading...';
  public loadingSubtext = 'Please wait while we set up your session.';

  ngOnInit(): void {
    console.log('[RootHandler] Processing root route navigation');
    this.handleRootNavigation();
  }

  private async handleRootNavigation(): Promise<void> {
    try {
      // Get current URL with query parameters
      const currentUrl = this.router.url;
      const queryParams = this.route.snapshot.queryParams;
      
      console.log('[RootHandler] Current URL:', currentUrl);
      console.log('[RootHandler] Query params:', queryParams);

      // Check if this looks like an OIDC callback
      if (this.isOidcCallback(queryParams)) {
        this.loadingMessage = 'Completing Sign In...';
        this.loadingSubtext = 'Processing your authentication.';
        console.log('[RootHandler] Detected OIDC callback, processing...');
        
        await this.processOidcCallback();
      } else {
        this.loadingMessage = 'Redirecting...';
        this.loadingSubtext = 'Taking you to the application.';
        console.log('[RootHandler] Normal navigation, redirecting to default route');
        
        await this.handleNormalNavigation();
      }
    } catch (error) {
      console.error('[RootHandler] Error in root navigation:', error);
      this.router.navigate(['/logs/search']);
    }
  }

  private isOidcCallback(queryParams: any): boolean {
    // Check for common OIDC callback parameters
    return !!(
      queryParams['code'] ||           // Authorization code
      queryParams['access_token'] ||   // Implicit flow
      queryParams['id_token'] ||       // Implicit flow
      queryParams['state'] ||          // OIDC state parameter
      queryParams['session_state']     // Some providers use this
    );
  }

  private async processOidcCallback(): Promise<void> {
    try {
      // Let OIDC service process the callback
      const result = await this.oidcSecurityService.checkAuth().toPromise();
      
      console.log('[RootHandler] OIDC processing result:', {
        isAuthenticated: result?.isAuthenticated,
        hasAccessToken: !!result?.accessToken
      });

      if (result?.isAuthenticated) {
        console.log('[RootHandler] Authentication successful');
        await this.handleSuccessfulAuth();
      } else {
        console.error('[RootHandler] Authentication failed:', result?.errorMessage);
        this.router.navigate(['/logs/search']);
      }
    } catch (error) {
      console.error('[RootHandler] Error processing OIDC callback:', error);
      this.router.navigate(['/logs/search']);
    }
  }

  private async handleSuccessfulAuth(): Promise<void> {
    // Check for stored URL from before authentication
    const savedUrl = sessionStorage.getItem('pre_auth_url');
    
    if (savedUrl && !this.isCallbackUrl(savedUrl)) {
      console.log('[RootHandler] Redirecting to saved URL:', savedUrl);
      sessionStorage.removeItem('pre_auth_url');
      
      try {
        const success = await this.router.navigateByUrl(savedUrl);
        if (!success) {
          console.warn('[RootHandler] Failed to navigate to saved URL');
          this.router.navigate(['/logs/search']);
        }
      } catch (error) {
        console.error('[RootHandler] Error navigating to saved URL:', error);
        this.router.navigate(['/logs/search']);
      }
    } else {
      console.log('[RootHandler] No saved URL, using default');
      this.router.navigate(['/logs/search']);
    }
  }

  private async handleNormalNavigation(): Promise<void> {
    // This is just a normal navigation to root, redirect to default
    this.router.navigate(['/logs/search']);
  }

  private isCallbackUrl(url: string): boolean {
    return url.includes('code=') || 
           url.includes('signin-oidc') || 
           url.includes('access_token=');
  }
}