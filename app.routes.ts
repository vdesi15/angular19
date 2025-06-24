import { Routes } from '@angular/router';
import { startupResolver } from './core/guards/startup.resolver';
import { authenticationGuard } from './core/guards/authentication.guard';
import { authorizationGuard } from './core/guards/authorization.guard';
import { urlParametersGuard } from './core/guards/url-parameters.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/logs/search',
    pathMatch: 'full'
  },
  {
    path: 'logs',
    children: [
      {
        path: 'search',
        loadComponent: () => import('./features/search-logs/search-logs.component')
          .then(m => m.SearchLogsComponent),
        canActivate: [authenticationGuard, authorizationGuard, urlParametersGuard],
        resolve: { startup: startupResolver },
        data: { 
          mode: 'search',
          allowedFilters: ['application', 'environment', 'location'],
          title: 'Smart Search',
          preserveUrlParams: true // Flag for our URL guard
        }
      },
      {
        path: 'browse',
        loadComponent: () => import('./features/search-logs/search-logs.component')
          .then(m => m.SearchLogsComponent),
        canActivate: [authenticationGuard, authorizationGuard, urlParametersGuard],
        resolve: { startup: startupResolver },
        data: { 
          mode: 'browse',
          allowedFilters: ['application', 'environment', 'location', 'dateRange'],
          title: 'Live Log Browser',
          preserveUrlParams: true
        }
      },
      {
        path: 'errors',
        loadComponent: () => import('./features/search-logs/search-logs.component')
          .then(m => m.SearchLogsComponent),
        canActivate: [authenticationGuard, authorizationGuard, urlParametersGuard],
        resolve: { startup: startupResolver },
        data: { 
          mode: 'error',
          allowedFilters: ['application', 'environment', 'location', 'dateRange'],
          title: 'Error Log Monitor',
          preserveUrlParams: true
        }
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