import { Component, inject } from '@angular/core';
import { AuthCallbackHandlerService } from './core/services/auth-callback-handler.service';

@Component({
  selector: 'app-root',
  // ... your existing template and styles
})
export class AppComponent {
  // Just inject the service - it will auto-initialize
  private readonly authCallbackHandler = inject(AuthCallbackHandlerService);
  
  // ... rest of your existing component code
}