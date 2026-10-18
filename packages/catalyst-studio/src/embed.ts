/**
 * Embeds (owner decision B8): `<catalyst-entity>`, a web component another
 * site's page uses to show one entity of a criterion — its title, status and
 * what cites it — read from `catalyst serve` with the reader's token. The
 * server answers it only for an origin it allows (`--allow-origin`,
 * `embed_origins`); it only reads. No framework: a page loads `embed.js`
 * and writes the element.
 *
 *   <script src="embed.js"></script>
 *   <catalyst-entity server="https://catalyst.example.com/v1" token="cst_…"
 *                    entity="REQ-000001-Ab3xR9pQ"></catalyst-entity>
 */

/** What the element shows of `GET <server>/view/<entity>`. */
export interface EmbeddedView {
  id: string;
  type: string;
  title?: string;
  status?: string;
  linked_from?: { id: string; field: string }[];
  [field: string]: unknown;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^`|`$/g, "") : "";
}

/** The status an entity shows: its Status field, else a rule's status line. */
export function statusOf(view: EmbeddedView): string {
  return text(view.Status) || text(view.status);
}

/** The element's markup for a view, every value escaped (it is text, never HTML). */
export function render(view: EmbeddedView): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  const cited = view.linked_from ?? [];
  const status = statusOf(view);
  return (
    `<article part="card"><p part="id"><code>${esc(view.id)}</code> <span part="type">${esc(view.type)}</span></p>` +
    `<p part="title"><strong>${esc(text(view.title) || view.id)}</strong></p>` +
    (status ? `<p part="status">${esc(status)}</p>` : "") +
    `<p part="cited">${cited.length === 0 ? "Nothing cites it." : `Cited by ${String(cited.length)}: ${cited.map((c) => `<code>${esc(c.id)}</code>`).join(", ")}`}</p></article>`
  );
}

/** Fetches one entity's view with the reader's token. */
export async function fetchView(
  server: string,
  token: string,
  entity: string,
  fetcher: typeof fetch = fetch,
): Promise<EmbeddedView> {
  const res = await fetcher(`${server.replace(/\/$/, "")}/view/${encodeURIComponent(entity)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`catalyst answered ${String(res.status)}`);
  return (await res.json()) as EmbeddedView;
}

const STYLE =
  ":host{display:block;font:14px/1.4 system-ui,sans-serif;border:1px solid #ccc;border-radius:6px;padding:.6em .9em;max-width:32em}" +
  "p{margin:.2em 0}code{font-family:ui-monospace,monospace}[part=type],[part=cited]{color:#555}";

/** `<catalyst-entity server token entity>`: renders on connect and when an attribute changes. */
export function defineElement(registry: CustomElementRegistry = customElements): void {
  if (registry.get("catalyst-entity")) return;
  class CatalystEntity extends HTMLElement {
    static get observedAttributes(): string[] {
      return ["server", "token", "entity"];
    }

    connectedCallback(): void {
      void this.update();
    }

    attributeChangedCallback(): void {
      if (this.isConnected) void this.update();
    }

    private async update(): Promise<void> {
      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      const server = this.getAttribute("server") ?? "";
      const token = this.getAttribute("token") ?? "";
      const entity = this.getAttribute("entity") ?? "";
      if (!server || !token || !entity) {
        root.innerHTML = `<style>${STYLE}</style><p role="status">catalyst-entity needs server, token and entity.</p>`;
        return;
      }
      root.innerHTML = `<style>${STYLE}</style><p role="status">Loading ${entity.replace(/[<>&]/g, "")}…</p>`;
      try {
        root.innerHTML = `<style>${STYLE}</style>${render(await fetchView(server, token, entity))}`;
      } catch (err) {
        const why = String(err).replace(/[<>&]/g, "");
        root.innerHTML = `<style>${STYLE}</style><p role="status">catalyst did not answer (${why}).</p>`;
      }
    }
  }
  registry.define("catalyst-entity", CatalystEntity);
}

if (typeof customElements !== "undefined") defineElement();
