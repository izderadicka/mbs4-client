import type { User } from "./types/app";

export const appUser: { user: User | null, failedLogin: boolean } = $state({ user: null, failedLogin: false });



