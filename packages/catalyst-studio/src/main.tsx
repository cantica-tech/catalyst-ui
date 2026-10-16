import { createRoot } from "react-dom/client";

import { Artifacts } from "./Artifacts.js";
import { Board } from "./Board.js";
import { connectionFromPage, StudioClient } from "./client.js";
import { COMMAND_SEARCH_ID, Commands } from "./Commands.js";
import { Inbox } from "./Inbox.js";
import { Journal } from "./Journal.js";
import { Overview } from "./Overview.js";
import { Roadmap } from "./Roadmap.js";
import { Rules } from "./Rules.js";
import { Shell } from "./Shell.js";
import { Status } from "./Status.js";
import { Team } from "./Team.js";
import { TypeMap } from "./TypeMap.js";

/** The browser entry: connects to catalyst, then mounts the shell into `#studio`. */
function mount(): void {
  const host = document.getElementById("studio");
  if (!host) return;
  const connection = connectionFromPage();
  const client = connection ? new StudioClient(connection) : null;
  createRoot(host).render(
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
                render: () => <Inbox client={client} />,
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
                id: "team",
                label: "Team",
                render: () => <Team client={client} />,
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
    />,
  );
}

mount();
