<script lang="ts">
  import { goto } from "$app/navigation";
  import { breadcrumb } from "$lib/globals.svelte";
  import type { User } from "$lib/api";
  import UserForm from "$lib/components/user-form.svelte";
  import Title from "$lib/components/title.svelte";

  let { data } = $props();
  let user = $derived(data.user);

  $effect(() => {
    breadcrumb.path = [
      { name: "Users", path: "/admin/users" },
      { name: user.name, path: `/admin/users/${user.id}/edit` },
    ];
  });

  async function onCancel() {
    await goto("/admin/users");
  }

  async function afterUpdate(_user: User) {
    await goto("/admin/users");
  }

  async function afterDelete(_id: number) {
    await goto("/admin/users");
  }
</script>

<Title>Edit User</Title>

<UserForm
  userData={{ id: user.id, name: user.name, email: user.email, password: null, roles: user.roles ?? null }}
  {onCancel}
  {afterUpdate}
  {afterDelete} />
