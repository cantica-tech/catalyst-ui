import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { ChainModel, Proposal, SlashCommandSpec } from "catalyst-core";
import {
  commandNames,
  composeCommandRequest,
  discoverSlashCommands,
  openProposalsByTarget,
  resolveAgentLaunch,
  resolveCorpusRoot,
  watchProject,
} from "catalyst-core";
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";

import { buildNodeDetail } from "./detail.js";
import { computeGraphLayout } from "./graph.js";
import { isProjectId, renderIndexHtml, validateAgentInput, validateSlashCommandRequest } from "./security.js";
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

/**
 * One persistent watcher per tracked project — not torn down on project
 * switch. Through catalyst serve when catalyst can serve the project, else
 * the files directly (REQ-000019).
 */
function startWatching(project: TrackedProject, win: BrowserWindow): void {
  const handle = watchProject(
    project.projectRoot,
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
    (message) => {
      console.log(`catalyst: ${message}`);
    },
  );

  runtimeByProjectId.set(project.id, { handle, model: null, proposals: [] });
}

/**
 * One spawned agent process per project, reused across multiple
 * slash-command runs — never crossed with another project's live session.
 * The binary comes from the allow-list in `resolveAgentLaunch` (never the
 * pointer's raw `agent` string) and is spawned with an argv array and
 * `shell: false`, so nothing from the repository reaches a shell (B-01).
 */
function runSlashCommand(
  win: BrowserWindow,
  project: TrackedProject,
  runtime: ProjectRuntime,
  name: string,
  args: string,
): string | null {
  const launch = resolveAgentLaunch(project.projectRoot);
  if (!launch.ok) return launch.reason;

  if (!runtime.agentProcess) {
    const child = spawn(launch.command, launch.args, {
      cwd: project.projectRoot,
      shell: false,
    });
    const forward = (chunk: Buffer) => {
      win.webContents.send("catalyst:agent-output", {
        projectId: project.id,
        chunk: chunk.toString("utf8"),
      });
    };
    child.stdout.on("data", forward);
    child.stderr.on("data", forward);
    child.on("error", (error) => {
      win.webContents.send("catalyst:agent-output", {
        projectId: project.id,
        chunk: `\n[could not start ${launch.command}: ${error.message}]\n`,
      });
      runtime.agentProcess = undefined;
    });
    child.on("exit", (code) => {
      win.webContents.send("catalyst:agent-output", {
        projectId: project.id,
        chunk: `\n[process exited with code ${code}]\n`,
      });
      runtime.agentProcess = undefined;
    });
    runtime.agentProcess = child;
  }

  runtime.agentProcess.stdin.write(`${composeCommandRequest(name, args)}\n`);
  return null;
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
      runtime.agentProcess?.kill();
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
    return buildNodeDetail(runtime.model, nodeId, openProposalsByTarget(runtime.proposals));
  });

  ipcMain.handle("catalyst:listSlashCommands", (event, projectId: unknown): SlashCommandSpec[] => {
    if (!fromOwnWindow(win, event) || !isProjectId(projectId)) return [];
    const project = loadTrackedProjects(stateFilePath()).find((p) => p.id === projectId);
    return project ? discoverSlashCommands(project.projectRoot) : [];
  });

  ipcMain.handle(
    "catalyst:runSlashCommand",
    (event, projectId: unknown, name: unknown, args: unknown): string | null => {
      if (!fromOwnWindow(win, event)) return "Refused.";
      const project = isProjectId(projectId)
        ? loadTrackedProjects(stateFilePath()).find((p) => p.id === projectId)
        : undefined;
      const runtime = project ? runtimeByProjectId.get(project.id) : undefined;
      if (!project || !runtime) return "Unknown project.";
      // Only a command of the project's composed §4 can be dispatched.
      const allowed = commandNames(discoverSlashCommands(project.projectRoot));
      const checked = validateSlashCommandRequest(projectId, name, args, allowed);
      if (!checked.ok) return checked.error;
      return runSlashCommand(win, project, runtime, checked.name, checked.args);
    },
  );

  ipcMain.handle("catalyst:sendAgentInput", (event, projectId: unknown, text: unknown) => {
    if (!fromOwnWindow(win, event)) return;
    const checked = validateAgentInput(projectId, text);
    if (!checked.ok) return;
    runtimeByProjectId.get(projectId as string)?.agentProcess?.stdin.write(`${checked.text}\n`);
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
  const html = renderIndexHtml(pathToFileURL(join(__dirname, "renderer.js")).toString(), nonce);
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
