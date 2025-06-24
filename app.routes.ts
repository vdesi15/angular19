// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { startupResolver } from './core/guards/startup.resolver';
import { authenticationGuard } from './core/guards/authentication.guard';
import { authorizationGuard } from './core/guards/authorization.guard';
import { urlParametersGuard } from './core/guards/url-parameters.guard';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/logs/search',
    pathMatch: 'full'
  },
  {
    path: 'logs',
    component: ShellComponent,
    canActivate: [authenticationGuard, authorizationGuard],
    resolve: { startupData: startupResolver },
    children: [
      {
        path: 'search',
        loadComponent: () => import('./features/search-logs/search-logs.component').then(m => m.SearchLogsComponent),
        data: { 
          mode: 'search',
          allowedFilters: ['application', 'environment', 'location']
        }
      },
      {
        path: 'browse',
        loadComponent: () => import('./features/search-logs/search-logs.component').then(m => m.SearchLogsComponent),
        data: { 
          mode: 'browse',
          allowedFilters: ['application', 'environment', 'location', 'dateRange']
        }
      },
      {
        path: 'errors',
        loadComponent: () => import('./features/search-logs/search-logs.component').then(m => m.SearchLogsComponent)
        data: { 
          mode: 'error',
          allowedFilters: ['application', 'environment', 'location', 'dateRange']
        }
      },
      {
        path: '',
        redirectTo: 'search',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'access-denied',
    loadComponent: () => import('./shared/components/access-denied/access-denied.component')
      .then(m => m.AccessDeniedComponent),
    data: { title: 'Access Denied' }
  },
  {
    path: '**',
    redirectTo: '/logs/search'
  }
];