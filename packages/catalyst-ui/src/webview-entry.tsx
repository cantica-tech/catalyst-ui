import type { NodeDetailPayload } from "catalyst-core";
import { createRoot } from "react-dom/client";

import { NodeDetail } from "./NodeDetail.js";

declare global {
  interface Window {
    __CATALYST_INITIAL_PAYLOAD__?: NodeDetailPayload;
  }
}

const container = document.getElementById("root");

if (container) {
  const root = createRoot(container);

  const render = (payload: NodeDetailPayload) => {
    root.render(
      <NodeDetail
        node={payload.node}
        upstream={payload.upstream}
        downstream={payload.downstream}
      />,
    );
  };

  // The host injects the panel's initial data as a global before this
  // script loads (no readiness handshake needed for a one-shot render).
  // Also listens for `message` (the standard VS Code webview channel) so
  // a later phase that pushes live updates has a protocol to send them
  // on without touching this file again.
  if (window.__CATALYST_INITIAL_PAYLOAD__) {
    render(window.__CATALYST_INITIAL_PAYLOAD__);
  }
  window.addEventListener(
    "message",
    (event: MessageEvent<NodeDetailPayload>) => {
      render(event.data);
    },
  );
}
