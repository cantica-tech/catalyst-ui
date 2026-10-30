import type { WebviewPayload } from "catalyst-core";
import { createRoot } from "react-dom/client";

import { Backlog } from "./Backlog.js";
import { KernelVersionHeader } from "./KernelVersionHeader.js";
import { DirectoryGroupDetail, DirectoryRoleDetail, DirectoryUserDetail, directoryTarget } from "./DirectoryDetail.js";
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

const host = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;

/**
 * A click on an entity reference (`REQ-000014-UVqkd7cL`), or on a user, role
 * or group (`vscode-IAM-000003-UVqkd7cL`), asks the host to open it; the views
 * stay host-agnostic and only render links.
 */
function onClick(event: MouseEvent): void {
  const directory = directoryTarget(event.target);
  if (directory) {
    event.preventDefault();
    host?.postMessage({ type: "openDirectory", ...directory });
    return;
  }
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
              references={payload.references}
            />
          );
        case "directory-user":
          return <DirectoryUserDetail user={payload.user} roles={payload.roles} groups={payload.groups} />;
        case "directory-role":
          return <DirectoryRoleDetail role={payload.role} groups={payload.groups} users={payload.users} />;
        case "directory-group":
          return <DirectoryGroupDetail group={payload.group} members={payload.members} />;
        case "journal":
          return <Journal entries={payload.entries} />;
        case "backlog":
          return <Backlog markdown={payload.markdown} references={payload.references} />;
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
