import { apiClient } from "$lib/api/client";
import type { User } from "$lib/types/app";
import { TOKEN_VALIDITY_MINUTES_MINIMUM } from "$lib/config";

export const ssr = false;


export async function load({ url, fetch }) {
    apiClient.setFetch(fetch);
    const trToken = url.searchParams.get('trt');
    // Redirected from federated authentication
    if (trToken) {
        try {

            const user = await apiClient.retrieveToken(trToken);

            localStorage.setItem('user', JSON.stringify(user));
            return {
                user
            };
        } catch (error) {
            return {
                user: null,
                failedLogin: true

            };
        }
    } else {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user: User = JSON.parse(storedUser);
            if (user.tokenValidity > Date.now() + TOKEN_VALIDITY_MINUTES_MINIMUM * 60 * 1000) {
                return {
                    user
                };
            }
        }



        return {
            user: null
        };

    }


}