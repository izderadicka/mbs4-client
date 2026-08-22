<script lang="ts" module>
  import { ADMIN_ROLE, TRUSTED_ROLE, type Role } from "$lib/api";
  type EbookMenuActions =
    | "edit"
    | "cover"
    | "merge"
    | "bookshelf"
    | `search:${number}`;
  const EBOOK_MENU: {
    name: string;
    action: EbookMenuActions;
    requiredRole?: Role;
  }[] = [
    { name: "Edit This Ebook", action: "edit", requiredRole: TRUSTED_ROLE },
    {
      name: "Change Cover Image",
      action: "cover",
      requiredRole: TRUSTED_ROLE,
    },
    {
      name: "Merge with Other Ebook",
      action: "merge",
      requiredRole: TRUSTED_ROLE,
    },
    {
      name: "Add to Bookshelf",
      action: "bookshelf",
      requiredRole: TRUSTED_ROLE,
    },
  ];
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
  import type { PageProps } from "./$types";
  import { breadcrumb, hasAnyRole } from "$lib/globals.svelte";
  import DetailsTable from "./details-table.svelte";
  import RatingsDialog from "./ratings-dialog.svelte";
  import DescriptionBlock from "$lib/components/fragments/description-block.svelte";
  import SourcesList from "./sources-list.svelte";
  import EbookMenu from "$lib/components/item-menu.svelte";
  import { goto } from "$app/navigation";
  import EbookInfo from "./ebook-info.svelte";
  import AddToBookshelfDialog from "$lib/components/add-to-bookshelf-dialog.svelte";
  import { apiClient } from "$lib/api/client";
  import Button from "$lib/components/ui/button/button.svelte";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import LibraryBigIcon from "@lucide/svelte/icons/library-big";
  import { appSettings } from "$lib/settings.svelte";
  import { buildOnlineSearchUrl } from "$lib/utils";

  const { data }: PageProps = $props();
  let ebook = $derived(data.ebook);
  let rating = $state({
    average: data.ebook.rating ?? null,
    count: data.ebook.rating_count ?? null,
    mine: data.myRating?.rating ?? null,
    myReview: data.myRating?.description ?? null,
  });

  let addToBookshelfDialog: AddToBookshelfDialog | null = null;
  let ratingsDialog: RatingsDialog | null = null;

  async function handleRate(value: number) {
    // rating is upserted as a whole, so the review has to be sent along or the
    // server would drop it
    const updated = await apiClient.rateEbook(ebook.id, value, rating.myReview);
    rating = {
      average: updated.rating ?? null,
      count: updated.rating_count ?? null,
      mine: value,
      myReview: rating.myReview,
    };
  }

  async function handleDeleteRating() {
    const updated = await apiClient.deleteEbookRating(ebook.id);
    // deleting the rating removes the review with it
    rating = {
      average: updated.rating ?? null,
      count: updated.rating_count ?? null,
      mine: null,
      myReview: null,
    };
  }

  async function handleSaveReview(text: string | null) {
    if (rating.mine == null) return;
    const updated = await apiClient.rateEbook(ebook.id, rating.mine, text);
    rating = {
      average: updated.rating ?? null,
      count: updated.rating_count ?? null,
      mine: rating.mine,
      myReview: text,
    };
  }

  function onOpenReviews() {
    ratingsDialog?.open();
  }

  let menu = $derived([
    ...EBOOK_MENU,
    ...appSettings.onlineSearches.map((s, i) => ({
      name: `Search on ${s.name}`,
      action: `search:${i}` as const,
    })),
  ]);

  async function onMainMenuSelected(action: EbookMenuActions) {
    if (action.startsWith("search:")) {
      const idx = Number(action.slice("search:".length));
      const engine = appSettings.onlineSearches[idx];
      if (engine) {
        const url = buildOnlineSearchUrl(engine.urlTemplate, ebook);
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    if (action === "edit") {
      await goto(`/ebook/${ebook.id}/edit`);
    } else if (action === "merge") {
      await goto(`/ebook/${ebook.id}/merge`);
    } else if (action === "cover") {
      await goto(`/ebook/${ebook.id}/cover`);
    } else if (action === "bookshelf") {
      await onAddToBookshelf();
    }
  }

  async function onAddToBookshelf() {
    await addToBookshelfDialog?.open();
  }

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }, { name: ebook.title }];
</script>

<div class="flex pr-5">
  <EbookInfo {ebook} />
  <div class="ml-auto flex items-start gap-2">
    {#if hasAnyRole(TRUSTED_ROLE, ADMIN_ROLE)}
      <Button onclick={onAddToBookshelf}>
        <span class="hidden md:inline">Add to Bookshelf</span>
        <span class="inline-flex items-center gap-1 md:hidden">
          <PlusIcon class="size-4" />
          <LibraryBigIcon class="size-4" />
        </span>
      </Button>
    {/if}
    <div class="w-7">
    <EbookMenu
      onMenuSelected={onMainMenuSelected}
      {menu}
      title="Ebook Actions" />
    </div>
  </div>
</div>

<DetailsTable
  {ebook}
  rating={rating.average}
  ratingCount={rating.count}
  userRating={rating.mine}
  onRate={handleRate}
  onDeleteRating={handleDeleteRating}
  {onOpenReviews} />

<DescriptionBlock text={ebook.description} label="Description" class="mt-4" />

<div class="mt-4">
  <SourcesList
    sources={data.sources}
    conversions={data.conversions}
    ebookId={ebook.id} />
</div>

<AddToBookshelfDialog
  bind:this={addToBookshelfDialog}
  title={ebook.title}
  ebookId={ebook.id}
  itemType="EBOOK" />

<RatingsDialog
  bind:this={ratingsDialog}
  ebookId={ebook.id}
  average={rating.average}
  count={rating.count}
  myRating={rating.mine}
  myReview={rating.myReview}
  onRate={handleRate}
  onDeleteRating={handleDeleteRating}
  onSaveReview={handleSaveReview} />
