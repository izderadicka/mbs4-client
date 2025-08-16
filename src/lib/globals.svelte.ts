import type { User, BreadcrumbItem, EventItem } from "./types/app";

export const appUser: { user: User | null, failedLogin: boolean } = $state({ user: null, failedLogin: false });
export const breadcrumb: { path: BreadcrumbItem[] } = $state({ path: [] });
export const events = $state<{ items: EventItem[] }>({ items: [] });



