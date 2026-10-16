/**
 * The Studio panel's HTML (catalyst roadmap R6.2, studio-SHELL-000001): the
 * page `catalyst serve --local --static` serves, framed whole. The Studio
 * stays on the server's own origin, so the server's `Origin` check holds and
 * no CORS is needed; the panel itself runs no script and frames only that
 * one origin.
 */
export function studioPanelHtml(page: string, nonce: string): string {
  const origin = new URL(page).origin;
  const csp = ["default-src 'none'", `frame-src ${origin}`, `style-src 'nonce-${nonce}'`].join("; ");
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
  </body>
</html>
`;
}
