/**
 * The Studio panel's HTML (catalyst roadmap R6.2, studio-SHELL-000001): the
 * page `catalyst serve --local --static` serves, framed whole. The Studio
 * stays on the server's own origin, so the server's `Origin` check holds and
 * no CORS is needed; the panel frames only that one origin.
 *
 * Its one script relays messages between the framed Studio and the
 * extension (studio-SHELL-000015, the agent console): a Studio message is
 * passed on only when it comes from the frame, on the server's origin, and
 * says it is the Studio's; a host message goes to the frame, on that origin
 * only.
 */
export function studioPanelHtml(page: string, nonce: string): string {
  const origin = new URL(page).origin;
  const csp = [
    "default-src 'none'",
    `frame-src ${origin}`,
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
  const escaped = page.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>catalyst Studio</title>
    <style nonce="${nonce}">
      html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
      iframe { border: 0; width: 100%; height: 100%; display: block; }
    </style>
  </head>
  <body>
    <iframe src="${escaped}" title="catalyst Studio"></iframe>
    <script nonce="${nonce}">
      (() => {
        const host = acquireVsCodeApi();
        const frame = document.querySelector("iframe");
        const origin = ${JSON.stringify(origin)};
        window.addEventListener("message", (event) => {
          const data = event.data;
          if (!data || typeof data !== "object") return;
          if (data.catalyst === "studio" && event.source === frame.contentWindow && event.origin === origin) {
            host.postMessage(data);
          } else if (data.catalyst === "host" && event.source !== frame.contentWindow) {
            frame.contentWindow.postMessage(data, origin);
          }
        });
      })();
    </script>
  </body>
</html>
`;
}
