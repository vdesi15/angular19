import { Injectable, Signal, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';

interface EnvConfig {
  appName: string;
  defaultRoute: string;
  requiredGroups: string[],
  oauth: { 
    authority: string; 
    redirectUrl: string;
    postLogoutRedirectUri: string;
    clientId: string;
    scope: string;
    responseType: string;
    silentRenew: boolean;
    useRefreshToken: boolean;
    renewTimeBeforeTokenExpiresInSeconds: number;
    logLevel: number;
  };
  useMocks: boolean;
  mockApi: Record<string, string>;
  apiBaseUrl: string;
  api: Record<string, string>;
  apm: {
    serverUrl: string;
    serviceName: string;
    environment: string;
  };
  helpLinks: MenuItem[];
}

const globalEnv = (window as any).__env as EnvConfig;

@Injectable({
  providedIn: 'root'
})

export class ConfigService {
  private _config = signal<EnvConfig>(globalEnv);
  public readonly config = this._config.asReadonly();

  constructor() {
    if(!globalEnv) {
      console.log("FATAL: Environment configuration (`env.js`) was not loaded.");
    }
   }

   get<K extends keyof EnvConfig>(key:K): EnvConfig[K] {
    return this._config()[key];
   }
}
