import { apiClient } from "$lib/api/client";
import type { User } from "$lib/types/app";
import { TOKEN_VALIDITY_MINUTES_MINIMUM } from "$lib/config";
import { AUTOLOGIN } from "$lib/dev.js";
import type { Role } from "$lib/api";

export const ssr = false;

export async function load({ url, fetch }) {
  apiClient.setFetch(fetch);
  const trToken = url.searchParams.get("trt");
  // Redirected from federated authentication
  if (trToken) {
    try {
      const user = await apiClient.retrieveToken(trToken);

      localStorage.setItem("user", JSON.stringify(user));
      return {
        user,
      };
    } catch (error) {
      return {
        user: null,
        failedLogin: true,
      };
    }
  } else {
    if (AUTOLOGIN) {
      console.log("Auto login for dev");
      return {
        user: {
          roles: ["Admin", "Trusted"] as Role[],
          email: "auto-login@example.com",
          tokenValidity:
            Date.now() + TOKEN_VALIDITY_MINUTES_MINIMUM * 60000 * 1000,
        },
      };
    }
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user: User = JSON.parse(storedUser);
      if (
        user.tokenValidity >
        Date.now() + TOKEN_VALIDITY_MINUTES_MINIMUM * 60 * 1000
      ) {
        return {
          user,
        };
      }
    }

    return {
      user: null,
    };
  }
}
