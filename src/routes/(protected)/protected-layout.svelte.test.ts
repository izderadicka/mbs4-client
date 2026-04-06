import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-svelte";
import { appUser } from "$lib/globals.svelte";

const goto = vi.fn();

vi.mock("$app/navigation", async () => {
  const actual = await vi.importActual<typeof import("$app/navigation")>(
    "$app/navigation",
  );
  return {
    ...actual,
    goto,
  };
});

const { default: ProtectedLayout } = await import("./+layout.svelte");

describe("(protected)/+layout.svelte", () => {
  beforeEach(() => {
    goto.mockReset();
    appUser.user = null;
    appUser.failedLogin = false;
  });

  it("redirects unauthenticated users to /login on mount", async () => {
    render(ProtectedLayout);

    await vi.waitFor(() => {
      expect(goto).toHaveBeenCalledWith("/login");
    });
  });
});
