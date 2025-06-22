<script lang="ts">
  import { goto } from "$app/navigation";
  import LoginForm from "$lib/components/login-form.svelte";
  import { appUser } from "$lib/globals.svelte";
  console.log("login");

  async function login(event: Event) {
    const formData = new FormData(event.target as HTMLFormElement);
    const email: string = formData.get("email")?.toString()!;
    const password = formData.get("password")?.toString()!;

    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`User logged in with email ${email}`);

    const user = {
      email,
      token: "token",
      tokenValidity: Date.now() + 365 * 24 * 60 * 60 * 1000,
    };

    appUser.user = user;
    localStorage.setItem("user", JSON.stringify(user));
    goto("/");
  }
</script>

<div class="flex h-screen w-full items-center justify-center px-4">
  <form action="#" onsubmit={login} class="w-full max-w-sm">
    <LoginForm />
  </form>
</div>
