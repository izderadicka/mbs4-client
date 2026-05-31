<script lang="ts">
  import { breadcrumb, hasRole } from "$lib/globals.svelte";
  import { ADMIN_ROLE } from "$lib/api";
  import Title from "$lib/components/title.svelte";
  import * as Table from "$lib/components/ui/table/index.js";
  import { Button } from "$lib/components/ui/button";
  import AddIcon from "@lucide/svelte/icons/plus";

  breadcrumb.path = [{ name: "Users", path: "/admin/users" }];

  let { data } = $props();
  let users = $derived(data.users);
</script>

<Title>Users</Title>

<div class="flex gap-2">
  {#if hasRole(ADMIN_ROLE)}
    <Button class="ml-auto" href="/admin/users/new"><AddIcon /><span class="ml-2 hidden md:inline">Add</span></Button>
  {/if}
</div>

<Table.Root class="table-fixed w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-10">Id</Table.Head>
      <Table.Head>Email</Table.Head>
      <Table.Head class="hidden sm:table-cell w-[25%]">Name</Table.Head>
      <Table.Head class="hidden sm:table-cell w-[20%]">Roles</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each users as user (user.id)}
      <Table.Row>
        <Table.Cell class="font-medium">
          <a href="/admin/users/{user.id}/edit">{user.id}</a>
        </Table.Cell>
        <Table.Cell class="truncate"><a href="/admin/users/{user.id}/edit">{user.email}</a></Table.Cell>
        <Table.Cell class="hidden sm:table-cell truncate">{user.name}</Table.Cell>
        <Table.Cell class="hidden sm:table-cell">{user.roles?.join(", ") ?? ""}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
