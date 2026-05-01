<script lang="ts">
  import { goto } from "$app/navigation";
  import { breadcrumb } from "$lib/globals.svelte";
  import type { User } from "$lib/api";
  import UserForm from "$lib/components/user-form.svelte";
  import Title from "$lib/components/title.svelte";

  breadcrumb.path = [
    { name: "Users", path: "/admin/users" },
    { name: "New User", path: "/admin/users/new" },
  ];

  async function onCancel() {
    await goto("/admin/users");
  }

  async function afterCreate(_user: User) {
    await goto("/admin/users");
  }
</script>

<Title>New User</Title>

<UserForm {onCancel} {afterCreate} />
