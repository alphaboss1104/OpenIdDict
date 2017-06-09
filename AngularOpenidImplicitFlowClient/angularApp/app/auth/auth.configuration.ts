import { Injectable } from '@angular/core';

@Injectable()
export class AuthConfiguration {

    // The Issuer Identifier for the OpenID Provider (which is typically obtained during Discovery) MUST exactly match the value of the iss (issuer) Claim.
    iss = 'https://localhost:44319/';

    server = 'https://localhost:44319';

    redirect_url = 'https://localhost:44308';

    // This is required to get the signing keys so that the signiture of the Jwt can be validated.
    jwks_url = 'https://localhost:44319/.well-known/jwks';

	authorise_url = 'https://localhost:44319/connect/authorize';

    userinfo_url = 'https://localhost:44319/api/userinfo';

    logoutEndSession_url = 'https://localhost:44319/connect/logout';

	checksession_url = 'https://localhost:44319/connect/checksession'

    // The Client MUST validate that the aud (audience) Claim contains its client_id value registered at the Issuer identified by the iss (issuer) Claim as an audience.
    // The ID Token MUST be rejected if the ID Token does not list the Client as a valid audience, or if it contains additional audiences not trusted by the Client.
    client_id = 'angular4client';

    response_type = 'id_token token';

    scope = 'dataEventRecords openid';

    post_logout_redirect_uri = 'https://localhost:44308/Unauthorized';

    start_checksession = false;

    silent_renew = true;

    startup_route = '/dataeventrecords/list';

    // HTTP 403
    forbidden_route = '/Forbidden';

    // HTTP 401
    unauthorized_route = '/Unauthorized';

    log_console_warning_active = true;

    log_console_debug_active = true;
}