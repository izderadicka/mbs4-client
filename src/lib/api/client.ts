import type { User } from "$lib/types/app";
import { decodeJwt } from ".";
import type { TokenPayload } from ".";

export class ApiClient {
    token: string | null = null;
    baseUrl: string;
    constructor(baseUrl: string) {
        console.log("API client created");
        this.baseUrl = baseUrl;
    }


    fullUrl(path: string) {
        return this.baseUrl + path;
    }


    private extractPayload(token: string): User {
        const payload = decodeJwt<TokenPayload>(token);

        if (payload.exp <= (Date.now() / 1000) + 60) {
            throw new Error("Token expired");
        }

        const user = {
            email: payload.sub,
            roles: payload.roles,
            tokenValidity: payload.exp * 1000,
        };

        return user;
    }



    async login(email: string, password: string): Promise<User> {
        const response = await fetch(this.fullUrl("/auth/login?token=true"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            throw new Error("Login failed");
        }

        const data = await response.text();
        const user = this.extractPayload(data);
        this.token = data;
        return user

    }

    redirectToSSO(provider: string) {

        window.location.href = `${this.baseUrl}/auth/login?oidc_provider=${provider}`;;
    }

    logout() {
        this.token = null;
    }

    // TODO: reconsider this as it's open for CSRF - will need some kind of nonce 
    async retrieveToken(): Promise<User | null> {
        try {
            const response = await fetch(this.fullUrl("/auth/token"), {
                method: "GET",
                credentials: "include"

            });
            if (response.ok) {
                const data = await response.text();
                const user = this.extractPayload(data);
                this.token = data;
                return user

            }
        } catch (error) {
            console.log(error);
        }

        return null;

    }

}





export const apiClient = new ApiClient("http://localhost:3000");