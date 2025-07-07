// src/app/auth/oidc-callback/oidc-callback.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';

/**
 * OIDC Callback Component - Handles the callback from identity provider
 * This component processes the authorization code and redirects to the saved URL
 */
@Component({
  selector: 'app-oidc-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oidc-callback-container" [class.app-dark]="isDarkMode()">
      <div class="callback-card">
        <p-card>
          <div class="callback-content">
            <p-progressSpinner 
              [style]="{ width: '50px', height: '50px' }"
              strokeWidth="4">
            </p-progressSpinner>
            
            <h2>{{ statusMessage() }}</h2>
            <p>{{ subMessage() }}</p>
            
            @if (errorMessage()) {
              <div class="error-message">
                <i class="pi pi-exclamation-triangle"></i>
                {{ errorMessage() }}
              </div>
            }
          </div>
        </p-card>
      </div>
    </div>
  `,
  styles: [`
    .oidc-callback-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--p-surface-ground);
      transition: background-color 0.3s ease;
      padding: 1rem;
    }

    .callback-card {
      width: 100%;
      max-width: 400px;
    }

    .callback-content {
      text-align: center;
      padding: 2rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    h2 {
      margin: 0;
      color: var(--p-text-color);
      font-size: 1.5rem;
      font-weight: 600;
    }

    p {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--p-red-500);
      background: var(--p-red-50);
      padding: 0.75rem 1rem;
      border-radius: var(--p-border-radius);
      border: 1px solid var(--p-red-200);
      font-size: 0.9rem;
    }

    /* Dark mode adjustments */
    .app-dark .error-message {
      background: var(--p-red-950);
      border-color: var(--p-red-800);
      color: var(--p-red-400);
    }

    .app-dark .oidc-callback-container {
      background: var(--p-surface-ground);
    }
  `]
})
export class OidcCallbackComponent implements OnInit {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly router = inject(Router);

  public errorMessage: string | null = null;

  ngOnInit(): void {
    console.log('[OidcCallback] Processing OIDC callback');
    this.processCallback();
  }

  private async processCallback(): Promise<void> {
    try {
      // Let the OIDC service handle the callback
      const result = await this.oidcSecurityService.checkAuth().toPromise();
      
      console.log('[OidcCallback] Auth check result:', {
        isAuthenticated: result?.isAuthenticated,
        hasAccessToken: !!result?.accessToken,
        errorMessage: result?.errorMessage
      });

      if (result?.isAuthenticated) {
        console.log('[OidcCallback] Authentication successful');
        await this.handleSuccessfulAuth();
      } else {
        console.error('[OidcCallback] Authentication failed:', result?.errorMessage);
        this.errorMessage = result?.errorMessage || 'Authentication failed';
        setTimeout(() => this.fallbackRedirect(), 3000);
      }
    } catch (error) {
      console.error('[OidcCallback] Error processing callback:', error);
      this.errorMessage = 'An error occurred during authentication';
      setTimeout(() => this.fallbackRedirect(), 3000);
    }
  }

  private async handleSuccessfulAuth(): Promise<void> {
    // Check for stored URL from before authentication
    const savedUrl = sessionStorage.getItem('pre_auth_url');
    
    if (savedUrl && !this.isCallbackUrl(savedUrl)) {
      console.log('[OidcCallback] Redirecting to saved URL:', savedUrl);
      sessionStorage.removeItem('pre_auth_url');
      
      try {
        const success = await this.router.navigateByUrl(savedUrl);
        if (!success) {
          console.warn('[OidcCallback] Failed to navigate to saved URL, using default');
          this.router.navigate(['/logs/search']);
        }
      } catch (error) {
        console.error('[OidcCallback] Error navigating to saved URL:', error);
        this.router.navigate(['/logs/search']);
      }
    } else {
      console.log('[OidcCallback] No saved URL found, redirecting to default');
      this.router.navigate(['/logs/search']);
    }
  }

  private fallbackRedirect(): void {
    console.log('[OidcCallback] Performing fallback redirect');
    sessionStorage.removeItem('pre_auth_url'); // Clean up
    this.router.navigate(['/logs/search']);
  }

  public retryAuth(): void {
    console.log('[OidcCallback] Retrying authentication');
    this.errorMessage = null;
    this.oidcSecurityService.authorize();
  }

  private isCallbackUrl(url: string): boolean {
    return url.includes('signin-oidc') || 
           url.includes('auth/callback') || 
           url.includes('code=');
  }
}