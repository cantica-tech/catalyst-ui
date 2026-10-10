import { contextBridge, ipcRenderer } from "electron";

import type { GraphLayout } from "./graph.js";
import type { TrackedProject } from "./state.js";
import type { NodeDetailPayload, SlashCommandSpec } from "catalyst-core";

export interface ProjectUpdate {
  projectId: string;
  nodeCount: number;
  errorCount: number;
  layout: GraphLayout;
}

export interface AgentOutputEvent {
  projectId: string;
  chunk: string;
}

const api = {
  listProjects: (): Promise<TrackedProject[]> => ipcRenderer.invoke("catalyst:listProjects"),
  addProject: (): Promise<TrackedProject | null> => ipcRenderer.invoke("catalyst:addProject"),
  removeProject: (id: string): Promise<void> => ipcRenderer.invoke("catalyst:removeProject", id),
  getNodeDetail: (projectId: string, nodeId: string): Promise<NodeDetailPayload | null> =>
    ipcRenderer.invoke("catalyst:getNodeDetail", projectId, nodeId),
  onProjectUpdate: (listener: (update: ProjectUpdate) => void): (() => void) => {
    const handler = (_event: unknown, update: ProjectUpdate) => {
      listener(update);
    };
    ipcRenderer.on("catalyst:project-update", handler);
    return () => ipcRenderer.removeListener("catalyst:project-update", handler);
  },
  listSlashCommands: (projectId: string): Promise<SlashCommandSpec[]> =>
    ipcRenderer.invoke("catalyst:listSlashCommands", projectId),
  runSlashCommand: (projectId: string, name: string, args: string): Promise<string | null> =>
    ipcRenderer.invoke("catalyst:runSlashCommand", projectId, name, args),
  sendAgentInput: (projectId: string, text: string): Promise<void> =>
    ipcRenderer.invoke("catalyst:sendAgentInput", projectId, text),
  onAgentOutput: (listener: (event: AgentOutputEvent) => void): (() => void) => {
    const handler = (_event: unknown, payload: AgentOutputEvent) => {
      listener(payload);
    };
    ipcRenderer.on("catalyst:agent-output", handler);
    return () => ipcRenderer.removeListener("catalyst:agent-output", handler);
  },
};

export type CatalystApi = typeof api;

contextBridge.exposeInMainWorld("catalyst", api);
