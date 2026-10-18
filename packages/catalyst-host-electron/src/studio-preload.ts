import { contextBridge, ipcRenderer } from "electron";

/**
 * The Studio's bridge to the desktop shell (R6.49): the messages the Studio
 * sends a host and the host's answers, over IPC. The page gets these two
 * functions and nothing else of Node or Electron.
 */
contextBridge.exposeInMainWorld("catalystHost", {
  post: (message: unknown) => {
    ipcRenderer.send("catalyst:studio", message);
  },
  subscribe: (listener: (message: unknown) => void) => {
    ipcRenderer.on("catalyst:host", (_event, message: unknown) => {
      listener(message);
    });
  },
});
