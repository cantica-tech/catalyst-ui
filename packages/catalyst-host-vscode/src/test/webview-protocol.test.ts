import * as assert from "assert";

import { panelKeysFor, parseDirectoryMessage, parseWebviewMessage, webviewCsp } from "../webview-protocol.js";

describe("webview protocol (B-02, B-10, B-11)", () => {
  it("accepts only a well-formed openReference message", () => {
    assert.deepStrictEqual(parseWebviewMessage({ type: "openReference", id: "REQ-000014-UVqkd7cL" }), {
      type: "openReference",
      id: "REQ-000014-UVqkd7cL",
    });
    for (const bad of [
      null,
      "openReference",
      { type: "openReference" },
      { type: "openReference", id: 5 },
      { type: "openReference", id: "x".repeat(201) },
      { type: "openReference", id: "REQ-1\n; rm" },
      { type: "runCommand", id: "REQ-000001" },
    ]) {
      assert.strictEqual(parseWebviewMessage(bad), null, JSON.stringify(bad));
    }
  });

  it("accepts only a well-formed openDirectory message (vscode-IAM-000003)", () => {
    assert.deepStrictEqual(parseDirectoryMessage({ type: "openDirectory", kind: "group", name: "/cantica-tech/a b" }), {
      type: "openDirectory",
      kind: "group",
      name: "/cantica-tech/a b",
    });
    for (const bad of [
      null,
      { type: "openDirectory", kind: "user" },
      { type: "openDirectory", kind: "admin", name: "alice" },
      { type: "openDirectory", kind: "user", name: "" },
      { type: "openDirectory", kind: "user", name: "x".repeat(257) },
      { type: "openDirectory", kind: "user", name: "alice\n; rm" },
      { type: "openReference", kind: "user", name: "alice" },
    ]) {
      assert.strictEqual(parseDirectoryMessage(bad), null, JSON.stringify(bad));
    }
  });

  it("finds the open panels of one deployment to refresh", () => {
    const open = new Map([
      ["node:/a/.criterion:REQ-1", "/a/.criterion"],
      ["journal:/a/.criterion", "/a/.criterion"],
      ["node:/b/.criterion:REQ-1", "/b/.criterion"],
      // A Windows path holds a ':' — the owner is stored, never re-parsed from the key.
      ["node:C:\\p\\.criterion:REQ-2", "C:\\p\\.criterion"],
    ]);
    assert.deepStrictEqual(panelKeysFor(open, "/a/.criterion"), ["node:/a/.criterion:REQ-1", "journal:/a/.criterion"]);
    assert.deepStrictEqual(panelKeysFor(open, "C:\\p\\.criterion"), ["node:C:\\p\\.criterion:REQ-2"]);
  });

  it("builds a restrictive CSP", () => {
    const csp = webviewCsp("abc", "https://file+.vscode-resource.vscode-cdn.net");
    assert.ok(csp.includes("default-src 'none'"));
    assert.ok(csp.includes("script-src 'nonce-abc'"));
    assert.ok(csp.includes("base-uri 'none'"));
    assert.ok(csp.includes("form-action 'none'"));
    assert.ok(!csp.includes("unsafe-eval"));
    assert.ok(!csp.includes("unsafe-inline"));
  });
});
