import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { ChainModel, Proposal, SlashCommandSpec } from "catalyst-core";
import {
  composeSlashCommand,
  discoverSlashCommands,
  openProposalsByTarget,
  resolveAgentCommand,
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
  agentProcess?: ChildProcessWithoutNullStreams;
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

/** One spawned agent process per project, reused across multiple slash-command runs — never crossed with another project's live session. */
function runSlashCommand(
  win: BrowserWindow,
  project: TrackedProject,
  runtime: ProjectRuntime,
  name: string,
  args: string,
): string | null {
  const agentCommand = resolveAgentCommand(project.projectRoot);
  if (!agentCommand) {
    return 'Couldn\'t determine which agent runs this deployment — no *.catalyst pointer with an "agent" field found.';
  }

  if (!runtime.agentProcess) {
    const child = spawn(agentCommand, [], {
      cwd: project.projectRoot,
      shell: true,
    });
    const forward = (chunk: Buffer) =>
      win.webContents.send("catalyst:agent-output", {
        projectId: project.id,
        chunk: chunk.toString("utf8"),
      });
    child.stdout.on("data", forward);
    child.stderr.on("data", forward);
    child.on("exit", (code) => {
      win.webContents.send("catalyst:agent-output", {
        projectId: project.id,
        chunk: `\n[process exited with code ${code}]\n`,
      });
      runtime.agentProcess = undefined;
    });
    runtime.agentProcess = child;
  }

  runtime.agentProcess.stdin.write(`${composeSlashCommand(name, args)}\n`);
  return null;
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
      runtime.agentProcess?.kill();
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

  ipcMain.handle(
    "catalyst:listSlashCommands",
    (_event, projectId: string): SlashCommandSpec[] => {
      const project = loadTrackedProjects(stateFilePath()).find(
        (p) => p.id === projectId,
      );
      return project ? discoverSlashCommands(project.projectRoot) : [];
    },
  );

  ipcMain.handle(
    "catalyst:runSlashCommand",
    (_event, projectId: string, name: string, args: string): string | null => {
      const project = loadTrackedProjects(stateFilePath()).find(
        (p) => p.id === projectId,
      );
      const runtime = runtimeByProjectId.get(projectId);
      if (!project || !runtime) return "Unknown project.";
      return runSlashCommand(win, project, runtime, name, args);
    },
  );

  ipcMain.handle(
    "catalyst:sendAgentInput",
    (_event, projectId: string, text: string) => {
      runtimeByProjectId.get(projectId)?.agentProcess?.stdin.write(`${text}\n`);
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
