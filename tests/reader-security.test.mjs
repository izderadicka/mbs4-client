// Run after `pnpm build`: node --test tests/reader-security.test.mjs
// Tests CSP in the built SPA's meta tag, not the dev server's response header.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

let browser, server, origin, policyMeta;
const authenticatedRequests = [];
const root = resolve(".");
before(async () => {
  const html = await readFile("build/index.html", "utf8");
  policyMeta = html.match(
    /<meta http-equiv="content-security-policy"[^>]*>/i,
  )?.[0];
  assert.ok(policyMeta, "production fallback must contain CSP");
  assert.match(policyMeta, /script-src[^;]*sha256-/);
  assert.doesNotMatch(policyMeta, /'unsafe-inline'|'unsafe-eval'|blob:/);
  server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    // Match the backend's default CSP, without relying on it to block scripts.
    res.setHeader(
      "Content-Security-Policy",
      "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    if (url.pathname.endsWith("/auth/providers")) {
      res.setHeader("Content-Type", "application/json");
      res.end("[]");
      return;
    }
    if (url.pathname === "/probe") {
      authenticatedRequests.push(req.headers.cookie);
      res.end("synthetic authenticated response");
      return;
    }
    if (url.pathname === "/harness") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<!doctype html><html><head>${url.searchParams.has("protected") ? policyMeta : ""}</head><body></body></html>`,
      );
      return;
    }
    const base = url.pathname.startsWith("/foliate/")
      ? "node_modules/foliate-js"
      : "build";
    const name = url.pathname.startsWith("/foliate/")
      ? url.pathname.slice(9)
      : url.pathname === "/"
        ? "index.html"
        : url.pathname.slice(1);
    const path = resolve(root, base, name);
    if (!path.startsWith(resolve(root, base) + "/")) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = await readFile(path);
      res.setHeader(
        "Content-Type",
        {
          ".js": "text/javascript",
          ".mjs": "text/javascript",
          ".html": "text/html",
          ".css": "text/css",
          ".svg": "image/svg+xml",
        }[extname(path)] ?? "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
});

test(
  "production SPA bootstraps with its generated script hash",
  { timeout: 15000 },
  async () => {
    const page = await browser.newPage();
    const violations = [];
    page.on("console", (msg) => {
      if (
        /Executing inline script violates|Loading the script.*violates/.test(
          msg.text(),
        )
      )
        violations.push(msg.text());
    });
    await page.goto(origin);
    await page
      .getByRole("button", { name: /log in|sign in|login/i })
      .first()
      .waitFor();
    assert.deepEqual(violations, []);
    await page.close();
  },
);

for (const layout of ["reflowable", "pre-paginated"]) {
  for (const protectedBook of [false, true]) {
    test(
      `${layout}: ${protectedBook ? "blocks scripts while preserving reading" : "vulnerable control executes the same payloads"}`,
      { timeout: 15000 },
      async () => {
        const context = await browser.newContext();
        await context.addCookies([
          {
            name: "security-test",
            value: "synthetic",
            url: origin,
            httpOnly: true,
          },
        ]);
        const page = await context.newPage();
        await page.goto(
          `${origin}/harness${protectedBook ? "?protected" : ""}`,
        );
        const start = authenticatedRequests.length;
        const result = await page.evaluate(
          async ({ layout, origin }) => {
            await import("/foliate/view.js");
            const payload = (kind) =>
              `parent.document.documentElement.dataset.${kind} = 'yes'; fetch('${origin}/probe', {credentials:'include'});`;
            const files = {
              mimetype: "application/epub+zip",
              "META-INF/container.xml":
                '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
              "book.opf": `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">security-test</dc:identifier><dc:title>Security test</dc:title><dc:language>en</dc:language><meta property="rendition:layout">${layout}</meta><meta property="rendition:spread">none</meta></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml" properties="scripted"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/><item id="js" href="payload.js" media-type="text/javascript"/><item id="css" href="book.css" media-type="text/css"/><item id="img" href="image.svg" media-type="image/svg+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`,
              "one.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter one</title><meta name="viewport" content="width=600,height=800"/><link rel="stylesheet" href="book.css"/><script>${payload("inlineRan")}</script><script src="payload.js"></script></head><body><p id="text">Readable chapter one.</p><img src="image.svg" onload="${payload("eventRan")}"/><a id="script-link" href="javascript:${payload("urlRan")}">Script link</a></body></html>`,
              "two.xhtml":
                '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter two</title><meta name="viewport" content="width=600,height=800"/></head><body><p>Readable chapter two.</p></body></html>',
              "payload.js": payload("externalRan"),
              "book.css": "#text { color: rgb(12, 34, 56); }",
              "image.svg":
                '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>',
            };
            // Minimal uncompressed ZIP fixture; use the real Foliate ZIP/EPUB loader.
            const parts = [],
              directory = [];
            let offset = 0;
            const header = (size, values) => {
              const bytes = new Uint8Array(size),
                view = new DataView(bytes.buffer);
              for (const [at, value, width] of values) {
                if (width === 2) view.setUint16(at, value, true);
                else view.setUint32(at, value, true);
              }
              return bytes;
            };
            for (const [name, data] of Object.entries(files)) {
              const filename = new TextEncoder().encode(name),
                body = new TextEncoder().encode(data);
              let crc = 0xffffffff;
              for (const byte of body) {
                crc ^= byte;
                for (let bit = 0; bit < 8; bit++)
                  crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
              }
              crc = (crc ^ 0xffffffff) >>> 0;
              parts.push(
                header(30, [
                  [0, 0x04034b50],
                  [4, 20, 2],
                  [14, crc],
                  [18, body.length],
                  [22, body.length],
                  [26, filename.length, 2],
                ]),
                filename,
                body,
              );
              directory.push(
                header(46, [
                  [0, 0x02014b50],
                  [4, 20, 2],
                  [6, 20, 2],
                  [16, crc],
                  [20, body.length],
                  [24, body.length],
                  [28, filename.length, 2],
                  [42, offset],
                ]),
                filename,
              );
              offset += 30 + filename.length + body.length;
            }
            const count = Object.keys(files).length;
            const zip = new Blob([
              ...parts,
              ...directory,
              header(22, [
                [0, 0x06054b50],
                [8, count, 2],
                [10, count, 2],
                [12, directory.reduce((sum, part) => sum + part.length, 0)],
                [16, offset],
              ]),
            ]);
            const view = document.createElement("foliate-view");
            view.style.cssText = "display:block;width:600px;height:800px";
            document.body.append(view);
            await view.open(
              new File([zip], "test.epub", { type: "application/epub+zip" }),
            );
            await view.init({ showTextStart: true });
            const doc = view.renderer.getContents()[0].doc;
            const img = doc.querySelector("img");
            await img.decode();
            const text = doc.querySelector("#text");
            const readable = text.textContent;
            const color = doc.defaultView.getComputedStyle(text).color;
            const imageWidth = img.naturalWidth;
            const externalSrc = doc.querySelector("script[src]").src;
            let listenerWorks = false;
            text.addEventListener("click", () => {
              listenerWorks = true;
            });
            text.click();
            // Exercise a javascript: URL without Foliate's normal link interception.
            doc.defaultView.location.href = doc
              .querySelector("#script-link")
              .getAttribute("href");
            await new Promise((resolve) => setTimeout(resolve, 250));
            const markers = { ...document.documentElement.dataset };
            await view.goTo(1);
            const nextText = view.renderer
              .getContents()
              .map(({ doc }) => doc.body.textContent)
              .join(" ");
            view.close();
            view.remove();
            return {
              readable,
              color,
              imageWidth,
              externalSrc,
              listenerWorks,
              markers,
              nextText,
            };
          },
          { layout, origin },
        );
        assert.equal(result.readable, "Readable chapter one.");
        assert.equal(result.color, "rgb(12, 34, 56)");
        assert.equal(result.imageWidth, 20);
        assert.equal(result.listenerWorks, true);
        assert.match(
          result.externalSrc,
          /^blob:/,
          "external payload must exercise a book-generated script blob",
        );
        assert.match(result.nextText, /Readable chapter two/);
        if (protectedBook) {
          assert.deepEqual(result.markers, {});
          assert.equal(authenticatedRequests.length, start);
        } else {
          for (const key of ["inlineRan", "externalRan", "eventRan", "urlRan"])
            assert.equal(result.markers[key], "yes", key);
          assert.ok(
            authenticatedRequests
              .slice(start)
              .some((cookie) => cookie?.includes("security-test=synthetic")),
          );
        }
        await context.close();
      },
    );
  }
}
