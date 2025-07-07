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
  private readonly router = inject(Router);
  private readonly oidcSecurityService = inject(OidcSecurityService);

  // ================================
  // ANGULAR 19 SIGNALS
  // ================================
  
  public statusMessage = signal('Completing Sign In...');
  public subMessage = signal('Processing your authentication, please wait.');
  public errorMessage = signal('');
  public isDarkMode = signal(this.detectDarkMode());

  ngOnInit(): void {
    console.log('[OidcCallbackComponent] Starting OIDC callback processing');
    this.processCallback();
  }

  private async processCallback(): Promise<void> {
    try {
      this.statusMessage.set('Completing Sign In...');
      this.subMessage.set('Processing your authentication, please wait.');

      const loginResponse = await this.oidcSecurityService.checkAuth().toPromise();
      
      console.log('[OidcCallbackComponent] Login response:', {
        isAuthenticated: loginResponse.isAuthenticated,
        hasAccessToken: !!loginResponse.accessToken,
        errorMessage: loginResponse.errorMessage,
        configId: loginResponse.configId
      });

      if (loginResponse.isAuthenticated) {
        this.statusMessage.set('Sign In Successful!');
        this.subMessage.set('Redirecting to application...');
        
        await this.handleSuccessfulAuth();
      } else {
        // Handle authentication failure
        const error = loginResponse.errorMessage || 'Authentication failed';
        console.error('[OidcCallbackComponent] Authentication failed:', error);
        
        this.statusMessage.set('Sign In Failed');
        this.subMessage.set('There was a problem completing your sign in.');
        this.errorMessage.set(error);
        
        // Redirect to main page after showing error
        setTimeout(() => {
          this.router.navigate(['/logs/search']);
        }, 3000);
      }
    } catch (error) {
      console.error('[OidcCallbackComponent] Error processing callback:', error);
      
      this.statusMessage.set('Sign In Error');
      this.subMessage.set('An unexpected error occurred.');
      this.errorMessage.set('Please try signing in again.');
      
      // Redirect after error
      setTimeout(() => {
        this.router.navigate(['/logs/search']);
      }, 3000);
    }
  }

  private async handleSuccessfulAuth(): Promise<void> {
    // Small delay to show success message
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check for stored URL from before authentication
    const savedUrl = sessionStorage.getItem('pre_auth_url');
    
    if (savedUrl && !this.isCallbackUrl(savedUrl)) {
      console.log('[OidcCallbackComponent] Redirecting to saved URL:', savedUrl);
      sessionStorage.removeItem('pre_auth_url');
      
      try {
        const success = await this.router.navigateByUrl(savedUrl);
        if (!success) {
          console.warn('[OidcCallbackComponent] Failed to navigate to saved URL');
          this.router.navigate(['/logs/search']);
        }
      } catch (error) {
        console.error('[OidcCallbackComponent] Error navigating to saved URL:', error);
        this.router.navigate(['/logs/search']);
      }
    } else {
      console.log('[OidcCallbackComponent] No saved URL, using default');
      this.router.navigate(['/logs/search']);
    }
  }

  private isCallbackUrl(url: string): boolean {
    return url.includes('code=') || 
           url.includes('signin-oidc') || 
           url.includes('access_token=') ||
           url.includes('id_token=');
  }

  private detectDarkMode(): boolean {
    // Check for existing dark mode class or system preference
    const htmlElement = document.querySelector('html');
    return htmlElement?.classList.contains('app-dark') || 
           htmlElement?.classList.contains('my-app-dark') ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}