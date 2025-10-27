export interface User {
  email: string;
  roles: string[];
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
