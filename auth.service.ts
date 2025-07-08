import { inject, Injectable } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { OidcSecurityService } from "angular-auth-oidc-client";
import { map, shareReplay } from "rxjs";
import { UserInfo } from "../models/user.model";

@Injectable({ providedIn: 'root' })
export class AuthService {
    private oidcSecurityService = inject(OidcSecurityService);

    public isAuthenticated = toSignal(
        this.oidcSecurityService.isAuthenticated$,
        { initialValue: undefined}
    );

    public userInfo$ = this.oidcSecurityService.userData$.pipe(
            map(userDataResult => {
                if(!userDataResult) {
                    return null; // Return null if not authenticated or missing data.
                }
                console.log("In Auth service.")

                // Map OIDC claims
                return {
                    name: userDataResult?.userData?.name ?? "Unknown User",
                    email: userDataResult?.userData?.email ?? "No email",
                    groups: userDataResult?.userData?.groups ?? []
                } as UserInfo;
            }),
            shareReplay(1)
        );

    public userInfo = toSignal(this.userInfo$, {initialValue:null}
    );
}
