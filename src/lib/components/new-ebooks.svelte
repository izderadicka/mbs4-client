<script lang="ts">
  // TODO: there is problem when resizing window, but it's not a big deal now
  import { apiClient } from "$lib/api/client";
  import { onMount, tick } from "svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Carousel from "$lib/components/ui/carousel/index.js";
  import Subtitle from "./subtitle.svelte";
  import type { EbookShort } from "$lib/api";
  import { ebookSortQuery } from "$lib/api/sorting";
  import type { CarouselAPI } from "./ui/carousel/context";
  import CoverIcon from "./fragments/cover-icon.svelte";

  let container: HTMLDivElement;
  let carouselApi: CarouselAPI | undefined;
  let width = $state(0);

  $effect(() => {
    if (!container) return;

    const ro = new ResizeObserver(([e]) => {
      const newWidth = e.contentRect.width;
      if (width === newWidth) return;
      //   console.debug("New width", newWidth);
      width = newWidth;
    });
    ro.observe(container);
    return () => ro.disconnect();
  });

  let ebooks = $state<EbookShort[]>([]);
  onMount(async () => {
    try {
      const page = await apiClient.listEbooks({
        page_size: 20,
        sort: ebookSortQuery("latest"),
      });
      ebooks = page.rows;

      // hack to enable next button
      await tick();
      const nextButton = document.querySelector(
        '[data-slot="carousel-next"]',
      ) as HTMLButtonElement;
      if (nextButton && ebooks.length > perView) {
        nextButton.setAttribute("aria-disabled", "false");
      }
    } catch (error) {
      console.error("Loading ebooks", error);
    }
  });

  let cardWidth = 180;
  let perView = $derived(Math.max(1, Math.floor(width / cardWidth)));
  let expectedWidth = $derived(perView * cardWidth);
</script>

<Subtitle>Latest Ebooks</Subtitle>

<div bind:this={container} class="relative px-12 min-w-0">
  <Carousel.Root
    opts={{
      align: "start",
    }}
    setApi={(api) => {
      carouselApi = api;
    }}
    class="w-full min-w-0"
    style="max-width: {expectedWidth}px">
    <Carousel.Content>
      {#each ebooks as ebook (ebook.id)}
        <Carousel.Item class=" " style="flex: 0 0 {100 / perView}%; ">
          <div class="p-1">
            <Card.Root class="p-2">
              <Card.Content
                class="flex flex-col aspect-square items-center p-2">
                <a href="/ebook/{ebook.id}"
                  ><CoverIcon ebookId={ebook.id} size={128} /></a>
                <a
                  href="/ebook/{ebook.id}"
                  class="w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs mt-2">
                  {ebook.title}
                </a>
              </Card.Content>
            </Card.Root>
          </div>
        </Carousel.Item>
      {/each}
    </Carousel.Content>
    <Carousel.Previous />
    <Carousel.Next />
  </Carousel.Root>
</div>
