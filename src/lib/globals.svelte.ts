import { get } from "svelte/store";
import type { User } from "./types/app";
import { ApiClient } from "./api/client";

export const appUser: { user: User | null, failedLogin: boolean } = $state({ user: null, failedLogin: false });



