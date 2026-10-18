import { useEffect, useState } from "react";

import type { InboxItem, StudioClient } from "./client.js";

/** One inbox item's key: its kind and what it is about, stable while it waits. */
export function itemKey(item: InboxItem): string {
  return `${item.kind}:${item.id}`;
}

/** The items this viewer has not seen yet (R6.26). */
export function unread(items: InboxItem[], seen: Set<string>): InboxItem[] {
  return items.filter((i) => !seen.has(itemKey(i)));
}

/**
 * What this viewer has seen of the inbox, kept in this browser only: a
 * convenience, never shared state (another viewer, device or a private
 * window starts with nothing seen, which only shows more as new).
 */
export const seenStore = {
  key: (project: string) => `catalyst-studio:seen:${project}`,
  read(project: string): Set<string> {
    try {
      const raw = window.localStorage.getItem(this.key(project));
      const list: unknown = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  },
  write(project: string, keys: Iterable<string>): void {
    try {
      window.localStorage.setItem(this.key(project), JSON.stringify([...keys]));
    } catch {
      // storage refused (a private window): nothing is remembered, and that is all
    }
  },
};

/** The project the Studio shows, by name (`GET /v1/head`, catalyst >= 0.86.0); one shared key before. */
export const studioProject = { name: "default" };

/** Learns the project's name, so what was seen is kept per project. */
export function knowProject(name: string | null | undefined): void {
  if (!name) return;
  studioProject.name = name;
  window.dispatchEvent(new Event("catalyst-studio:seen"));
}

/** Marks every item now in the inbox as seen (the Inbox view, once it shows them). */
export function markSeen(items: InboxItem[], project = studioProject.name): void {
  seenStore.write(project, items.map(itemKey));
  window.dispatchEvent(new Event("catalyst-studio:seen"));
}

/** The Inbox's unread count beside its name in the navigation, refreshed with catalyst's changes. */
export function UnreadCount({ client }: { client: StudioClient }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [batch, setBatch] = useState(0);
  // a change of what was seen only asks for a fresh render: the store is read below
  const [, setSeenAt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    client
      .events(() => {
        setBatch((b) => b + 1);
      }, abort.signal)
      .catch(() => undefined);
    const onSeen = () => {
      setSeenAt((n) => n + 1);
    };
    window.addEventListener("catalyst-studio:seen", onSeen);
    return () => {
      abort.abort();
      window.removeEventListener("catalyst-studio:seen", onSeen);
    };
  }, [client]);

  useEffect(() => {
    let live = true;
    client.inbox().then(
      (r) => {
        if (live) setItems(r.items);
      },
      () => undefined, // no inbox, no count
    );
    return () => {
      live = false;
    };
  }, [client, batch]);

  const n = unread(items, seenStore.read(studioProject.name)).length;
  if (n === 0) return null;
  return (
    <span className="badge" aria-label={`${String(n)} unread`}>
      {n}
    </span>
  );
}
