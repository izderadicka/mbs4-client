<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { Label } from "$lib/components/ui/label";
  import { Input } from "$lib/components/ui/input";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { CreateUserSchema, UpdateUserSchema } from "$lib/schemas";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import type { User as ApiUser, CreateUser, UpdateUser } from "$lib/api";
  import FormButtons from "$lib/components/fragments/form-buttons.svelte";
  import DeleteDialog from "./delete-dialog.svelte";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";

  type EditUserData = UpdateUser & { id: number; email: string };

  let {
    userData = null,
    afterCreate = undefined,
    afterUpdate = undefined,
    afterDelete = undefined,
    onCancel,
    onError = undefined,
  }: {
    userData?: CreateUser | EditUserData | null;
    afterCreate?: (user: ApiUser) => Promise<void>;
    afterUpdate?: (user: ApiUser) => Promise<void>;
    afterDelete?: (id: number) => Promise<void>;
    onCancel: () => void | Promise<void>;
    onError?: (error: unknown) => void | Promise<void>;
  } = $props();

  const isEdit = userData != null && "id" in userData;

  const initialData = userData ?? { email: "", name: "", password: null, roles: null };

  const schema = isEdit ? UpdateUserSchema : CreateUserSchema;

  const form = superForm(initialData, {
    SPA: true,
    dataType: "json",
    validators: zod4Client(schema as any),
    onUpdate: async ({ form }) => {
      if (!form.valid) return;
      if (!isEdit) {
        const payload: CreateUser = {
          email: (form.data as any).email,
          name: form.data.name,
          password: form.data.password || null,
          roles: resolvedRoles(form.data.roles),
        };
        try {
          const newUser = await apiClient.createUser(payload);
          await afterCreate?.(newUser);
        } catch (error) {
          console.error("Failed to create user", error);
          toast.error("Failed to create user");
          onError?.(error);
        }
      } else {
        const payload: UpdateUser = {
          name: form.data.name,
          password: form.data.password || null,
          roles: resolvedRoles(form.data.roles),
        };
        try {
          const updatedUser = await apiClient.updateUser((initialData as EditUserData).id, payload);
          await afterUpdate?.(updatedUser);
        } catch (error) {
          console.error("Failed to update user", error);
          toast.error("Failed to update user");
          onError?.(error);
        }
      }
    },
  });

  const { form: formData, enhance } = form;

  function resolvedRoles(roles: string[] | null | undefined): string[] | null {
    if (!roles || roles.length === 0) return null;
    if (roles.includes("Admin") && !roles.includes("Trusted")) {
      return [...roles, "Trusted"];
    }
    return roles;
  }

  let isAdmin = $derived(($formData.roles ?? []).includes("Admin"));
  let isTrusted = $derived(($formData.roles ?? []).includes("Trusted") || isAdmin);

  function toggleRole(role: string, checked: boolean) {
    const current = $formData.roles ?? [];
    if (checked) {
      $formData.roles = current.includes(role) ? current : [...current, role];
    } else {
      $formData.roles = current.filter((r) => r !== role);
    }
  }

  let deleteDialog: DeleteDialog;

  function onDelete(id: number) {
    deleteDialog.openDialog({
      id,
      name: "user",
      detail: (initialData as EditUserData).email,
    });
  }

  async function onConfirmedDelete(id: number) {
    try {
      await apiClient.deleteUser(id);
      await afterDelete?.(id);
    } catch (error) {
      console.error("Failed to delete user", error);
      toast.error("Failed to delete user");
    }
  }
</script>

<form method="POST" use:enhance class="space-y-6">
  {#if !isEdit}
    <Form.Field {form} name="email">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Email</Form.Label>
          <Input {...props} type="email" bind:value={($formData as any).email} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  {:else}
    <div class="space-y-2">
      <Label>Email</Label>
      <Input value={(initialData as EditUserData).email} disabled />
    </div>
  {/if}

  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Name</Form.Label>
        <Input {...props} bind:value={$formData.name} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field {form} name="password">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Password</Form.Label>
        <Input {...props} type="password" bind:value={$formData.password} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>
      {#if isEdit}
        Leave blank to keep the current password
      {:else}
        Not required for delegate authentication (Google, etc.)
      {/if}
    </Form.Description>
  </Form.Field>

  <div class="space-y-3">
    <Label>Roles</Label>
    <div class="flex flex-col gap-2">
      <label class="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={isAdmin}
          onCheckedChange={(v) => toggleRole("Admin", !!v)} />
        <span class="text-sm">Admin</span>
      </label>
      <label class="flex items-center gap-2 {isAdmin ? 'opacity-50' : 'cursor-pointer'}">
        <Checkbox
          checked={isTrusted}
          disabled={isAdmin}
          onCheckedChange={(v) => toggleRole("Trusted", !!v)} />
        <span class="text-sm">Trusted</span>
      </label>
    </div>
  </div>

  <FormButtons
    id={isEdit ? (initialData as EditUserData).id : null}
    {onCancel}
    {onDelete} />
</form>

<DeleteDialog bind:this={deleteDialog} {onConfirmedDelete} />
