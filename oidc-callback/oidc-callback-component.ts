import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-oidc-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-container" [class.app-dark]="themeService.isDarkMode()">
      <div class="auth-content">
        <h2 class="auth-title">SEAL</h2>
        <p class="auth-subtitle">{{ currentMessage() }}</p>
        <div class="auth-spinner"></div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      background: var(--surface-ground, #ffffff);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .auth-content {
      text-align: center;
      max-width: 300px;
    }

    .auth-title {
      font-size: 2rem;
      font-weight: 600;
      color: var(--app-blue, #0171c5);
      margin: 0 0 12px 0;
      letter-spacing: -0.02em;
    }

    .auth-subtitle {
      font-size: 1rem;
      color: var(--text-color-secondary, #86868b);
      margin: 0 0 32px 0;
      font-weight: 400;
      min-height: 1.2em;
    }

    .auth-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid transparent;
      border-top: 2px solid var(--app-blue, #0171c5);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Dark mode */
    .app-dark .auth-container {
      background: var(--surface-ground, #1d1d1f);
    }

    .app-dark .auth-subtitle {
      color: var(--text-color-secondary, #a1a1a6);
    }

    /* Responsive */
    @media (max-width: 480px) {
      .auth-title {
        font-size: 1.75rem;
      }
      
      .auth-subtitle {
        font-size: 0.9rem;
      }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .auth-spinner {
        animation: none;
        opacity: 0.6;
      }
    }
  `]
})
export class OidcCallbackComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  public readonly themeService = inject(ThemeService);

  // Simple message state
  public readonly currentMessage = signal('Authenticating...');

  private readonly authMessages = [
    'Authenticating...',
    'Securing session...',
    'Preparing workspace...'
  ];
  ngOnInit(): void {    
    this.handlePostLoginNavigation();
  }

  private async handlePostLoginNavigation(): Promise<void> {
    try {
      // 1. Subscribe to the shared, replayed observable from the service.
      console.log('[OidcCallback] Waiting for AuthService to finish initialization...');
      await firstValueFrom(this.authService.isLoading$.pipe(
        filter(loading => !loading) // This will now receive the replayed `false` value reliably.
      ));
      console.log('[OidcCallback] AuthService is ready.');

      // 2. Proceed with navigation.
      if (this.authService.hasValidSession()) {
        const savedUrl = sessionStorage.getItem('pre_auth_url') || '/logs/search';
        sessionStorage.removeItem('pre_auth_url');
        console.log(`[OidcCallback] Login successful. Navigating to: ${savedUrl}`);
        setTimeout(() => {
          this.router.navigateByUrl(savedUrl).catch(err => {
              console.error(`[OidcCallback] (from timeout) Navigation to ${savedUrl} threw an error.`, err);
              this.router.navigateByUrl('/logs/search'); // Fallback
          });
      }, 0); 
      } else {
        console.error('[OidcCallback] Login failed. Redirecting to access-denied.');
        await this.router.navigateByUrl('/access-denied');
      }
    } catch (error) {
      // This catch block will now correctly handle the EmptyError if it were to occur.
      console.error("[OidcCallback] An error occurred while waiting for auth service.", error);
      await this.router.navigateByUrl('/access-denied');
    }
  }

  private cycleMessages(): void {
    let index = 0;
    const interval = setInterval(() => {
      this.currentMessage.set(this.authMessages[index]);
      index = (index + 1) % this.authMessages.length;
    }, 1000);

    // Stop cycling after auth completes (max 5 seconds)
    setTimeout(() => clearInterval(interval), 5000);
  }
}
