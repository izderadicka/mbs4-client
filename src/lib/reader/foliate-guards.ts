// Runtime guards for races in foliate-js that the app cannot avoid from the
// outside. foliate-js is a git dependency, so it is guarded here rather than
// patched in place.
//
// Paginator race: the paginator re-renders its current view from a
// ResizeObserver (which also fires once right after observe()). The view of a
// section is created before its iframe has loaded, so a resize in that window
// lays out a document without a <body> and throws ("Cannot destructure
// property 'style' of 'el' as it is null") from the observer callback. The
// render is pointless anyway: the view renders itself once its document has
// loaded. So skip renders until the document has a body.

export interface ContentsSource {
  getContents(): { doc?: Document | null }[];
}

// false while the current section's document is still loading
export function sectionDocumentReady(source: ContentsSource): boolean {
  const contents = source.getContents();
  // no view yet - foliate's own render() returns early
  if (contents.length === 0) return true;
  return contents.every(({ doc }) => !!doc?.body);
}

export function guardRender<T extends ContentsSource>(
  render: (this: T) => void,
): (this: T) => void {
  return function (this: T) {
    if (!sectionDocumentReady(this)) return;
    render.call(this);
  };
}

const GUARDED = Symbol.for("mbs4.foliate.renderGuarded");

type GuardablePrototype = ContentsSource & {
  render(): void;
  [GUARDED]?: boolean;
};

// Installs the guards on foliate's Paginator class (idempotent). Pass the
// class registered as "foliate-paginator" rather than importing
// foliate-js/paginator.js: a second copy of that module would try to
// register the element again. Without a paginator (e.g. a fixed-layout
// book) there is nothing to guard.
export function installPaginatorGuards(
  paginator: { prototype: object } | undefined,
): void {
  if (!paginator) return;
  const proto = paginator.prototype as GuardablePrototype;
  if (proto[GUARDED] || typeof proto.render !== "function") return;
  proto.render = guardRender(proto.render);
  proto[GUARDED] = true;
}
