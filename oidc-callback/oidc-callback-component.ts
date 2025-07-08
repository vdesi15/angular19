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
    <div class="callback-container">
      <div class="callback-content">
        <div class="loading-spinner"></div>
        <h2>Completing Sign In...</h2>
        <p>Please wait while we complete your authentication.</p>
        <div *ngIf="errorMessage" class="error-message">
          <p>{{ errorMessage }}</p>
          <button (click)="retryAuth()">Try Again</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: #f5f5f5;
    }

    .callback-content {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-message {
      margin-top: 1rem;
      padding: 1rem;
      background-color: #fee;
      border: 1px solid #fcc;
      border-radius: 4px;
      color: #c33;
    }

    button {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover {
      background-color: #2980b9;
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