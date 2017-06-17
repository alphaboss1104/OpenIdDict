import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { Configuration } from './app.constants';
import { routing } from './app.routes';
import { HttpModule, JsonpModule } from '@angular/http';

import { DataEventRecordsService } from './dataeventrecords/DataEventRecordsService';
import { DataEventRecord } from './dataeventrecords/models/DataEventRecord';

import { ForbiddenComponent } from './forbidden/forbidden.component';
import { HomeComponent } from './home/home.component';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';

import { DataEventRecordsListComponent } from './dataeventrecords/dataeventrecords-list.component';
import { DataEventRecordsCreateComponent } from './dataeventrecords/dataeventrecords-create.component';
import { DataEventRecordsEditComponent } from './dataeventrecords/dataeventrecords-edit.component';
import { AuthModule, AuthConfiguration, OidcSecurityService } from 'angular-auth-oidc-client';

@NgModule({
    imports: [
        BrowserModule,
        FormsModule,
        routing,
        HttpModule,
        JsonpModule,
        AuthModule.forRoot(),
    ],
    declarations: [
        AppComponent,
        ForbiddenComponent,
        HomeComponent,
        UnauthorizedComponent,
        DataEventRecordsListComponent,
        DataEventRecordsCreateComponent,
        DataEventRecordsEditComponent
    ],
    providers: [
        OidcSecurityService,
        DataEventRecordsService,
        Configuration
    ],
    bootstrap:    [AppComponent],
})

export class AppModule {
    constructor(public authConfiguration: AuthConfiguration) {
        this.authConfiguration.stsServer = 'https://localhost:44319';
        this.authConfiguration.redirect_url = 'https://localhost:44308';
        // The Client MUST validate that the aud (audience) Claim contains its client_id value registered at the Issuer identified by the iss (issuer) Claim as an audience.
        // The ID Token MUST be rejected if the ID Token does not list the Client as a valid audience, or if it contains additional audiences not trusted by the Client.
        this.authConfiguration.client_id = 'angular4client';
        this.authConfiguration.response_type = 'id_token token';
        this.authConfiguration.scope = 'dataEventRecords openid';
        this.authConfiguration.post_logout_redirect_uri = 'https://localhost:44308/Unauthorized';
        this.authConfiguration.start_checksession = false;
        this.authConfiguration.silent_renew = true;
        this.authConfiguration.startup_route = '/dataeventrecords/list';
        // HTTP 403
        this.authConfiguration.forbidden_route = '/Forbidden';
        // HTTP 401
        this.authConfiguration.unauthorized_route = '/Unauthorized';
        this.authConfiguration.log_console_warning_active = true;
        this.authConfiguration.log_console_debug_active = false;
        // id_token C8: The iat Claim can be used to reject tokens that were issued too far away from the current time,
        // limiting the amount of time that nonces need to be stored to prevent attacks.The acceptable range is Client specific.
        this.authConfiguration.max_id_token_iat_offset_allowed_in_seconds = 3;
    }
}