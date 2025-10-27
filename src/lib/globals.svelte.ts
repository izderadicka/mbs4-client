import type { User, BreadcrumbItem, EventItem } from "./types/app";

export const appUser: { user: User | null; failedLogin: boolean } = $state({
  user: null,
  failedLogin: false,
});
export const breadcrumb: { path: BreadcrumbItem[] } = $state({ path: [] });
export const events = $state<{ items: EventItem[] }>({ items: [] });
const _lastEvent = $derived.by(() =>
  events.items.length > 0 ? events.items[events.items.length - 1] : null,
);
export function lastEvent() {
  return _lastEvent;
}
