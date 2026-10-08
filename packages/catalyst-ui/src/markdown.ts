import { Marked, type Tokens } from "marked";

/**
 * The one Markdown renderer every view uses. Corpus text is data, not
 * markup the UI trusts: a cloned repository controls it, and the rendered
 * HTML lands in a webview (VS Code) or renderer (Electron) that can talk
 * to the agent-dispatch bridge. So, without adding a sanitiser dependency:
 *
 * - raw HTML (block or inline) is escaped and shown as text, never emitted;
 * - link targets keep only `http`, `https`, `mailto`, and scheme-less
 *   (relative / `#anchor`) URLs; anything else (`javascript:`, `data:`,
 *   `vbscript:`, `file:`, `command:`, ...) renders as plain text;
 * - image sources follow the same rule.
 *
 * Everything else is marked's own fixed element set (headings, lists,
 * tables, code, emphasis), whose text it already escapes. The hosts add a
 * Content-Security-Policy on top of this as a second layer.
 */

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ALLOWED_SCHEMES = new Set(["http", "https", "mailto"]);

/** The URL if it is safe to put in an `href`/`src`, else `null`. */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  // Browsers ignore ASCII whitespace and control characters inside a
  // scheme ("java\tscript:"), so judge the scheme with them removed.
  // eslint-disable-next-line no-control-regex
  const probe = url.replace(/[\u0000- \u007f]/g, "");
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(probe)?.[1];
  if (scheme === undefined) {
    // No scheme: relative path, query or fragment. "//host" is a
    // protocol-relative absolute URL — allowed only as http(s) would be.
    return url;
  }
  return ALLOWED_SCHEMES.has(scheme.toLowerCase()) ? url : null;
}

const md = new Marked({
  gfm: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      return escapeHtml(text);
    },
    link(token: Tokens.Link): string {
      const inner = this.parser.parseInline(token.tokens);
      const href = safeUrl(token.href);
      if (href === null) return inner;
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      return `<a href="${escapeHtml(href)}"${title}>${inner}</a>`;
    },
    image(token: Tokens.Image): string {
      const src = safeUrl(token.href);
      if (src === null) return escapeHtml(token.text);
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(token.text)}"${title}>`;
    },
  },
});

/** Markdown to HTML with raw HTML escaped and unsafe URLs dropped. */
export function renderMarkdown(markdown: string): string {
  return md.parse(markdown, { async: false }) as string;
}
