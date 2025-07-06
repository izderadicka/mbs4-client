import { apiClient } from "$lib/api/client";
import type { User } from "$lib/types/app";

export const ssr = false;


export async function load() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        const user: User = JSON.parse(storedUser);
        return {
            user
        };
    } else {
        const user = await apiClient.retrieveToken();
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
            return {
                user
            };
        }
    }

    return {
        user: null
    };


}