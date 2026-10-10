import type { ReferenceInfo } from "catalyst-core";

/**
 * Entity references as links (`REQ-000014-UVqkd7cL`): every token of
 * `table` in rendered HTML text — inline `<code>` included, `<pre>` blocks
 * and existing links left alone — becomes an `<a class="catalyst-ref">`
 * carrying the full ID to open and a hover with the entity's name and
 * summary. Pure string work, so the same function serves every view and
 * runs in tests without a host.
 */

export const REFERENCE_CLASS = "catalyst-ref";

const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function hoverText(info: ReferenceInfo): string {
  return info.summary ? `${info.name} — ${info.summary}` : info.name;
}

export function referenceAnchor(token: string, info: ReferenceInfo): string {
  return (
    `<a href="#" class="${REFERENCE_CLASS}" data-ref="${escapeAttr(info.id)}" ` +
    `title="${escapeAttr(hoverText(info))}">${token}</a>`
  );
}

export function linkifyReferences(html: string, table: Record<string, ReferenceInfo> | undefined): string {
  const tokens = Object.keys(table ?? {}).sort((a, b) => b.length - a.length);
  if (!table || tokens.length === 0) return html;
  const pattern = new RegExp(`(?<![\\w-])(${tokens.map(escapeRe).join("|")})(?![\\w-])`, "g");
  let skip = 0; // depth inside <pre> or <a>
  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        const tag = /^<\/?\s*([a-zA-Z0-9]+)/.exec(part)?.[1]?.toLowerCase();
        if (tag === "pre" || tag === "a") skip += part.startsWith("</") ? -1 : 1;
        return part;
      }
      if (skip > 0 || !part) return part;
      return part.replace(pattern, (token) => referenceAnchor(token, table[token]));
    })
    .join("");
}

/** The full ID a click inside a rendered view refers to, if it hit a reference link. */
export function referenceTarget(target: EventTarget | null): string | null {
  const el = target instanceof Element ? target.closest(`a.${REFERENCE_CLASS}`) : null;
  return el?.getAttribute("data-ref") ?? null;
}
