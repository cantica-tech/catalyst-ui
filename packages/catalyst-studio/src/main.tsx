import { createRoot } from "react-dom/client";

import { connectionFromPage, StudioClient } from "./client.js";
import { Overview } from "./Overview.js";
import { Shell } from "./Shell.js";
import { Status } from "./Status.js";

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
      ]}
    />,
  );
}

mount();
