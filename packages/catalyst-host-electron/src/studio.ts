import { join } from "node:path";

import {
  catalystCommand,
  runAction,
  startAgentRun,
  startLocalServe,
  StudioRuns,
  type CatalystServer,
} from "catalyst-core";
import { BrowserWindow, dialog, ipcMain, type IpcMainEvent } from "electron";

import { staysOn, studioBundle } from "./studio-policy.js";

/**
 * The person's answer, in the desktop's own dialog: true only on an explicit
 * Run (the default button is Cancel, as Escape is).
 */
export async function confirmIn(win: BrowserWindow, question: string): Promise<boolean> {
  const { response } = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Run", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    message: question,
  });
  return response === 0;
}

/**
 * The Studio for one project (R6.20, R6.49): `catalyst serve --local
 * --static` over the Studio bundle as a sidecar, a sandboxed window on its
 * page, and the host's side of the bridge — every run and action confirmed
 * by the person in a native dialog, then spawned by this process with no
 * shell (studio-SHELL-000016).
 */
export async function openStudio(projectRoot: string, title: string): Promise<BrowserWindow> {
  const bundle = studioBundle();
  if (!bundle) throw new Error("the Studio bundle is missing: build catalyst-studio first");
  const server: CatalystServer = await startLocalServe(projectRoot, catalystCommand(), 15000, bundle);
  if (!server.page) {
    server.child.kill();
    throw new Error("this catalyst cannot serve a page (catalyst 0.64.0 or later serves one)");
  }
  const page = server.page;
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: `${title} (Catalyst Studio)`,
    webPreferences: {
      preload: join(__dirname, "studio-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!staysOn(page, url)) event.preventDefault();
  });
  const runs = new StudioRuns({
    confirm: (question) => confirmIn(win, question),
    start: (command, args, onEvent) => startAgentRun(projectRoot, command, args, onEvent),
    act: (args) => runAction(projectRoot, args),
    post: (message) => {
      if (!win.isDestroyed()) win.webContents.send("catalyst:host", message);
    },
  });
  const listener = (event: IpcMainEvent, message: unknown) => {
    // only this window's page speaks for this project
    if (!win.isDestroyed() && event.sender === win.webContents) void runs.handle(message);
  };
  ipcMain.on("catalyst:studio", listener);
  win.on("closed", () => {
    ipcMain.removeListener("catalyst:studio", listener);
    runs.dispose();
    server.child.kill();
  });
  await win.loadURL(page);
  return win;
}
