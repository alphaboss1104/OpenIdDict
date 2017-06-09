﻿import { Injectable, EventEmitter, Output } from '@angular/core';
import { Http, Response, Headers } from '@angular/http';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import { Observable } from 'rxjs/Rx';
import { Router } from '@angular/router';
import { AuthConfiguration } from '../auth.configuration';
import { OidcSecurityValidation } from './oidc.security.validation';
import { OidcSecurityCheckSession } from './oidc.security.check-session';
import { OidcSecuritySilentRenew } from './oidc.security.silent-renew';
import { OidcSecurityUserService } from './oidc.security.user-service';
import { OidcSecurityCommon } from './oidc.security.common';
import { JwtKeys } from './jwtkeys';

@Injectable()
export class OidcSecurityService {

    @Output() onUserDataLoaded: EventEmitter<any> = new EventEmitter<any>(true);

    checkSessionChanged: boolean;
    isAuthorized: boolean;

    private headers: Headers;
    private oidcSecurityValidation: OidcSecurityValidation;
    private errorMessage: string;
    private jwtKeys: JwtKeys;

    constructor(
        private http: Http,
        private authConfiguration: AuthConfiguration,
        private router: Router,
        private oidcSecurityCheckSession: OidcSecurityCheckSession,
        private oidcSecuritySilentRenew: OidcSecuritySilentRenew,
        private oidcSecurityUserService: OidcSecurityUserService,
        private oidcSecurityCommon: OidcSecurityCommon
    ) {
        this.oidcSecurityValidation = new OidcSecurityValidation(this.oidcSecurityCommon);

        this.headers = new Headers();
        this.headers.append('Content-Type', 'application/json');
        this.headers.append('Accept', 'application/json');

        if (this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_is_authorized) !== '') {
            this.isAuthorized = this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_is_authorized);
        }

        this.oidcSecurityCheckSession.onCheckSessionChanged.subscribe(() => { this.onCheckSessionChanged(); });
    }

    getToken(): any {
        return this.oidcSecurityCommon.getAccessToken();
    }

    getUserData(): any {
        if (!this.isAuthorized) {
            this.oidcSecurityCommon.logError('User must be logged in before you can get the user data!')
        }

        return this.oidcSecurityUserService.userData;
    }

    authorize() {
        this.resetAuthorizationData();

        this.oidcSecurityCommon.logDebug('BEGIN Authorize, no auth data');

        let nonce = 'N' + Math.random() + '' + Date.now();
        let state = Date.now() + '' + Math.random();

        this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_auth_state_control, state);
        this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_auth_nonce, nonce);
        this.oidcSecurityCommon.logDebug('AuthorizedController created. local state: ' + this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_auth_state_control));

        let url = this.createAuthorizeUrl(nonce, state);
        window.location.href = url;
    }

    authorizedCallback() {
        this.oidcSecurityCommon.logDebug('BEGIN AuthorizedCallback, no auth data');
        this.resetAuthorizationData();

        let hash = window.location.hash.substr(1);

        let result: any = hash.split('&').reduce(function (result: any, item: string) {
            let parts = item.split('=');
            result[parts[0]] = parts[1];
            return result;
        }, {});

        this.oidcSecurityCommon.logDebug(result);
        this.oidcSecurityCommon.logDebug('AuthorizedCallback created, begin token validation');

        let token = '';
        let id_token = '';
        let authResponseIsValid = false;

        this.getSigningKeys()
            .subscribe(jwtKeys => {
                this.jwtKeys = jwtKeys;

                if (!result.error) {

                    // validate state
                    if (this.oidcSecurityValidation.validateStateFromHashCallback(result.state, this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_auth_state_control))) {
                        token = result.access_token;
                        id_token = result.id_token;
                        let decoded: any;
                        let headerDecoded;
                        decoded = this.oidcSecurityValidation.getPayloadFromToken(id_token, false);
                        headerDecoded = this.oidcSecurityValidation.getHeaderFromToken(id_token, false);

                        // validate jwt signature
                        if (this.oidcSecurityValidation.validate_signature_id_token(id_token, this.jwtKeys)) {
                            // validate nonce
                            if (this.oidcSecurityValidation.validate_id_token_nonce(decoded, this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_auth_nonce))) {
                                // validate iss
                                if (this.oidcSecurityValidation.validate_id_token_iss(decoded, this.authConfiguration.iss)) {
                                    // validate aud
                                    if (this.oidcSecurityValidation.validate_id_token_aud(decoded, this.authConfiguration.client_id)) {
                                        // valiadate at_hash and access_token
                                        if (this.oidcSecurityValidation.validate_id_token_at_hash(token, decoded.at_hash) || !token) {
                                            this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_auth_nonce, '');
                                            this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_auth_state_control, '');

                                            authResponseIsValid = true;
                                            this.oidcSecurityCommon.logDebug('AuthorizedCallback state, nonce, iss, aud, signature validated, returning token');
                                        } else {
                                            this.oidcSecurityCommon.logWarning('AuthorizedCallback incorrect aud');
                                        }
                                    } else {
                                        this.oidcSecurityCommon.logWarning('AuthorizedCallback incorrect aud');
                                    }
                                } else {
                                    this.oidcSecurityCommon.logWarning('AuthorizedCallback incorrect iss');
                                }
                            } else {
                                this.oidcSecurityCommon.logWarning('AuthorizedCallback incorrect nonce');
                            }
                        } else {
                            this.oidcSecurityCommon.logWarning('AuthorizedCallback incorrect Signature id_token');
                        }
                    } else {
                        this.oidcSecurityCommon.logWarning('AuthorizedCallback incorrect state');
                    }
                }

                if (authResponseIsValid) {
                    this.setAuthorizationData(token, id_token);
                    this.oidcSecurityUserService.initUserData()
                        .subscribe(() => {
                            this.onUserDataLoaded.emit();
                            this.oidcSecurityCommon.logDebug(this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_access_token));
                            this.oidcSecurityCommon.logDebug(this.oidcSecurityUserService.userData);
                            if (this.authConfiguration.start_checksession) {
                                this.oidcSecurityCheckSession.init().then(() => {
                                    this.oidcSecurityCheckSession.pollServerSession(result.session_state, this.authConfiguration.client_id);
                                });
                            }

                            if (this.authConfiguration.silent_renew) {
                                this.oidcSecuritySilentRenew.initRenew();
                            }

                            this.runTokenValidatation();

                            this.router.navigate([this.authConfiguration.startup_route]);
                        });

                } else {
                    this.resetAuthorizationData();
                    this.router.navigate([this.authConfiguration.unauthorized_route]);
                }
            });
    }

    logoff() {
        // /connect/endsession?id_token_hint=...&post_logout_redirect_uri=https://myapp.com
        this.oidcSecurityCommon.logDebug('BEGIN Authorize, no auth data');

        let authorizationEndsessionUrl = this.authConfiguration.logoutEndSession_url;

        let id_token_hint = this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_id_token);
        let post_logout_redirect_uri = this.authConfiguration.post_logout_redirect_uri;

        let url =
            authorizationEndsessionUrl + '?' +
            'id_token_hint=' + encodeURI(id_token_hint) + '&' +
            'post_logout_redirect_uri=' + encodeURI(post_logout_redirect_uri);

        this.resetAuthorizationData();

        if (this.authConfiguration.start_checksession && this.checkSessionChanged) {
            this.oidcSecurityCommon.logDebug('only local login cleaned up, server session has changed');
        } else {
            window.location.href = url;
        }
    }

    refreshSession() {
        this.oidcSecurityCommon.logDebug('BEGIN refresh session Authorize');

        let nonce = 'N' + Math.random() + '' + Date.now();
        let state = Date.now() + '' + Math.random();

        this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_auth_state_control, state);
        this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_auth_nonce, nonce);
        this.oidcSecurityCommon.logDebug('RefreshSession created. adding myautostate: ' + this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_auth_state_control));

        let url = this.createAuthorizeUrl(nonce, state);

        this.oidcSecuritySilentRenew.startRenew(url);
    }

    private setAuthorizationData(access_token: any, id_token: any) {
        if (this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_access_token) !== '') {
            this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_access_token, '');
        }

        this.oidcSecurityCommon.logDebug(access_token);
        this.oidcSecurityCommon.logDebug(id_token);
        this.oidcSecurityCommon.logDebug('storing to storage, getting the roles');
        this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_access_token, access_token);
        this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_id_token, id_token);
        this.isAuthorized = true;
        this.oidcSecurityCommon.store(this.oidcSecurityCommon.storage_is_authorized, true);
    }

    private createAuthorizeUrl(nonce: string, state: string): string {

        let authorizationUrl = this.authConfiguration.authorise_url;
        let client_id = this.authConfiguration.client_id;
        let redirect_uri = this.authConfiguration.redirect_url;
        let response_type = this.authConfiguration.response_type;
        let scope = this.authConfiguration.scope;

        let url =
            authorizationUrl + '?' +
            'response_type=' + encodeURI(response_type) + '&' +
            'client_id=' + encodeURI(client_id) + '&' +
            'redirect_uri=' + encodeURI(redirect_uri) + '&' +
            'scope=' + encodeURI(scope) + '&' +
            'nonce=' + encodeURI(nonce) + '&' +
            'state=' + encodeURI(state);

        return url;

    }

    private resetAuthorizationData() {
        this.isAuthorized = false;
        this.oidcSecurityCommon.resetStorageData();
        this.checkSessionChanged = false;
    }

    handleError(error: any) {
        this.oidcSecurityCommon.logError(error);
        if (error.status == 403) {
            this.router.navigate([this.authConfiguration.forbidden_route]);
        } else if (error.status == 401) {
            this.resetAuthorizationData();
            this.router.navigate([this.authConfiguration.unauthorized_route]);
        }
    }

    private onCheckSessionChanged() {
        this.oidcSecurityCommon.logDebug('onCheckSessionChanged');
        this.checkSessionChanged = true;
    }

    private runGetSigningKeys() {
        this.getSigningKeys()
            .subscribe(
            jwtKeys => this.jwtKeys = jwtKeys,
            error => this.errorMessage = <any>error);
    }

    private getSigningKeys(): Observable<JwtKeys> {
        return this.http.get(this.authConfiguration.jwks_url)
            .map(this.extractData)
            .catch(this.handleErrorGetSigningKeys);
    }

    private extractData(res: Response) {
        let body = res.json();
        return body;
    }

    private handleErrorGetSigningKeys(error: Response | any) {
        // In a real world app, you might use a remote logging infrastructure
        let errMsg: string;
        if (error instanceof Response) {
            const body = error.json() || '';
            const err = body.error || JSON.stringify(body);
            errMsg = `${error.status} - ${error.statusText || ''} ${err}`;
        } else {
            errMsg = error.message ? error.message : error.toString();
        }
        this.oidcSecurityCommon.logError(errMsg);
        return Observable.throw(errMsg);
    }

    private runTokenValidatation() {
        let source = Observable.timer(3000, 3000)
            .timeInterval()
            .pluck('interval')
            .take(10000);

        let subscription = source.subscribe(() => {
            if (this.isAuthorized) {
                if (this.oidcSecurityValidation.isTokenExpired(this.oidcSecurityCommon.retrieve(this.oidcSecurityCommon.storage_id_token))) {
                    this.oidcSecurityCommon.logDebug('IsAuthorized: id_token isTokenExpired, start silent renew if active');

                    if (this.authConfiguration.silent_renew) {
                        this.refreshSession();
                    } else {
                        this.resetAuthorizationData();
                    }
                }
            }
        },
        function (err: any) {
            this.oidcSecurityCommon.logError('Error: ' + err);
        },
        function () {
            this.oidcSecurityCommon.logDebug('Completed');
        });
    }
}