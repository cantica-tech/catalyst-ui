import { createRoot } from "react-dom/client";

import { Shell } from "./Shell.js";
import { Status } from "./Status.js";

/** The browser entry: mounts the shell into `#studio`. */
function mount(): void {
  const host = document.getElementById("studio");
  if (!host) return;
  createRoot(host).render(
    <Shell
      project="catalyst Studio"
      views={[
        {
          id: "overview",
          label: "Overview",
          render: () => (
            <>
              <h2>Overview</h2>
              <p>
                <Status tone="info" label="Not connected" />{" "}
                <span className="muted">Open this page through catalyst serve --local --static.</span>
              </p>
            </>
          ),
        },
      ]}
    />,
  );
}

mount();
