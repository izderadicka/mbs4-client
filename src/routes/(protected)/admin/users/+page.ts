import { apiClient } from "$lib/api/client";

export async function load() {
  const users = await apiClient.listUsers();
  return { users };
}
