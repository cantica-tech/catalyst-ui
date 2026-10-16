import type { WebviewPayload } from "catalyst-core";
import { randomBytes } from "node:crypto";
import type * as vscode from "vscode";
import { webviewCsp } from "../webview-protocol.js";

/**
 * Theme-aware styling for a node's rendered markdown (`marked` output in
 * `NodeDetail`'s `DetailsSection`) plus the surrounding webview chrome.
 * Uses only VS Code's own `--vscode-*` custom properties (injected into
 * every webview automatically, no extra wiring) rather than hardcoded
 * colors, so headings/tables/code blocks/links look native in both
 * light and dark themes instead of the browser's bare unstyled default
 * (plain white background, borderless tables, no code-block styling) —
 * without this, formatted HTML still *reads* like unformatted markup.
 */
export const WEBVIEW_STYLES = `
body {
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-editor-background);
  padding: 16px 20px;
  line-height: 1.5;
}
h1, h2, h3, h4 { font-weight: 600; margin: 20px 0 8px; }
h1 { font-size: 1.5em; margin-top: 0; }
h2 {
  font-size: 1.2em;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--vscode-panel-border, #808080);
}
h3 { font-size: 1.05em; }
p { margin: 0 0 8px; }
ul, ol { margin: 0 0 8px; padding-left: 1.4em; }
li { margin-bottom: 4px; }
code {
  font-family: var(--vscode-editor-font-family, monospace);
  background-color: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.2));
  padding: 1px 4px;
  border-radius: 3px;
}
pre {
  background-color: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.2));
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}
pre code { background: none; padding: 0; }
table { border-collapse: collapse; margin: 0 0 12px; width: 100%; }
th, td {
  border: 1px solid var(--vscode-panel-border, #808080);
  padding: 4px 10px;
  text-align: left;
  vertical-align: top;
}
th { background-color: var(--vscode-list-hoverBackground, rgba(127, 127, 127, 0.1)); }
a { color: var(--vscode-textLink-foreground); }
a:hover { color: var(--vscode-textLink-activeForeground); }
blockquote {
  margin: 0 0 8px;
  padding-left: 12px;
  border-left: 3px solid var(--vscode-panel-border, #808080);
  color: var(--vscode-descriptionForeground);
}
`;

export function renderWebviewHtml(scriptUri: vscode.Uri, payload: WebviewPayload, cspSource: string): string {
  const nonce = randomBytes(16).toString("hex");
  // A node's raw markdown content (full file text, since the description
  // feature) can legitimately contain the literal substring `</script>`
  // (a code sample, an HTML example) — unescaped, that would close this
  // script block early and corrupt the page. `<` isn't a JS/JSON
  // escape a parser treats specially, so this is invisible to both.
  const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${webviewCsp(nonce, cspSource)}" />
<style nonce="${nonce}">${WEBVIEW_STYLES}</style>
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}">window.__CATALYST_INITIAL_PAYLOAD__ = ${payloadJson};</script>
<script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;
}
