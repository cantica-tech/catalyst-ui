import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

import type { ChainModel } from "catalyst-core";
import { resolveCorpusRoot, watchProject } from "catalyst-core";
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";

import { buildNodeDetail } from "./detail.js";
import { computeGraphLayout } from "./graph.js";
import { isProjectId, renderInlineHtml } from "./security.js";
import { openStudio } from "./studio.js";
import {
  addTrackedProject,
  loadTrackedProjects,
  removeTrackedProject,
  saveTrackedProjects,
  type TrackedProject,
} from "./state.js";

interface ProjectRuntime {
  handle: { close(): Promise<void> };
  model: ChainModel | null;
}

const runtimeByProjectId = new Map<string, ProjectRuntime>();

function stateFilePath(): string {
  return join(app.getPath("userData"), "projects.json");
}

/**
 * One persistent watcher per tracked project — not torn down on project
 * switch. Through catalyst serve when catalyst can serve the project, else
 * the files directly (REQ-000019).
 */
function startWatching(project: TrackedProject, win: BrowserWindow): void {
  const handle = watchProject(
    project.projectRoot,
    project.corpusRoot,
    ({ model, report }) => {
      const runtime = runtimeByProjectId.get(project.id);
      if (runtime) {
        runtime.model = model;
      }
      win.webContents.send("catalyst:project-update", {
        projectId: project.id,
        nodeCount: model.nodes.size,
        errorCount: report.errorCount,
        layout: computeGraphLayout(model),
      });
    },
    (message) => {
      console.log(`catalyst: ${message}`);
    },
  );

  runtimeByProjectId.set(project.id, { handle, model: null });
}

/** Only this app's own window may call the IPC API. */
function fromOwnWindow(win: BrowserWindow, event: IpcMainInvokeEvent): boolean {
  return !win.isDestroyed() && event.sender === win.webContents;
}

function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle("catalyst:listProjects", (event) =>
    fromOwnWindow(win, event) ? loadTrackedProjects(stateFilePath()) : [],
  );

  ipcMain.handle("catalyst:addProject", async (event) => {
    if (!fromOwnWindow(win, event)) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const projectRoot = result.filePaths[0];
    const corpusRoot = resolveCorpusRoot(projectRoot);
    if (!corpusRoot) return null;

    const projects = loadTrackedProjects(stateFilePath());
    const updated = addTrackedProject(projects, projectRoot, corpusRoot);
    saveTrackedProjects(stateFilePath(), updated);

    const added = updated.find((p) => p.projectRoot === projectRoot) ?? null;
    if (added && !runtimeByProjectId.has(added.id)) {
      startWatching(added, win);
    }
    return added;
  });

  ipcMain.handle("catalyst:removeProject", async (event, id: unknown) => {
    if (!fromOwnWindow(win, event) || !isProjectId(id)) return;
    const runtime = runtimeByProjectId.get(id);
    if (runtime) {
      await runtime.handle.close();
      runtimeByProjectId.delete(id);
    }
    const projects = loadTrackedProjects(stateFilePath());
    saveTrackedProjects(stateFilePath(), removeTrackedProject(projects, id));
  });

  ipcMain.handle("catalyst:getNodeDetail", (event, projectId: unknown, nodeId: unknown) => {
    if (!fromOwnWindow(win, event)) return null;
    if (!isProjectId(projectId) || !isProjectId(nodeId)) return null;
    const runtime = runtimeByProjectId.get(projectId);
    if (!runtime?.model) return null;
    return buildNodeDetail(runtime.model, nodeId);
  });

  ipcMain.handle("catalyst:openStudio", async (event, projectId: unknown): Promise<string | null> => {
    if (!fromOwnWindow(win, event) || !isProjectId(projectId)) return "Refused.";
    const project = loadTrackedProjects(stateFilePath()).find((p) => p.id === projectId);
    if (!project) return "Unknown project.";
    try {
      await openStudio(project.projectRoot, basename(project.projectRoot));
      return null;
    } catch (err) {
      return `catalyst could not serve the Studio: ${String(err)}`;
    }
  });
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload only needs `contextBridge`/`ipcRenderer`, both
      // available to a sandboxed preload.
      sandbox: true,
      webSecurity: true,
    },
  });

  // Never navigate away from, or open new windows over, the app page.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  const nonce = randomBytes(16).toString("base64");
  // the renderer inline: a data: page may not load the packaged app's file: script
  const html = renderInlineHtml(readFileSync(join(__dirname, "renderer.js"), "utf8"), nonce);
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  return win;
}

app
  .whenReady()
  .then(() => {
    const win = createMainWindow();
    registerIpcHandlers(win);

    for (const project of loadTrackedProjects(stateFilePath())) {
      startWatching(project, win);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  })
  .catch((error: unknown) => {
    console.error("catalyst-host-electron failed to start:", error);
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
