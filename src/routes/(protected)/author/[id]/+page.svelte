<script lang="ts" module>
  import { ADMIN_ROLE, TRUSTED_ROLE, type Role } from "$lib/api";
  type AuthorMenuActions = "edit" | "merge" | "batch_convert";
  const AUTHOR_MENU: {
    name: string;
    action: AuthorMenuActions;
    requiredRole?: Role;
  }[] = [
    { name: "Edit This Author", action: "edit", requiredRole: TRUSTED_ROLE },
    {
      name: "Merge with Other Author",
      action: "merge",
      requiredRole: ADMIN_ROLE,
    },
    {
      name: "Convert All to Format…",
      action: "batch_convert",
      requiredRole: TRUSTED_ROLE,
    },
  ];
</script>

<script lang="ts">
  import { type Author } from "$lib/api";
  import EbookList from "$lib/components/ebook-list.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  import AuthorMenu from "$lib/components/item-menu.svelte";
  import BatchConvertDialog from "$lib/components/batch-convert-dialog.svelte";
  import { goto } from "$app/navigation";
  import { formatName } from "$lib/utils.js";

  let { data } = $props();
  let author = $derived(data.author);
  let authorName = $derived(formatName(author));
  let batchConvertDialog: BatchConvertDialog | null = null;

  $effect(() => {
    breadcrumb.path = [
      { name: "Authors", path: "/author" },
      { name: authorName },
    ];
  });

  async function onMainMenuSelected(action: AuthorMenuActions) {
    if (action === "edit") {
      await goto(`/author/${author.id}/edit`);
    } else if (action === "merge") {
      await goto(`/author/${author.id}/merge`);
    } else if (action === "batch_convert") {
      await batchConvertDialog?.open();
    }
  }
</script>

<div class="flex pr-5">
  <Title>
    {formatName(author)}
  </Title>
  <div class="w-7 ml-auto">
    <AuthorMenu
      onMenuSelected={onMainMenuSelected}
      menu={AUTHOR_MENU}
      title="Author Actions" />
  </div>
</div>

<BatchConvertDialog
  bind:this={batchConvertDialog}
  title={authorName}
  forEntity="AUTHOR"
  entityId={author.id} />

<Subtitle>Ebooks</Subtitle>
<EbookList ebooks={data.ebooks} sort={data.sort} genres={data.genres} />
