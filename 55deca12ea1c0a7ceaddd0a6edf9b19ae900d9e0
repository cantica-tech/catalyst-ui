import type { WebviewPayload } from "catalyst-core";
import { createRoot } from "react-dom/client";

import { Backlog } from "./Backlog.js";
import { KernelVersionHeader } from "./KernelVersionHeader.js";
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
    const content = (() => {
      switch (payload.type) {
        case "node":
          return (
            <NodeDetail
              node={payload.node}
              upstream={payload.upstream}
              downstream={payload.downstream}
              openProposals={payload.openProposals}
            />
          );
        case "iam-user":
          return <IamUserDetail user={payload.user} roles={payload.roles} />;
        case "iam-role":
          return <IamRoleDetail role={payload.role} users={payload.users} />;
        case "journal":
          return <Journal entries={payload.entries} />;
        case "backlog":
          return <Backlog markdown={payload.markdown} />;
      }
    })();

    root.render(
      <div className="catalyst-ui-root">
        <KernelVersionHeader versionInfo={payload.kernelVersionInfo} />
        <div style={{ padding: "0 16px 16px 16px" }}>{content}</div>
      </div>,
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
  window.addEventListener("message", (event: MessageEvent<WebviewPayload>) => {
    render(event.data);
  });
}
