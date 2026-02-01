<script lang="ts" module>
  type AuthorMenuActions = "edit" | "merge";
  const AUTHOR_MENU: { name: string; action: AuthorMenuActions }[] = [
    { name: "Edit This Author", action: "edit" },
    { name: "Merge with Other Author", action: "merge" },
  ];
</script>

<script lang="ts">
  import { type Author } from "$lib/api";
  import EbookList from "$lib/components/ebook-list.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  import AuthorMenu from "$lib/components/item-menu.svelte";
  import { goto } from "$app/navigation";
  import { formatName } from "$lib/utils.js";

  let { data } = $props();
  let author = $derived(data.author);
  let authorName = $derived(formatName(author));
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

<Subtitle>Ebooks</Subtitle>
<EbookList ebooks={data.ebooks} sort={data.sort} genres={data.genres} />
