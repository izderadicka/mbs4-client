import { get } from "svelte/store";
import type { User } from "./types/app";

export const appUser: { user: User | null } = $state({ user: null });



