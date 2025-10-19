import type { User, BreadcrumbItem, EventItem } from "./types/app";
import { derived, writable } from "svelte/store";

// export const appUser: { user: User | null, failedLogin: boolean } = $state({ user: null, failedLogin: false });
// export const breadcrumb: { path: BreadcrumbItem[] } = $state({ path: [] });
// export const events = $state<{ items: EventItem[] }>({ items: [] });
// const _lastEvent = $derived.by(() => events.items.length > 0 ? events.items[events.items.length - 1] : null);
// export function lastEvent() {
//     return _lastEvent;
// }

export const appUser = writable<{ user: User | null, failedLogin: boolean }>({ user: null, failedLogin: false });
export const breadcrumb = writable<{ path: BreadcrumbItem[] }>({ path: [] });
export const events = writable<{ items: EventItem[] }>({ items: [] });
export const lastEvent = derived(events, ($events) => $events.items.length > 0 ? $events.items[$events.items.length - 1] : null);



