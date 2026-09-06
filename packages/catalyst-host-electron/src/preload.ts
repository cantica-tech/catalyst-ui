import { contextBridge, ipcRenderer } from "electron";

import type { GraphLayout } from "./graph.js";
import type { TrackedProject } from "./state.js";
import type { NodeDetailPayload } from "catalyst-core";

export interface ProjectUpdate {
  projectId: string;
  nodeCount: number;
  errorCount: number;
  layout: GraphLayout;
}

const api = {
  listProjects: (): Promise<TrackedProject[]> =>
    ipcRenderer.invoke("catalyst:listProjects"),
  addProject: (): Promise<TrackedProject | null> =>
    ipcRenderer.invoke("catalyst:addProject"),
  removeProject: (id: string): Promise<void> =>
    ipcRenderer.invoke("catalyst:removeProject", id),
  getNodeDetail: (
    projectId: string,
    nodeId: string,
  ): Promise<NodeDetailPayload | null> =>
    ipcRenderer.invoke("catalyst:getNodeDetail", projectId, nodeId),
  onProjectUpdate: (
    listener: (update: ProjectUpdate) => void,
  ): (() => void) => {
    const handler = (_event: unknown, update: ProjectUpdate) =>
      listener(update);
    ipcRenderer.on("catalyst:project-update", handler);
    return () => ipcRenderer.removeListener("catalyst:project-update", handler);
  },
};

export type CatalystApi = typeof api;

contextBridge.exposeInMainWorld("catalyst", api);
