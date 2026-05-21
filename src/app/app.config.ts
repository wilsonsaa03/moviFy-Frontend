import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

import {
  SocialAuthServiceConfig,
  FacebookLoginProvider,
  SocialLoginModule
} from '@abacritt/angularx-social-login';

export const appConfig: ApplicationConfig = {

  providers: [

    provideRouter(routes),

    provideHttpClient(),

    SocialLoginModule,

    {
      provide: 'SocialAuthServiceConfig',

      useValue: {

        autoLogin: false,

        providers: [

          {
            id: FacebookLoginProvider.PROVIDER_ID,

            provider: new FacebookLoginProvider(
              '2001620540429850'
            )
          }

        ],

        onError: (err: any) => {
          console.error(err);
        }

      } as SocialAuthServiceConfig
    }

  ]
};