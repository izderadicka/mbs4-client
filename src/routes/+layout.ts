import { apiClient } from "$lib/api/client";
import type { User } from "$lib/types/app";
import { fail } from "@sveltejs/kit";

export const ssr = false;


export async function load({ url }) {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        const user: User = JSON.parse(storedUser);
        return {
            user
        };
    } else {
        const trToken = url.searchParams.get('trt');
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
        }
    }

    return {
        user: null
    };


}