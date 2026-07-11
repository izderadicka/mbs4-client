import type { Role } from "./api";
import type { User, BreadcrumbItem, EventItem } from "./types/app";

export const appUser: { user: User | null; failedLogin: boolean } = $state({
  user: null,
  failedLogin: false,
});
export const breadcrumb: { path: BreadcrumbItem[] } = $state({ path: [] });
export const events = $state<{ items: EventItem[] }>({ items: [] });

export function hasRole(role: Role): boolean {
  return !!appUser.user?.roles.includes(role);
}

export function hasAnyRole(...roles: Role[]): boolean {
  return roles.some(hasRole);
}
