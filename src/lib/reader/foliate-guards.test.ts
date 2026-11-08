import { describe, expect, it, vi } from "vitest";
import {
  guardRender,
  installPaginatorGuards,
  sectionDocumentReady,
} from "./foliate-guards";

const loadedDoc = () =>
  new DOMParser().parseFromString("<p>x</p>", "text/html");

// a section document whose <body> has not been parsed yet
const loadingDoc = () =>
  ({ documentElement: {}, body: null }) as unknown as Document;

const source = (docs: (Document | null)[]) => ({
  getContents: () => docs.map((doc) => ({ doc })),
});

describe("sectionDocumentReady", () => {
  it("is ready when there is no view yet", () => {
    expect(sectionDocumentReady(source([]))).toBe(true);
  });

  it("is ready when the document has a body", () => {
    expect(sectionDocumentReady(source([loadedDoc()]))).toBe(true);
  });

  it("is not ready while the document has no body", () => {
    expect(sectionDocumentReady(source([loadingDoc()]))).toBe(false);
  });

  it("is not ready when the document is gone", () => {
    expect(sectionDocumentReady(source([null]))).toBe(false);
  });
});

describe("guardRender", () => {
  it("skips rendering a document without a body", () => {
    const render = vi.fn();
    guardRender(render).call(source([loadingDoc()]));
    expect(render).not.toHaveBeenCalled();
  });

  it("renders a loaded document", () => {
    const render = vi.fn();
    const target = source([loadedDoc()]);
    guardRender(render).call(target);
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.contexts[0]).toBe(target);
  });
});

describe("installPaginatorGuards", () => {
  it("wraps render once", () => {
    const render = vi.fn();
    class FakePaginator {
      docs: (Document | null)[] = [];
      getContents() {
        return this.docs.map((doc) => ({ doc }));
      }
      render() {
        render();
      }
    }
    installPaginatorGuards(FakePaginator);
    installPaginatorGuards(FakePaginator);

    const p = new FakePaginator();
    p.docs = [loadingDoc()];
    p.render();
    expect(render).not.toHaveBeenCalled();

    p.docs = [loadedDoc()];
    p.render();
    expect(render).toHaveBeenCalledOnce();
  });
});
