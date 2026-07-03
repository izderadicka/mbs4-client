import type { PageLoad } from "./$types";

export type BookFileKind = "source" | "conversion";

export const load: PageLoad = ({ url }) => {
  const kind: BookFileKind =
    url.searchParams.get("kind") === "conversion" ? "conversion" : "source";
  return {
    kind,
    path: url.searchParams.get("path") ?? "",
    ext: url.searchParams.get("ext") ?? "",
    title: url.searchParams.get("title") ?? "",
  };
};
