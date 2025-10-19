<script lang="ts">
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import { breadcrumb } from "$lib/globals";
</script>

<Breadcrumb.Root>
  <Breadcrumb.List>
    <Breadcrumb.Item class="hidden md:block">
      <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
    </Breadcrumb.Item>
    {#if breadcrumb.path.length > 1}
      <Breadcrumb.Separator class="hidden md:block" />
    {/if}
    {#each breadcrumb.path.slice(0, breadcrumb.path.length - 1) as item, i (item.path)}
      <Breadcrumb.Item class="hidden md:block">
        <Breadcrumb.Link href={item.path}>{item.name}</Breadcrumb.Link>
      </Breadcrumb.Item>
      {#if i < breadcrumb.path.length - 2}
        <Breadcrumb.Separator class="hidden md:block" />
      {/if}
    {/each}
    {#if breadcrumb.path.length > 0}
      <Breadcrumb.Separator class="hidden md:block" />
      <Breadcrumb.Item>
        <Breadcrumb.Page
          >{breadcrumb.path[breadcrumb.path.length - 1].name}</Breadcrumb.Page
        >
      </Breadcrumb.Item>
    {/if}
  </Breadcrumb.List>
</Breadcrumb.Root>
