<script lang="ts">
  import { goto } from "$app/navigation";
  import { apiClient } from "$lib/api/client";
  import LoginForm from "$lib/components/login-form.svelte";
  import { LOGIN_MESSAGE } from "$lib/config";
  import { appUser } from "$lib/globals.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  breadcrumb.path = [{ name: "Login", path: "/login" }];
  console.log("login");
  appUser.user = null;
  localStorage.removeItem("user");

  async function login(event: Event) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const email: string = formData.get("email")?.toString()!;
    const password = formData.get("password")?.toString()!;

    try {
      const user = await apiClient.login(email, password);
      console.log(
        `User logged in with email ${email} and got claim ${JSON.stringify(user)}`,
      );

      appUser.user = user;
      appUser.failedLogin = false;
      localStorage.setItem("user", JSON.stringify(user));
      goto("/");
    } catch (e) {
      console.error(e);
      appUser.failedLogin = true;
    }
  }

  function redirectToSSO(provider: string) {
    apiClient.redirectToSSO(provider);
  }
</script>

<div class="flex h-screen w-full items-center justify-center px-4">
  <form action="#" onsubmit={login} class="w-full max-w-sm">
    <LoginForm
      failed={appUser.failedLogin}
      ssoAction={redirectToSSO}
      message={LOGIN_MESSAGE}
    />
  </form>
</div>
