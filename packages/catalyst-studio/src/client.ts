/**
 * The Studio's only way to catalyst (studio-SHELL-000001): the HTTP API of
 * `catalyst serve --local`, with the run's token as a bearer. Nothing here
 * writes; nothing reads a file.
 */

export interface Connection {
  /** The server's origin, e.g. `http://127.0.0.1:52011`. */
  url: string;
  token: string;
}

/** `GET /v1/check`: `catalyst check --json`. */
export interface CheckReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** `GET /v1/inbox`: what waits for a person, counted by kind. */
export interface InboxReport {
  items: unknown[];
  counts: Record<string, number>;
}

/** One entity type as the module declares it (`graph.types[prefix]`). */
export interface EntityType {
  name: string;
  plural_name: string;
  fields: { name: string; kind: string; required: boolean; target_type: string | null }[];
  states: string[];
  initial: string | null;
  closed_states: string[];
  transitions?: { from: string; to: string }[];
  guards?: Record<string, { condition: string; argument: string }[]>;
  sections?: string[];
}

/** One artifact in `graph`: its fields by name, as written, besides these. */
export interface GraphArtifact {
  id: string;
  type: string;
  title?: string;
  file: string;
  row?: boolean;
  links: Record<string, string[]>;
  [field: string]: unknown;
}

/** `GET /v1/graph`: the chain, and the module's types. */
export interface Graph {
  types: Record<string, EntityType>;
  artifacts: GraphArtifact[];
}

/** `GET /v1/view/<id>`: one artifact, with what an entity page shows (catalyst >= 0.73.0). */
export interface EntityView {
  id: string;
  type: string;
  title?: string;
  file: string;
  links: Record<string, string[]>;
  linked_from: { id: string; field: string }[];
  journal: {
    timestamp: string | null;
    actor: string | null;
    action: string | null;
    intent: string | string[] | null;
  }[];
  sections?: { heading: string; text: string }[];
  next?: { state: string; blocked_by: string[] }[];
  [field: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

/**
 * Where the page finds its connection: a host that mounts the bundle hands
 * it over (`window.catalystStudio`); under `catalyst serve --static` it is
 * the page's own origin and the `#token=…` fragment. The fragment is then
 * cleared from the address bar, so a copied URL carries no token.
 */
export function connectionFromPage(win: Window = window): Connection | null {
  const handed = (win as Window & { catalystStudio?: Partial<Connection> }).catalystStudio;
  if (handed?.url && handed.token) return { url: handed.url, token: handed.token };
  const token = new URLSearchParams(win.location.hash.slice(1)).get("token");
  if (!token) return null;
  win.history.replaceState(null, "", win.location.pathname + win.location.search);
  return { url: win.location.origin, token };
}

export class StudioClient {
  constructor(
    private readonly connection: Connection,
    private readonly fetcher: Fetch = (...args) => fetch(...args),
  ) {}

  async get<T>(route: string): Promise<T> {
    const response = await this.fetcher(`${this.connection.url}/v1/${route}`, {
      headers: { Authorization: `Bearer ${this.connection.token}` },
    });
    if (!response.ok)
      throw new ApiError(response.status, `${route}: ${String(response.status)} ${response.statusText}`);
    return (await response.json()) as T;
  }

  check(): Promise<CheckReport> {
    return this.get<CheckReport>("check");
  }

  inbox(): Promise<InboxReport> {
    return this.get<InboxReport>("inbox");
  }

  graph(): Promise<Graph> {
    return this.get<Graph>("graph");
  }

  view(id: string): Promise<EntityView> {
    return this.get<EntityView>(`view/${encodeURIComponent(id)}`);
  }

  /**
   * Follows `/v1/events` (server-sent events: `event: batch`, `data: <n>`)
   * and calls `onBatch` with each batch. Read through `fetch`, since an
   * `EventSource` cannot send the bearer. Resolves when the stream ends or
   * `signal` aborts.
   */
  async events(onBatch: (batch: number) => void, signal?: AbortSignal): Promise<void> {
    const response = await this.fetcher(`${this.connection.url}/v1/events`, {
      headers: { Authorization: `Bearer ${this.connection.token}`, Accept: "text/event-stream" },
      signal,
    });
    if (!response.ok || !response.body) throw new ApiError(response.status, `events: ${String(response.status)}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf("\n\n");
      while (end >= 0) {
        const batch = parseBatch(buffer.slice(0, end));
        if (batch !== null) onBatch(batch);
        buffer = buffer.slice(end + 2);
        end = buffer.indexOf("\n\n");
      }
    }
  }
}

/** The batch number of one server-sent event, or null when it is not a batch. */
export function parseBatch(event: string): number | null {
  const lines = event.split("\n");
  if (!lines.includes("event: batch")) return null;
  const data = lines.find((l) => l.startsWith("data: "));
  const n = data ? Number(data.slice(6)) : NaN;
  return Number.isInteger(n) ? n : null;
}
