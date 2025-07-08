import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-oidc-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container" [class.app-dark]="isDarkMode">
      <div class="callback-content">
        <div class="loading-spinner"></div>
        <h2>Completing Sign In...</h2>
        <p>Please wait while we complete your authentication.</p>
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--surface-ground, #f8f9fa);
      transition: background-color 0.3s ease;
    }

    .callback-container.app-dark {
      background: var(--surface-ground, #121212);
    }

    .callback-content {
      text-align: center;
      padding: 2rem;
      background: var(--surface-card, white);
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
      border: 1px solid var(--surface-border, #e1e5e9);
    }

    .app-dark .callback-content {
      background: var(--surface-card, #1e1e1e);
      border-color: var(--surface-border, #374151);
    }

    .callback-content h2 {
      color: var(--text-color, #212529);
      margin-bottom: 1rem;
    }

    .callback-content p {
      color: var(--text-color-secondary, #6c757d);
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid var(--surface-300, #e1e5e9);
      border-top: 4px solid var(--primary-color, #0171c5);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class OidcCallbackComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

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
}
