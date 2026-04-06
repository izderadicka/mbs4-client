import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();

vi.mock("svelte-sonner", () => ({
  toast: {
    error: toastError,
  },
}));

vi.mock("$lib/api/client", () => ({
  apiClient: {
    searchEbook: vi.fn(),
  },
}));

vi.mock("$lib/components/ui/popover", async () => {
  const Root = (await import("../test-stubs/bindable-wrapper.svelte")).default;
  const Content = (await import("../test-stubs/children-wrapper.svelte")).default;
  const Trigger = (await import("../test-stubs/empty.svelte")).default;

  return {
    Root,
    Content,
    Trigger,
  };
});

vi.mock("$lib/components/ui/scroll-area", async () => {
  const Root = (await import("../test-stubs/children-wrapper.svelte")).default;
  const Scrollbar = (await import("../test-stubs/empty.svelte")).default;

  return {
    ScrollArea: Root,
    Scrollbar,
  };
});

vi.mock("@lucide/svelte/icons/loader-circle", async () => ({
  default: (await import("../test-stubs/empty.svelte")).default,
}));

const { default: SearchAutocomplete } = await import("./search-autocomplete.svelte");

function ebookResult(id: number, title: string) {
  return {
    doc: {
      Ebook: {
        id,
        title,
        authors: [{ id: 100 + id, name: `Author ${id}` }],
        series: null,
        series_id: null,
        series_index: null,
      },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("search-autocomplete.svelte", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toastError.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces input and only runs the latest search", async () => {
    const load = vi.fn().mockResolvedValue([ebookResult(1, "Dune")]);

    render(SearchAutocomplete, {
      load,
      debounceMs: 200,
      minChars: 2,
    });

    const input = screen.getByPlaceholderText("Search books…");
    await fireEvent.input(input, { target: { value: "du" } });
    await fireEvent.input(input, { target: { value: "dun" } });

    await vi.advanceTimersByTimeAsync(199);
    expect(load).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledWith("dun", expect.any(AbortSignal));
    });
    expect(await screen.findByRole("option", { name: /Dune/ })).toBeTruthy();
  });

  it("selects the highlighted result with keyboard navigation", async () => {
    const load = vi.fn().mockResolvedValue([
      ebookResult(1, "Dune"),
      ebookResult(2, "Dune Messiah"),
    ]);
    const onSelect = vi.fn();

    render(SearchAutocomplete, {
      load,
      onSelect,
      debounceMs: 0,
      minChars: 2,
    });

    const input = screen.getByPlaceholderText("Search books…");
    await fireEvent.input(input, { target: { value: "du" } });
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("submits the typed query when enter is pressed without a highlighted result", async () => {
    const load = vi.fn().mockResolvedValue([]);
    const onSearch = vi.fn();

    render(SearchAutocomplete, {
      load,
      onSearch,
      debounceMs: 0,
      minChars: 2,
    });

    const input = screen.getByPlaceholderText("Search books…");
    await fireEvent.input(input, { target: { value: "ursula" } });
    await vi.advanceTimersByTimeAsync(0);
    await screen.findByText("No matches");

    await fireEvent.keyDown(input, { key: "Enter" });

    expect(onSearch).toHaveBeenCalledWith("ursula");
  });

  it("ignores stale results from an older request and keeps the newest results", async () => {
    const first = deferred<ReturnType<typeof ebookResult>[]>();
    const second = deferred<ReturnType<typeof ebookResult>[]>();
    const load = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    render(SearchAutocomplete, {
      load,
      debounceMs: 0,
      minChars: 2,
    });

    const input = screen.getByPlaceholderText("Search books…");
    await fireEvent.input(input, { target: { value: "du" } });
    await vi.advanceTimersByTimeAsync(0);

    await fireEvent.input(input, { target: { value: "dune" } });
    await vi.advanceTimersByTimeAsync(0);

    second.resolve([ebookResult(2, "Dune Messiah")]);
    await screen.findByRole("option", { name: /Dune Messiah/ });

    first.resolve([ebookResult(1, "Dune")]);
    await vi.runAllTimersAsync();

    expect(screen.queryByRole("option", { name: /Dune$/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Dune Messiah/ })).toBeTruthy();
  });

  it("shows a toast when search fails", async () => {
    const load = vi.fn().mockRejectedValue(new Error("boom"));

    render(SearchAutocomplete, {
      load,
      debounceMs: 0,
      minChars: 2,
    });

    const input = screen.getByPlaceholderText("Search books…");
    await fireEvent.input(input, { target: { value: "du" } });
    await vi.advanceTimersByTimeAsync(0);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to search ebooks");
    });
    expect(screen.queryByRole("option")).toBeNull();
  });
});
