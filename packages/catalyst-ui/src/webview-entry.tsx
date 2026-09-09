import type { WebviewPayload } from "catalyst-core";
import { createRoot } from "react-dom/client";

import { IamRoleDetail, IamUserDetail } from "./IamDetail.js";
import { Journal } from "./Journal.js";
import { NodeDetail } from "./NodeDetail.js";

declare global {
  interface Window {
    __CATALYST_INITIAL_PAYLOAD__?: WebviewPayload;
  }
}

const container = document.getElementById("root");

if (container) {
  const root = createRoot(container);

  const render = (payload: WebviewPayload) => {
    switch (payload.type) {
      case "node":
        root.render(
          <NodeDetail
            node={payload.node}
            upstream={payload.upstream}
            downstream={payload.downstream}
            openProposals={payload.openProposals}
          />,
        );
        return;
      case "iam-user":
        root.render(
          <IamUserDetail user={payload.user} roles={payload.roles} />,
        );
        return;
      case "iam-role":
        root.render(
          <IamRoleDetail role={payload.role} users={payload.users} />,
        );
        return;
      case "journal":
        root.render(<Journal entries={payload.entries} />);
        return;
    }
  };

  // The host injects the panel's initial data as a global before this
  // script loads (no readiness handshake needed for a one-shot render).
  // Also listens for `message` (the standard VS Code webview channel) so
  // a later phase that pushes live updates has a protocol to send them
  // on without touching this file again.
  if (window.__CATALYST_INITIAL_PAYLOAD__) {
    render(window.__CATALYST_INITIAL_PAYLOAD__);
  }
  window.addEventListener("message", (event: MessageEvent<WebviewPayload>) => {
    render(event.data);
  });
}
