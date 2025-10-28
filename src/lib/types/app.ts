import type { Role } from "$lib/api";

export interface User {
  email: string;
  roles: Role[];
  tokenValidity: number;
}

export interface BreadcrumbItem {
  name: string;
  path?: string;
}

export interface EventItem {
  id?: string | null;
  data: unknown; // parsed JSON or string
  receivedAt: string; // ISO time
  read: boolean;
}
