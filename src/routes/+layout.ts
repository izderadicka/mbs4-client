import type { User } from "$lib/types/app";

export const ssr = false;


export async function load() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        const user: User = JSON.parse(storedUser);
        return {
            user
        };
    }

    return {
        user: null
    };


}