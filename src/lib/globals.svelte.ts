import type { User, BreadcrumbItem } from "./types/app";

export const appUser: { user: User | null, failedLogin: boolean } = $state({ user: null, failedLogin: false });
export const breadcrumb: { path: BreadcrumbItem[] } = $state({ path: [] });



