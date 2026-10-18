import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { Analyses } from "./Analyses.js";
import { Approvals } from "./Approvals.js";
import { Audit } from "./Audit.js";
import { Modules } from "./Modules.js";
import { Artifacts } from "./Artifacts.js";
import { Board } from "./Board.js";
import { connectionFromPage, StudioClient } from "./client.js";
import { COMMAND_SEARCH_ID, Commands } from "./Commands.js";
import { WithDrift } from "./drift.js";
import { WithImpact } from "./impact.js";
import { connectHost, HostContext, type HostRuns } from "./host.js";
import { Inbox } from "./Inbox.js";
import { Journal } from "./Journal.js";
import { Overview } from "./Overview.js";
import { Roadmap } from "./Roadmap.js";
import { Rules } from "./Rules.js";
import { Search, SEARCH_ID } from "./Search.js";
import { Shell } from "./Shell.js";
import { Status } from "./Status.js";
import { Share } from "./Share.js";
import { Team } from "./Team.js";
import { TypeMap } from "./TypeMap.js";
import { knowProject, UnreadCount } from "./Unread.js";

/** Gives every view the host once it answers (inside a host only; a browser has none). */
function WithHost({ hostReady, children }: { hostReady: Promise<HostRuns | null>; children: ReactNode }) {
  const [host, setHost] = useState<HostRuns | null>(null);
  useEffect(() => {
    let live = true;
    void hostReady.then((h) => {
      if (live) setHost(h);
    });
    return () => {
      live = false;
    };
  }, [hostReady]);
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

/** The browser entry: connects to catalyst, then mounts the shell into `#studio`. */
function mount(): void {
  const host = document.getElementById("studio");
  if (!host) return;
  const connection = connectionFromPage();
  const client = connection ? new StudioClient(connection) : null;
  const hostReady = connectHost(); // the page renders now; the run appears when a host answers
  client?.head().then(
    (h) => {
      knowProject(h.project);
    },
    () => undefined, // a shared server has no head of this kind: one key for what was seen
  );
  createRoot(host).render(
    <WithHost hostReady={hostReady}>
      <WithDrift client={client}>
        <WithImpact>
          <Shell
            project="catalyst Studio"
            views={[
              {
                id: "overview",
                label: "Overview",
                render: () =>
                  client ? (
                    <Overview client={client} />
                  ) : (
                    <>
                      <h2>Overview</h2>
                      <p>
                        <Status tone="info" label="Not connected" />{" "}
                        <span className="muted">
                          Open the page URL that <code>catalyst serve --local --static</code> prints.
                        </span>
                      </p>
                    </>
                  ),
              },
              ...(client
                ? [
                    {
                      id: "inbox",
                      label: "Inbox",
                      badge: <UnreadCount client={client} />,
                      render: (target?: string) => <Inbox client={client} target={target} />,
                    },
                    {
                      id: "artifacts",
                      label: "Artifacts",
                      render: (target?: string) => <Artifacts client={client} target={target} />,
                    },
                    {
                      id: "board",
                      label: "Board",
                      render: (target?: string) => <Board client={client} target={target} />,
                    },
                    {
                      id: "map",
                      label: "Map",
                      render: () => <TypeMap client={client} />,
                    },
                    {
                      id: "roadmap",
                      label: "Roadmap",
                      render: () => <Roadmap client={client} />,
                    },
                    {
                      id: "rules",
                      label: "Rules",
                      render: () => <Rules client={client} />,
                    },
                    {
                      id: "journal",
                      label: "Journal",
                      render: () => <Journal client={client} />,
                    },
                    {
                      id: "approvals",
                      label: "Approvals",
                      render: () => <Approvals client={client} />,
                    },
                    {
                      id: "analyses",
                      label: "Analyses",
                      render: (target?: string) => <Analyses client={client} target={target} />,
                    },
                    {
                      id: "modules",
                      label: "Modules",
                      render: () => <Modules client={client} />,
                    },
                    {
                      id: "audit",
                      label: "Audit",
                      render: () => <Audit client={client} />,
                    },
                    {
                      id: "team",
                      label: "Team",
                      render: () => <Team client={client} />,
                    },
                    {
                      id: "share",
                      label: "Share",
                      render: () => <Share client={client} />,
                    },
                    {
                      id: "search",
                      label: "Search",
                      render: () => <Search client={client} />,
                      shortcut: { key: "/", focus: SEARCH_ID },
                    },
                    {
                      id: "commands",
                      label: "Commands",
                      render: () => <Commands client={client} />,
                      shortcut: { key: "k", focus: COMMAND_SEARCH_ID },
                    },
                  ]
                : []),
            ]}
          />
        </WithImpact>
      </WithDrift>
    </WithHost>,
  );
}

mount();
