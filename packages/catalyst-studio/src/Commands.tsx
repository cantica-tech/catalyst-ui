import { useEffect, useId, useState, type KeyboardEvent } from "react";

import { ApiError, type Command, type CommandSpec, type StudioClient } from "./client.js";
import { clipboardCopy, CopyButton } from "./Copy.js";
import { useHost, type HostRuns, type RunEvent, type RunHandle } from "./host.js";
import { RunConsole } from "./RunConsole.js";
import { Status } from "./Status.js";

/** One entry the palette offers: a command, or one part of a command with parts. */
export interface PaletteEntry {
  /** `create` or `create bug`: what follows the slash. */
  key: string;
  command: string;
  part: string | null;
  usage: string;
  summary: string;
  /** Every name it answers to, for the search. */
  names: string[];
}

/**
 * The palette's entries: each command, then each of its parts, in catalyst's
 * order. A part's aliases (`create-bug`) name the part, not its command.
 */
export function paletteEntries(commands: Command[]): PaletteEntry[] {
  return commands.flatMap((c) => [
    {
      key: c.name,
      command: c.name,
      part: null,
      usage: c.usage,
      summary: c.summary,
      names: [c.name, ...c.aliases.filter((a) => !c.parts.some((p) => p.aliases.includes(a)))],
    },
    ...c.parts.map((p) => ({
      key: `${c.name} ${p.part}`,
      command: c.name,
      part: p.part,
      usage: p.usage,
      summary: p.summary,
      names: [`${c.name} ${p.part}`, ...p.aliases],
    })),
  ]);
}

/**
 * The entries a search finds: every word must appear in a name or the
 * summary; an entry whose name starts with the search comes first, then one
 * whose name holds it, then one found by its summary alone.
 */
export function searchPalette(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const q = query.trim().toLowerCase().replace(/^\//, "");
  if (!q) return entries;
  const words = q.split(/\s+/);
  const rank = (e: PaletteEntry): number => {
    const names = e.names.map((n) => n.toLowerCase());
    if (names.some((n) => n.startsWith(q) || n.replace(/-/g, " ").startsWith(q))) return 0;
    if (names.some((n) => n.includes(q))) return 1;
    const hay = `${names.join(" ")} ${e.summary.toLowerCase()}`;
    return words.every((w) => hay.includes(w)) ? 2 : -1;
  };
  return entries
    .map((e, i) => ({ e, i, r: rank(e) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}

/** The slash command as an agent's chat takes it: `/create bug Sign-in fails`. */
export function composeCommand(entry: PaletteEntry, args: string): string {
  return [`/${entry.key}`, args.trim()].filter(Boolean).join(" ");
}

/**
 * The search box and the list it filters, as one combobox: typing filters,
 * the arrow keys move through the list, Enter picks; the focus stays in
 * the box, the active option is announced.
 */
export function PaletteSearch({
  entries,
  onPick,
  inputId,
}: {
  entries: PaletteEntry[];
  onPick: (entry: PaletteEntry) => void;
  inputId: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const found = searchPalette(entries, query);
  const current = Math.min(active, Math.max(found.length - 1, 0));
  const optionId = (i: number) => `${listId}-option-${String(i)}`;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(current + 1, found.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (event.key === "Enter" && found.length > 0) {
      event.preventDefault();
      onPick(found[current]);
    } else if (event.key === "Escape") {
      setQuery("");
      setActive(0);
    }
  };

  return (
    <div className="palette">
      <label htmlFor={inputId}>Find a command</label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={found.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={found.length > 0 ? optionId(current) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <p className="muted" aria-live="polite">
        {found.length === entries.length
          ? `${String(entries.length)} commands`
          : `${String(found.length)} of ${String(entries.length)} commands`}
      </p>
      <ul id={listId} role="listbox" aria-label="Commands" className="palette-list">
        {found.map((e, i) => (
          // the input keeps the focus (aria-activedescendant) and its keys pick; a click picks too
          <li
            key={e.key}
            id={optionId(i)}
            role="option"
            aria-selected={i === current}
            className={e.part ? "palette-part" : undefined}
            onClick={() => {
              onPick(e);
            }}
          >
            <code>{e.usage}</code> <span className="muted">{e.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The chosen command: its procedure as catalyst gives it, and the slash command to copy. */
export function CommandPage({
  entry,
  spec,
  copy,
  onBack,
  host,
}: {
  entry: PaletteEntry;
  spec?: CommandSpec;
  copy: (text: string) => Promise<void>;
  onBack: () => void;
  /** The host that runs commands, inside VS Code (studio-SHELL-000015); none in a browser. */
  host?: HostRuns | null;
}) {
  const [args, setArgs] = useState("");
  const argsId = useId();
  const composed = composeCommand(entry, args);
  const [events, setEvents] = useState<RunEvent[] | null>(null);
  const [declined, setDeclined] = useState(false);
  const [handle, setHandle] = useState<RunHandle | null>(null);
  const running = events !== null && !declined && !events.some((e) => e.event === "end");
  const start = () => {
    if (!host) return;
    setEvents([]);
    setDeclined(false);
    // a part runs as its command, the part leading its arguments (`/create bug …`)
    const runArgs = [entry.part, args.trim()].filter(Boolean).join(" ");
    setHandle(
      host.run(
        entry.command,
        runArgs,
        (event) => {
          setEvents((list) => [...(list ?? []), event]);
        },
        () => {
          setDeclined(true);
        },
      ),
    );
  };
  return (
    <article aria-labelledby="command-title">
      <p>
        <button type="button" className="link-button" onClick={onBack}>
          ← All commands
        </button>
      </p>
      <h2 id="command-title">
        <code>/{entry.key}</code>
      </h2>
      <p>{entry.summary}</p>
      <section aria-labelledby="command-compose">
        <h3 id="command-compose">Ask your agent</h3>
        <p className="muted">
          Typed as <code>{entry.usage}</code>.{" "}
          {host
            ? "Run it with your agent here (VS Code asks you first), or copy it into your agent's chat."
            : "Copy it into your agent's chat; inside VS Code, the Studio can run it."}
        </p>
        <label htmlFor={argsId}>Arguments</label>{" "}
        <input
          id={argsId}
          type="text"
          value={args}
          autoComplete="off"
          onChange={(event) => {
            setArgs(event.target.value);
          }}
        />
        <p>
          <code className="composed">{composed}</code> <CopyButton text={composed} copy={copy} />
        </p>
        {host && (
          <p>
            <button type="button" onClick={start} disabled={running}>
              Run with your agent
            </button>{" "}
            {running && (
              <button
                type="button"
                onClick={() => {
                  handle?.cancel();
                }}
              >
                Stop
              </button>
            )}
          </p>
        )}
      </section>
      {events !== null && <RunConsole events={events} declined={declined} />}
      <section aria-labelledby="command-procedure">
        <h3 id="command-procedure">What it does</h3>
        {spec ? (
          <div className="section-text">{spec.text}</div>
        ) : (
          <p>
            <Status tone="info" label="Loading" />
          </p>
        )}
      </section>
    </article>
  );
}

/** The id of the palette's search box: the shell focuses it on Ctrl/⌘+K. */
export const COMMAND_SEARCH_ID = "command-search";

type Load =
  | { state: "loading" }
  | { state: "ready"; entries: PaletteEntry[] }
  | { state: "unserved" }
  | { state: "failed"; message: string };

/** The Commands view: the palette, or one command's page. */
export function Commands({
  client,
  copy = clipboardCopy,
  host,
}: {
  client: StudioClient;
  copy?: (text: string) => Promise<void>;
  host?: HostRuns | null;
}) {
  const contextHost = useHost();
  const runsWith = host === undefined ? contextHost : host;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [open, setOpen] = useState<PaletteEntry | null>(null);
  const [spec, setSpec] = useState<CommandSpec | undefined>(undefined);

  useEffect(() => {
    let live = true;
    client.commands().then(
      (commands) => {
        if (live) setLoad({ state: "ready", entries: paletteEntries(commands) });
      },
      (err: unknown) => {
        if (!live) return;
        // an older catalyst has no such route
        setLoad(
          err instanceof ApiError && err.status === 404
            ? { state: "unserved" }
            : { state: "failed", message: String(err) },
        );
      },
    );
    return () => {
      live = false;
    };
  }, [client]);

  useEffect(() => {
    setSpec(undefined);
    if (!open) return;
    let live = true;
    client.spec(open.command, open.part ?? undefined).then(
      (value) => {
        if (live) setSpec(value);
      },
      (err: unknown) => {
        if (live) setSpec({ command: open.command, part: open.part, text: `catalyst did not answer: ${String(err)}` });
      },
    );
    return () => {
      live = false;
    };
  }, [client, open]);

  if (load.state === "ready" && open) {
    return (
      <CommandPage
        key={open.key}
        entry={open}
        spec={spec}
        copy={copy}
        host={runsWith}
        onBack={() => {
          setOpen(null);
        }}
      />
    );
  }
  return (
    <>
      <h2>Commands</h2>
      {load.state === "loading" && <Status tone="info" label="Loading" />}
      {load.state === "unserved" && (
        <p>
          <Status tone="warn" label="Not served" />{" "}
          <span className="muted">
            The catalyst serving this page lists no commands: the palette needs catalyst 0.75.0 or later.
          </span>
        </p>
      )}
      {load.state === "failed" && (
        <p>
          <Status tone="error" label="catalyst did not answer" /> <span className="muted">{load.message}</span>
        </p>
      )}
      {load.state === "ready" && <PaletteSearch entries={load.entries} onPick={setOpen} inputId={COMMAND_SEARCH_ID} />}
    </>
  );
}
