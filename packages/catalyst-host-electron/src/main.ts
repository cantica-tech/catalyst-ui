import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { ChainModel, Proposal } from "catalyst-core";
import {
  openProposalsByTarget,
  resolveCorpusRoot,
  watchCorpus,
} from "catalyst-core";
import { app, BrowserWindow, dialog, ipcMain } from "electron";

import { buildNodeDetail } from "./detail.js";
import { computeGraphLayout } from "./graph.js";
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
  proposals: Proposal[];
}

const runtimeByProjectId = new Map<string, ProjectRuntime>();

function stateFilePath(): string {
  return join(app.getPath("userData"), "projects.json");
}

/** One persistent `watchCorpus` per tracked project — not torn down on project switch. */
function startWatching(project: TrackedProject, win: BrowserWindow): void {
  const handle = watchCorpus(
    project.corpusRoot,
    ({ model, report, proposals }) => {
      const runtime = runtimeByProjectId.get(project.id);
      if (runtime) {
        runtime.model = model;
        runtime.proposals = proposals;
      }
      win.webContents.send("catalyst:project-update", {
        projectId: project.id,
        nodeCount: model.nodes.size,
        errorCount: report.errorCount,
        layout: computeGraphLayout(model),
      });
    },
  );

  runtimeByProjectId.set(project.id, { handle, model: null, proposals: [] });
}

function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle("catalyst:listProjects", () =>
    loadTrackedProjects(stateFilePath()),
  );

  ipcMain.handle("catalyst:addProject", async () => {
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

  ipcMain.handle("catalyst:removeProject", async (_event, id: string) => {
    const runtime = runtimeByProjectId.get(id);
    if (runtime) {
      await runtime.handle.close();
      runtimeByProjectId.delete(id);
    }
    const projects = loadTrackedProjects(stateFilePath());
    saveTrackedProjects(stateFilePath(), removeTrackedProject(projects, id));
  });

  ipcMain.handle(
    "catalyst:getNodeDetail",
    (_event, projectId: string, nodeId: string) => {
      const runtime = runtimeByProjectId.get(projectId);
      if (!runtime?.model) return null;
      return buildNodeDetail(
        runtime.model,
        nodeId,
        openProposalsByTarget(runtime.proposals),
      );
    },
  );
}

function renderIndexHtml(rendererPath: string): string {
  const scriptSrc = pathToFileURL(rendererPath).toString();
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body>
<div id="root"></div>
<script src="${scriptSrc}"></script>
</body>
</html>`;
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const html = renderIndexHtml(join(__dirname, "renderer.js"));
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
