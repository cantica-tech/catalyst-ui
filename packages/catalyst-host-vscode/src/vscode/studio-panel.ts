import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";

import { catalystCommand, startAgentRun, startLocalServe, type CatalystServer } from "catalyst-core";
import * as vscode from "vscode";

import { studioPanelHtml } from "../studio-html.js";
import { StudioRuns } from "../studio-runs.js";

/**
 * Opens the Studio for one project (catalyst roadmap R6.2): a server of its
 * own, `catalyst serve --local --static` over the Studio bundle this
 * extension ships, framed in a webview panel. Closing the panel stops the
 * server.
 */
export async function openStudio(
  context: vscode.ExtensionContext,
  projectRoot: string,
  title: string,
  log: (message: string) => void,
): Promise<void> {
  const studioDir = vscode.Uri.joinPath(context.extensionUri, "dist", "studio").fsPath;
  if (!existsSync(studioDir)) {
    void vscode.window.showErrorMessage(`The Studio bundle is missing from this extension (${studioDir}).`);
    return;
  }
  let server: CatalystServer;
  try {
    server = await startLocalServe(projectRoot, catalystCommand(), 15000, studioDir);
  } catch (err) {
    void vscode.window.showErrorMessage(`catalyst could not serve the Studio: ${String(err)}`);
    return;
  }
  if (!server.page) {
    server.child.kill();
    void vscode.window.showErrorMessage("This catalyst cannot serve a page (catalyst 0.64.0 or later serves one).");
    return;
  }
  const page = (await vscode.env.asExternalUri(vscode.Uri.parse(server.page))).toString(true);
  const panel = vscode.window.createWebviewPanel("catalystStudio", `Studio: ${title}`, vscode.ViewColumn.Active, {
    // the framed Studio needs scripts; the panel's own CSP grants none to the panel itself
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  // the agent console (studio-SHELL-000015, owner decision C2): a run is the
  // host's, asked for by the Studio, confirmed by the person here
  const runs = new StudioRuns({
    confirm: async (question) => (await vscode.window.showWarningMessage(question, { modal: true }, "Run")) === "Run",
    start: (command, args, onEvent) => startAgentRun(projectRoot, command, args, onEvent),
    post: (message) => {
      void panel.webview.postMessage(message);
    },
  });
  panel.webview.onDidReceiveMessage((message: unknown) => {
    runs.handle(message).catch((err: unknown) => {
      log(`Studio run: ${String(err)}`);
    });
  });
  panel.webview.html = studioPanelHtml(page, randomBytes(16).toString("base64"));
  log(`Studio for ${title}: ${server.url}`);
  panel.onDidDispose(() => {
    runs.dispose();
    server.child.kill();
  });
}
