export type User = {
    email: string;
    roles: string[];
    tokenValidity: number;
}

export type BreadcrumbItem = {
    name: string;
    path: string | null;
}