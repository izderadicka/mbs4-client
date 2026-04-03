<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import FailureAlert from "$lib/components/fragments/failure-alert.svelte";

  const id = $props.id();
  const {
    failed,
    ssoAction,
    title = "Login",
    message = "",
    providers = [],
  }: {
    failed: boolean;
    ssoAction: (provider: string) => void;
    title?: string;
    message?: string;
    providers?: string[];
  } = $props();
</script>

{#if failed}
  <FailureAlert title="Login Failed!">
    <p>Please verify your credentials and try again.</p>
  </FailureAlert>
{/if}

<Card.Root class="mx-auto w-full max-w-sm">
  <Card.Header>
    <Card.Title class="text-2xl">{title}</Card.Title>
    <Card.Description>
      {@html message}
    </Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-4">
      <div class="grid gap-2">
        <Label for="email-{id}">Email</Label>
        <Input
          id="email-{id}"
          type="email"
          name="email"
          placeholder="m@example.com"
          autocomplete="username"
          required />
      </div>
      <div class="grid gap-2">
        <div class="flex items-center">
          <Label for="password-{id}">Password</Label>
          <!-- <a href="##" class="ml-auto inline-block text-sm underline">
						Forgot your password?
					</a> -->
        </div>
        <Input
          id="password-{id}"
          type="password"
          name="password"
          autocomplete="current-password" />
      </div>
      <Button type="submit" class="w-full">Login</Button>
      {#if providers.includes("google")}
        <Button
          variant="outline"
          class="w-full"
          onclick={() => ssoAction("google")}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor" />
          </svg>
          Login with Google
        </Button>
      {/if}
      {#if providers.includes("microsoft")}
        <Button
          variant="outline"
          class="w-full"
          onclick={() => ssoAction("microsoft")}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            x="0px"
            y="0px"
            width="50"
            height="50"
            viewBox="0 0 50 50"
            style="fill:#1A1A1A;">
            <path
              d="M 5 4 C 4.448 4 4 4.447 4 5 L 4 24 L 24 24 L 24 4 L 5 4 z M 26 4 L 26 24 L 46 24 L 46 5 C 46 4.447 45.552 4 45 4 L 26 4 z M 4 26 L 4 45 C 4 45.553 4.448 46 5 46 L 24 46 L 24 26 L 4 26 z M 26 26 L 26 46 L 45 46 C 45.552 46 46 45.553 46 45 L 46 26 L 26 26 z"
            ></path>
          </svg>
          Login with Microsoft
        </Button>
      {/if}
      {#if providers.includes("keycloak")}
        <Button
          variant="outline"
          class="w-full"
          onclick={() => ssoAction("keycloak")}>
          <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
            ><title>Keycloak</title><path
              d="m18.742 1.182-12.493.002C4.155 4.784 2.079 8.393 0 12.002c2.071 3.612 4.162 7.214 6.252 10.816l12.49-.004 3.089-5.404h2.158v-.002H24L23.996 6.59h-2.168zM8.327 4.792h2.081l1.04 1.8-3.12 5.413 3.117 5.403-1.035 1.81H8.327a2047.566 2047.566 0 0 0-4.168-7.204C5.547 9.606 6.937 7.2 8.327 4.792Zm6.241 0 2.086.003c1.393 2.405 2.78 4.813 4.166 7.222l-4.167 7.2h-2.08c-.382-.562-1.038-1.808-1.038-1.808l3.123-5.405-3.124-5.413z" /></svg>
          Login with Keycloak
        </Button>
      {/if}
    </div>
    <!-- <div class="mt-4 text-center text-sm">
			Don't have an account?
			<a href="##" class="underline"> Sign up </a>
		</div> -->
  </Card.Content>
</Card.Root>
