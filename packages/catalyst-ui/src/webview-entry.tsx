import type { WebviewPayload } from "catalyst-core";
import { createRoot } from "react-dom/client";

import { Backlog } from "./Backlog.js";
import { KernelVersionHeader } from "./KernelVersionHeader.js";
import { IamRoleDetail, IamUserDetail } from "./IamDetail.js";
import { Journal } from "./Journal.js";
import { NodeDetail } from "./NodeDetail.js";
import { referenceTarget } from "./references.js";

declare global {
  interface Window {
    __CATALYST_INITIAL_PAYLOAD__?: WebviewPayload;
  }
}

/** VS Code's webview API — callable once; absent outside a VS Code webview. */
declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const host =
  typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;

/**
 * A click on an entity reference (`REQ-000014-UVqkd7cL`) asks the host to
 * open that entity; the views stay host-agnostic and only render links.
 */
function onClick(event: MouseEvent): void {
  const id = referenceTarget(event.target);
  if (!id) return;
  event.preventDefault();
  host?.postMessage({ type: "openReference", id });
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
              references={payload.references}
            />
          );
        case "iam-user":
          return <IamUserDetail user={payload.user} roles={payload.roles} />;
        case "iam-role":
          return <IamRoleDetail role={payload.role} users={payload.users} />;
        case "journal":
          return <Journal entries={payload.entries} />;
        case "backlog":
          return (
            <Backlog
              markdown={payload.markdown}
              references={payload.references}
            />
          );
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
  container.addEventListener("click", onClick);
  if (window.__CATALYST_INITIAL_PAYLOAD__) {
    render(window.__CATALYST_INITIAL_PAYLOAD__);
  }
  window.addEventListener("message", (event: MessageEvent<WebviewPayload>) => {
    render(event.data);
  });
}
