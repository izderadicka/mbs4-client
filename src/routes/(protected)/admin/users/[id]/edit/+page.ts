import { error } from "@sveltejs/kit";
import { apiClient } from "$lib/api/client";

export async function load({ params }) {
  const users = await apiClient.listUsers();
  const user = users.find((u) => u.id === Number(params.id));
  if (!user) error(404, "User not found");
  return { user };
}
