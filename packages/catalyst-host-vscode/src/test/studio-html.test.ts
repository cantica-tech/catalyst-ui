import * as assert from "assert";

import { studioPanelHtml } from "../studio-html.js";

/** The relay script, run against stand-ins for the panel's window, frame and VS Code API. */
function relay(html: string) {
  const script = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
  const toHost: unknown[] = [];
  const toFrame: { data: unknown; origin: string }[] = [];
  const frameWindow = {
    postMessage: (data: unknown, origin: string) => {
      toFrame.push({ data, origin });
    },
  };
  let listener: (event: { data: unknown; source: unknown; origin: string }) => void = () => undefined;
  const window = {
    addEventListener: (_type: string, fn: typeof listener) => {
      listener = fn;
    },
  };
  const document = { querySelector: () => ({ contentWindow: frameWindow }) };
  const acquireVsCodeApi = () => ({
    postMessage: (data: unknown) => {
      toHost.push(data);
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function("window", "document", "acquireVsCodeApi", script) as (...args: unknown[]) => void;
  run(window, document, acquireVsCodeApi);
  return {
    send: (event: { data: unknown; source: unknown; origin: string }) => {
      listener(event);
    },
    toHost,
    toFrame,
    frameWindow,
  };
}

describe("studioPanelHtml (studio-SHELL-000001, studio-SHELL-000015)", () => {
  const html = studioPanelHtml("http://127.0.0.1:52011/#token=cst_x", "n0nce");

  it("frames the page the server prints, with a title for assistive technology", () => {
    assert.ok(html.includes('<iframe src="http://127.0.0.1:52011/#token=cst_x" title="catalyst Studio">'));
  });

  it("allows only that origin to be framed, and only its own nonce'd script", () => {
    assert.ok(
      html.includes(
        "default-src 'none'; frame-src http://127.0.0.1:52011; style-src 'nonce-n0nce'; script-src 'nonce-n0nce'",
      ),
    );
    assert.strictEqual(html.match(/<script/g)?.length, 1);
    assert.ok(html.includes('<script nonce="n0nce">'));
  });

  it("passes the Studio's messages to the extension only from its frame and origin", () => {
    const r = relay(html);
    const ask = { catalyst: "studio", type: "run", command: "help" };
    r.send({ data: ask, source: r.frameWindow, origin: "http://127.0.0.1:52011" });
    r.send({ data: ask, source: r.frameWindow, origin: "http://evil.example" });
    r.send({ data: ask, source: {}, origin: "http://127.0.0.1:52011" });
    r.send({ data: { type: "run", command: "help" }, source: r.frameWindow, origin: "http://127.0.0.1:52011" });
    assert.deepStrictEqual(r.toHost, [ask]);
  });

  it("passes the extension's messages to the frame, on the server's origin only", () => {
    const r = relay(html);
    const event = { catalyst: "host", type: "run-event", id: "1" };
    r.send({ data: event, source: null, origin: "vscode-webview://x" });
    r.send({ data: event, source: r.frameWindow, origin: "http://127.0.0.1:52011" }); // the frame cannot echo as the host
    assert.deepStrictEqual(r.toFrame, [{ data: event, origin: "http://127.0.0.1:52011" }]);
  });

  it("escapes the URL it frames", () => {
    assert.ok(studioPanelHtml('http://127.0.0.1:1/#a"b&c', "n").includes('src="http://127.0.0.1:1/#a&quot;b&amp;c"'));
  });
});
